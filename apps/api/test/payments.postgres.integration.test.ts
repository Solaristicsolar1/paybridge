
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import { PrismaService } from '../src/database/prisma.service';
import { PaymentsService } from '../src/payments/payments.service';

const testDatabaseUrl =
    process.env.PAYBRIDGE_TEST_DATABASE_URL;

test(
    'PostgreSQL prevents duplicate concurrent payment confirmation',
    { skip: !testDatabaseUrl },

    async () => {
        const previousDatabaseUrl =
            process.env.DATABASE_URL;

        process.env.DATABASE_URL = testDatabaseUrl!;

        const prisma = new PrismaService();

        let connected = false;

        let userId: string | undefined;
        let businessId: string | undefined;
        let clientId: string | undefined;
        let invoiceId: string | undefined;
        let paymentId: string | undefined;

        try {
            await prisma.onModuleInit();
            connected = true;

            const suffix = randomUUID();

            // Create isolated test user.
            const user = await prisma.user.create({
                data: {
                    email: `integration-${suffix}@example.test`,
                    displayName: 'Integration Tester',
                },
            });

            userId = user.id;

            // Create business.
            const business = await prisma.business.create({
                data: {
                    name: 'Integration Test Business',
                    slug: `integration-${suffix}`,
                    createdById: user.id,
                    basePayoutAddress:
                        '0x000000000000000000000000000000000000dEaD',
                },
            });

            businessId = business.id;

            // Create client.
            const client = await prisma.client.create({
                data: {
                    businessId: business.id,
                    name: 'Integration Test Customer',
                },
            });

            clientId = client.id;

            // Create issued invoice.
            const invoice = await prisma.invoice.create({
                data: {
                    businessId: business.id,
                    clientId: client.id,
                    createdById: user.id,
                    invoiceNumber: `IT-${suffix}`,
                    status: 'SENT',
                    currency: 'USD',
                    subtotal: '10',
                    taxAmount: '0',
                    totalAmount: '10',
                },
            });

            invoiceId = invoice.id;

            const correlationId =
                `integration-${suffix}`;

            const destinationHash =
                `0x${randomUUID().replace(/-/g, '').padEnd(64, '0')}`;

            const sourceHash =
                `0x${randomUUID().replace(/-/g, '').padEnd(64, '0')}`;

            // Create one pending payment.
            const payment = await prisma.payment.create({
                data: {
                    invoiceId: invoice.id,
                    status: 'PENDING',
                    provider: 'near-intents-1click',
                    invoiceAmount: '10',
                    destinationAmount: '10',
                    destinationAssetId: 'test-destination-asset',
                    payoutAddress:
                        '0x000000000000000000000000000000000000dEaD',
                    providerCorrelationId: correlationId,
                    depositAddress: `deposit-${suffix}`,
                    providerStatus: 'PROCESSING',
                },
            });

            paymentId = payment.id;

            // Force both workers to receive their provider
            // response before either can continue.
            let providerCalls = 0;

            let releaseWorkers!: () => void;

            const bothWorkersReady = new Promise<void>(
                resolve => {
                    releaseWorkers = resolve;
                },
            );

            const providerResponse = {
                correlationId,
                status: 'SUCCESS',
                updatedAt: new Date().toISOString(),

                quoteResponse: {
                    correlationId,
                    timestamp: new Date().toISOString(),
                    signature: 'integration-test-signature',

                    quoteRequest: {
                        destinationAsset:
                            'test-destination-asset',

                        recipient:
                            payment.payoutAddress,
                    },

                    quote: {
                        amountOut: '10000000',
                    },
                },

                swapDetails: {
                    amountIn: '12000000',
                    amountOut: '10000000',

                    originChainTxHashes: [
                        {
                            hash: sourceHash,
                            explorerUrl: 'https://example.test/source',
                        },
                    ],

                    destinationChainTxHashes: [
                        {
                            hash: destinationHash,
                            explorerUrl: 'https://example.test/destination',
                        },
                    ],
                },
            };

            const nearIntentsService = {
                getSwapStatus: async () => {
                    providerCalls++;

                    if (providerCalls === 2) {
                        releaseWorkers();
                    }

                    await bothWorkersReady;

                    return providerResponse;
                },
            };

            const service = new PaymentsService(
                prisma,
                nearIntentsService as never,
            );

            // Two workers synchronize the same payment.
            const results = await Promise.all([
                service.syncPaymentStatus(payment.id),
                service.syncPaymentStatus(payment.id),
            ]);

            // Read actual PostgreSQL records.
            const finalPayment =
                await prisma.payment.findUniqueOrThrow({
                    where: { id: payment.id },
                });

            const events =
                await prisma.paymentEvent.findMany({
                    where: {
                        paymentId: payment.id,
                        eventType: 'PAYMENT_CONFIRMED',
                    },
                });

            const finalInvoice =
                await prisma.invoice.findUniqueOrThrow({
                    where: { id: invoice.id },
                });

            const aggregate =
                await prisma.payment.aggregate({
                    where: {
                        invoiceId: invoice.id,
                        status: 'CONFIRMED',
                    },
                    _sum: {
                        invoiceAmount: true,
                    },
                });

            // Assertions.
            assert.equal(providerCalls, 2);

            assert.equal(finalPayment.status, 'CONFIRMED');

            assert.equal(
                results[0]?.status,
                'CONFIRMED',
            );

            assert.equal(
                results[1]?.status,
                'CONFIRMED',
            );

            assert.equal(events.length, 1);

            assert.equal(
                finalPayment.destinationTxHash,
                destinationHash,
            );

            assert.equal(finalInvoice.status, 'PAID');

            assert.equal(
                aggregate._sum.invoiceAmount?.toString(),
                '10',
            );

            console.log(
                'PostgreSQL concurrency test passed:',
                {
                    providerCalls,
                    confirmedPayments: 1,
                    confirmationEvents: events.length,
                    creditedAmount:
                        aggregate._sum.invoiceAmount?.toString(),
                    invoiceStatus: finalInvoice.status,
                },
            );

        } finally {
            if (connected) {
                // Delete dependent records first.
                if (paymentId) {
                    await prisma.paymentEvent.deleteMany({
                        where: { paymentId },
                    });

                    await prisma.payment.deleteMany({
                        where: { id: paymentId },
                    });
                }

                if (invoiceId) {
                    await prisma.invoice.deleteMany({
                        where: { id: invoiceId },
                    });
                }

                if (clientId) {
                    await prisma.client.deleteMany({
                        where: { id: clientId },
                    });
                }

                if (businessId) {
                    await prisma.business.deleteMany({
                        where: { id: businessId },
                    });
                }

                if (userId) {
                    await prisma.user.deleteMany({
                        where: { id: userId },
                    });
                }

                await prisma.onModuleDestroy();
            }

            if (previousDatabaseUrl === undefined) {
                delete process.env.DATABASE_URL;
            } else {
                process.env.DATABASE_URL =
                    previousDatabaseUrl;
            }
        }
    },
);


test(
    'Two concurrent payments against one invoice must both be reconciled without hiding overpayment',
    { skip: !testDatabaseUrl },

    async () => {
        const previousDatabaseUrl =
            process.env.DATABASE_URL;

        process.env.DATABASE_URL = testDatabaseUrl!;

        const prisma = new PrismaService();

        let connected = false;

        let userId: string | undefined;
        let businessId: string | undefined;
        let clientId: string | undefined;
        let invoiceId: string | undefined;
        const paymentIds: string[] = [];

        try {
            await prisma.onModuleInit();
            connected = true;

            const suffix = randomUUID();

            // Create test user.
            const user = await prisma.user.create({
                data: {
                    email: `overpayment-${suffix}@example.test`,
                    displayName: 'Overpayment Tester',
                },
            });

            userId = user.id;

            // Create business.
            const business = await prisma.business.create({
                data: {
                    name: 'Overpayment Test Business',
                    slug: `overpayment-${suffix}`,
                    createdById: user.id,
                    basePayoutAddress:
                        '0x000000000000000000000000000000000000dEaD',
                },
            });

            businessId = business.id;

            // Create client.
            const client = await prisma.client.create({
                data: {
                    businessId: business.id,
                    name: 'Overpayment Test Customer',
                },
            });

            clientId = client.id;

            // Create $100 invoice.
            const invoice = await prisma.invoice.create({
                data: {
                    businessId: business.id,
                    clientId: client.id,
                    createdById: user.id,
                    invoiceNumber: `OVER-${suffix}`,
                    status: 'SENT',
                    currency: 'USD',
                    subtotal: '100',
                    taxAmount: '0',
                    totalAmount: '100',
                },
            });

            invoiceId = invoice.id;

            const payoutAddress =
                '0x000000000000000000000000000000000000dEaD';

            const destinationAsset =
                'test-destination-asset';

            const testPayments = [
                {
                    label: 'A',
                    correlationId: `correlation-A-${suffix}`,
                    depositAddress: `deposit-A-${suffix}`,
                    destinationHash:
                        `0x${randomUUID().replace(/-/g, '').padEnd(64, '0')}`,
                    sourceHash:
                        `0x${randomUUID().replace(/-/g, '').padEnd(64, '0')}`,
                },
                {
                    label: 'B',
                    correlationId: `correlation-B-${suffix}`,
                    depositAddress: `deposit-B-${suffix}`,
                    destinationHash:
                        `0x${randomUUID().replace(/-/g, '').padEnd(64, '0')}`,
                    sourceHash:
                        `0x${randomUUID().replace(/-/g, '').padEnd(64, '0')}`,
                },
            ];

            // Create two independent $70 payments.
            for (const item of testPayments) {
                const payment = await prisma.payment.create({
                    data: {
                        invoiceId: invoice.id,
                        status: 'PENDING',
                        provider: 'near-intents-1click',
                        invoiceAmount: '70',
                        destinationAmount: '70',
                        destinationAssetId: destinationAsset,
                        payoutAddress,
                        providerCorrelationId:
                            item.correlationId,
                        depositAddress:
                            item.depositAddress,
                        providerStatus: 'PROCESSING',
                    },
                });

                paymentIds.push(payment.id);
            }

            // Build separate successful provider responses.
            const responses = new Map<string, any>();

            for (const item of testPayments) {
                responses.set(item.depositAddress, {
                    correlationId: item.correlationId,
                    status: 'SUCCESS',
                    updatedAt: new Date().toISOString(),

                    quoteResponse: {
                        correlationId: item.correlationId,
                        timestamp: new Date().toISOString(),
                        signature: 'integration-test-signature',

                        quoteRequest: {
                            destinationAsset,
                            recipient: payoutAddress,
                        },

                        quote: {
                            amountOut: '70000000',
                        },
                    },

                    swapDetails: {
                        amountIn: '84000000',
                        amountOut: '70000000',

                        originChainTxHashes: [
                            {
                                hash: item.sourceHash,
                                explorerUrl:
                                    'https://example.test/source',
                            },
                        ],

                        destinationChainTxHashes: [
                            {
                                hash: item.destinationHash,
                                explorerUrl:
                                    'https://example.test/destination',
                            },
                        ],
                    },
                });
            }

            // Synchronize both provider responses before
            // allowing either worker to continue.
            let providerCalls = 0;

            let releaseWorkers!: () => void;

            const bothWorkersReady = new Promise<void>(
                resolve => {
                    releaseWorkers = resolve;
                },
            );

            const nearIntentsService = {
                getSwapStatus: async (
                    depositAddress: string,
                ) => {
                    providerCalls++;

                    if (providerCalls === 2) {
                        releaseWorkers();
                    }

                    await bothWorkersReady;

                    const response =
                        responses.get(depositAddress);

                    assert.ok(
                        response,
                        'Unexpected deposit address',
                    );

                    return response;
                },
            };

            const service = new PaymentsService(
                prisma,
                nearIntentsService as never,
            );

            // Execute two independent settlements concurrently.
            const results = await Promise.all(
                paymentIds.map(id =>
                    service.syncPaymentStatus(id),
                ),
            );

            // Read final PostgreSQL records.
            const finalPayments =
                await prisma.payment.findMany({
                    where: {
                        invoiceId: invoice.id,
                    },
                });

            const confirmationEvents =
                await prisma.paymentEvent.findMany({
                    where: {
                        paymentId: {
                            in: paymentIds,
                        },
                        eventType: 'PAYMENT_CONFIRMED',
                    },
                });

            const finalInvoice =
                await prisma.invoice.findUniqueOrThrow({
                    where: {
                        id: invoice.id,
                    },
                });

            const aggregate =
                await prisma.payment.aggregate({
                    where: {
                        invoiceId: invoice.id,
                        status: 'CONFIRMED',
                    },
                    _sum: {
                        invoiceAmount: true,
                    },
                });

            const creditedAmount =
                Number(
                    aggregate._sum.invoiceAmount?.toString() ?? '0',
                );

            const overpayment =
                creditedAmount - 100;

            // Verify both payments settled.
            assert.equal(providerCalls, 2);
            assert.equal(results.length, 2);
            assert.equal(finalPayments.length, 2);

            assert.ok(
                finalPayments.every(
                    payment => payment.status === 'CONFIRMED',
                ),
            );

            // Both confirmations must be recorded exactly once.
            assert.equal(confirmationEvents.length, 2);

            // Verify financial reconciliation.
            assert.equal(creditedAmount, 140);
            assert.equal(overpayment, 40);

            // Record the current invoice-status behaviour.
            assert.equal(finalInvoice.status, 'OVERPAID');

            console.log(
                'Concurrent overpayment test results:',
                {
                    providerCalls,
                    confirmedPayments:
                        finalPayments.filter(
                            payment =>
                                payment.status === 'CONFIRMED',
                        ).length,
                    confirmationEvents:
                        confirmationEvents.length,
                    invoiceTotal: 100,
                    creditedAmount,
                    overpayment,
                    invoiceStatus: finalInvoice.status,
                },
            );

        } finally {
            if (connected) {
                if (paymentIds.length > 0) {
                    await prisma.paymentEvent.deleteMany({
                        where: {
                            paymentId: {
                                in: paymentIds,
                            },
                        },
                    });

                    await prisma.payment.deleteMany({
                        where: {
                            id: {
                                in: paymentIds,
                            },
                        },
                    });
                }

                if (invoiceId) {
                    await prisma.invoice.deleteMany({
                        where: { id: invoiceId },
                    });
                }

                if (clientId) {
                    await prisma.client.deleteMany({
                        where: { id: clientId },
                    });
                }

                if (businessId) {
                    await prisma.business.deleteMany({
                        where: { id: businessId },
                    });
                }

                if (userId) {
                    await prisma.user.deleteMany({
                        where: { id: userId },
                    });
                }

                await prisma.onModuleDestroy();
            }

            if (previousDatabaseUrl === undefined) {
                delete process.env.DATABASE_URL;
            } else {
                process.env.DATABASE_URL =
                    previousDatabaseUrl;
            }
        }
    },
);
