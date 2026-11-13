
import test from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '@paybridge/database';

import {
    BadGatewayException,
    BadRequestException,
} from '@nestjs/common';

import { PaymentsService } from '../src/payments/payments.service';

// ==========================================
// TEST FIXTURES
// ==========================================

const paymentId = '51077ce6-0d23-4a34-8f84-fd77f009ad18';

const pendingPayment = {
    id: paymentId,
    invoiceId: '47155bef-f7ef-46fb-b7ea-8b10bf66ad59',
    status: 'PENDING',
    provider: 'near-intents-1click',
    providerStatus: 'PENDING_DEPOSIT',
    providerCorrelationId: 'correlation-123',
    depositAddress: 'test-deposit-address',
    depositMemo: null,
    payoutAddress: '0x000000000000000000000000000000000000dEaD',
    destinationAssetId: 'test-destination-asset',
    destinationAmount: new Prisma.Decimal('10'),
    invoiceAmount: new Prisma.Decimal('10'),
    sourceTxHash: null,
};

const pendingProviderResponse = {
    correlationId: 'correlation-123',
    status: 'PENDING_DEPOSIT',
    updatedAt: new Date().toISOString(),
};

// ==========================================
// MOCK SERVICE FACTORY
// ==========================================


function createTestService(
    payment: Record<string, any>,
    providerResponse = pendingProviderResponse,
    options: {
        confirmedAmount?: Prisma.Decimal;
    } = {},
) {
    let updateCalls = 0;
    let eventCalls = 0;
    let providerCalls = 0;
    let transactionCalls = 0;
    let invoiceUpdateCalls = 0;

    let currentPayment = { ...payment };

    const invoice = {
        id: payment.invoiceId,
        totalAmount: new Prisma.Decimal('10'),
        status: 'SENT',
    };

    const events: Record<string, any>[] = [];

    let paymentUpdateData: Record<string, any> | null = null;
    let invoiceUpdateData: Record<string, any> | null = null;

    const tx = {
        $queryRaw: async () => [],

        payment: {
            findUnique: async () => currentPayment,

            update: async ({ data }: any) => {
                updateCalls++;
                paymentUpdateData = data;

                currentPayment = {
                    ...currentPayment,
                    ...data,
                };

                return currentPayment;
            },

            aggregate: async () => ({
                _sum: {
                    invoiceAmount:
                        options.confirmedAmount ??
                        new Prisma.Decimal('10'),
                },
            }),
        },

        paymentEvent: {
            create: async ({ data }: any) => {
                eventCalls++;
                events.push(data);
                return data;
            },
        },

        invoice: {
            findUnique: async () => invoice,

            update: async ({ data }: any) => {
                invoiceUpdateCalls++;
                invoiceUpdateData = data;

                return {
                    ...invoice,
                    ...data,
                };
            },
        },
    };

    const prisma = {
        payment: {
            findUnique: async () => currentPayment,
        },

        $transaction: async (
            callback: (transaction: typeof tx) => Promise<unknown>,
        ) => {
            transactionCalls++;
            return callback(tx);
        },
    };

    const nearIntentsService = {
        getSwapStatus: async () => {
            providerCalls++;
            return providerResponse;
        },
    };

    const service = new PaymentsService(
        prisma as never,
        nearIntentsService as never,
    );

    return {
        service,

        getCounts: () => ({
            updateCalls,
            eventCalls,
            providerCalls,
            transactionCalls,
            invoiceUpdateCalls,
        }),

        getRecords: () => ({
            payment: currentPayment,
            events,
            paymentUpdateData,
            invoiceUpdateData,
        }),
    };
}


// ==========================================
// TEST 1: TERMINAL PAYMENT
// ==========================================

test(
    'Terminal payments must not be synchronized again',
    async () => {
        const payment = {
            ...pendingPayment,
            status: 'FAILED',
        };

        const { service, getCounts } =
            createTestService(payment);

        const result =
            await service.syncPaymentStatus(paymentId);

        assert.equal(result.status, 'FAILED');

        assert.deepEqual(getCounts(), {
            updateCalls: 0,
            eventCalls: 0,
            providerCalls: 0,
            transactionCalls: 0,
            invoiceUpdateCalls: 0,
        });
    },
);

// ==========================================
// TEST 2: MISSING DEPOSIT INSTRUCTIONS
// ==========================================

test(
    'Payments without deposit instructions must be rejected',
    async () => {
        const payment = {
            ...pendingPayment,
            depositAddress: null,
        };

        const { service, getCounts } =
            createTestService(payment);

        await assert.rejects(
            service.syncPaymentStatus(paymentId),
            error => error instanceof BadRequestException,
        );

        assert.equal(
            getCounts().providerCalls,
            0,
        );
    },
);

// ==========================================
// TEST 3: CORRELATION ID MISMATCH
// ==========================================

test(
    'Incorrect NEAR correlation IDs must be rejected',
    async () => {
        const providerResponse = {
            ...pendingProviderResponse,
            correlationId: 'incorrect-correlation-id',
        };

        const { service, getCounts } =
            createTestService(
                pendingPayment,
                providerResponse,
            );

        await assert.rejects(
            service.syncPaymentStatus(paymentId),
            error => error instanceof BadGatewayException,
        );

        assert.equal(
            getCounts().providerCalls,
            1,
        );

        assert.equal(
            getCounts().transactionCalls,
            0,
        );
    },
);

// ==========================================
// TEST 4: UNCHANGED PENDING STATUS
// ==========================================

test(
    'Unchanged pending statuses must not generate unnecessary database writes',
    async () => {
        const { service, getCounts } =
            createTestService(pendingPayment);

        const result =
            await service.syncPaymentStatus(paymentId);

        assert.equal(result.status, 'PENDING');

        assert.deepEqual(getCounts(), {
            updateCalls: 0,
            eventCalls: 0,
            providerCalls: 1,
            transactionCalls: 1,
            invoiceUpdateCalls: 0,
        });
    },
);



const validSuccessProviderResponse = {
    correlationId: 'correlation-123',
    status: 'SUCCESS',
    updatedAt: new Date().toISOString(),

    quoteResponse: {
        correlationId: 'correlation-123',
        timestamp: new Date().toISOString(),
        signature: 'test-signature',

        quoteRequest: {
            destinationAsset: 'test-destination-asset',
            recipient: pendingPayment.payoutAddress,
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
                hash: '0xsource123',
                explorerUrl: 'https://example.com/source',
            },
        ],

        destinationChainTxHashes: [
            {
                hash: '0xdestination123',
                explorerUrl: 'https://example.com/destination',
            },
        ],
    },
};

// ==========================================
// TEST 5: WRONG PAYOUT ADDRESS
// ==========================================

test(
    'Successful provider response with wrong payout address must be rejected',
    async () => {
        const providerResponse = {
            ...validSuccessProviderResponse,

            quoteResponse: {
                ...validSuccessProviderResponse.quoteResponse,

                quoteRequest: {
                    ...validSuccessProviderResponse.quoteResponse.quoteRequest,
                    recipient: '0x0000000000000000000000000000000000000001',
                },
            },
        };

        const { service, getCounts } =
            createTestService(
                pendingPayment,
                providerResponse,
            );

        await assert.rejects(
            service.syncPaymentStatus(paymentId),
            error =>
                error instanceof BadGatewayException &&
                error.message === 'Settlement recipient mismatch',
        );

        assert.equal(getCounts().transactionCalls, 0);
        assert.equal(getCounts().updateCalls, 0);
    },
);

// ==========================================
// TEST 6: INCORRECT SETTLEMENT AMOUNT
// ==========================================

test(
    'Incorrect USDC settlement amount must be rejected',
    async () => {
        const providerResponse = {
            ...validSuccessProviderResponse,

            quoteResponse: {
                ...validSuccessProviderResponse.quoteResponse,

                quote: {
                    amountOut: '9999999',
                },
            },

            swapDetails: {
                ...validSuccessProviderResponse.swapDetails,
                amountOut: '9999999',
            },
        };

        const { service, getCounts } =
            createTestService(
                pendingPayment,
                providerResponse,
            );

        await assert.rejects(
            service.syncPaymentStatus(paymentId),
            error =>
                error instanceof BadGatewayException &&
                error.message ===
                'Settlement amount does not match the expected invoice payment',
        );

        assert.equal(getCounts().transactionCalls, 0);
        assert.equal(getCounts().updateCalls, 0);
    },
);

// ==========================================
// TEST 7: MISSING DESTINATION TRANSACTION HASH
// ==========================================

test(
    'Successful settlement without destination transaction hash must be rejected',
    async () => {
        const providerResponse = {
            ...validSuccessProviderResponse,

            swapDetails: {
                ...validSuccessProviderResponse.swapDetails,
                destinationChainTxHashes: [],
            },
        };

        const { service, getCounts } =
            createTestService(
                pendingPayment,
                providerResponse,
            );

        await assert.rejects(
            service.syncPaymentStatus(paymentId),
            error =>
                error instanceof BadGatewayException &&
                error.message ===
                'Successful settlement has no destination transaction hash',
        );

        assert.equal(getCounts().transactionCalls, 0);
        assert.equal(getCounts().updateCalls, 0);
    },
);


test(
    'Valid successful settlement must confirm payment and mark invoice as paid',
    async () => {
        const { service, getCounts, getRecords } =
            createTestService(
                pendingPayment,
                validSuccessProviderResponse,
            );

        const result =
            await service.syncPaymentStatus(paymentId);

        const counts = getCounts();
        const records = getRecords();

        // Payment confirmation
        assert.equal(result.status, 'CONFIRMED');

        assert.equal(
            records.payment.destinationTxHash,
            '0xdestination123',
        );

        assert.ok(records.payment.confirmedAt);

        // Exactly one payment update
        assert.equal(counts.updateCalls, 1);

        // Exactly one confirmation event
        assert.equal(counts.eventCalls, 1);

        assert.equal(
            records.events[0]?.eventType,
            'PAYMENT_CONFIRMED',
        );

        assert.equal(
            records.events[0]?.previousStatus,
            'PENDING',
        );

        assert.equal(
            records.events[0]?.newStatus,
            'CONFIRMED',
        );

        // Invoice reconciliation
        assert.equal(counts.invoiceUpdateCalls, 1);

        assert.equal(
            records.invoiceUpdateData?.status,
            'PAID',
        );

        // Provider and transaction calls
        assert.equal(counts.providerCalls, 1);
        assert.equal(counts.transactionCalls, 1);
    },
);


test(
    'Partial payment must mark invoice as PARTIALLY_PAID',
    async () => {
        const payment = {
            ...pendingPayment,
            invoiceAmount: new Prisma.Decimal('4'),
        };

        const { service, getCounts, getRecords } =
            createTestService(
                payment,
                validSuccessProviderResponse,
                {
                    confirmedAmount: new Prisma.Decimal('4'),
                },
            );

        const result =
            await service.syncPaymentStatus(paymentId);

        const records = getRecords();

        assert.equal(result.status, 'CONFIRMED');

        assert.equal(
            getCounts().invoiceUpdateCalls,
            1,
        );

        assert.equal(
            records.invoiceUpdateData?.status,
            'PARTIALLY_PAID',
        );
    },
);

test(
    'Multiple confirmed payments must reconcile invoice correctly',
    async () => {
        const payment = {
            ...pendingPayment,
            invoiceAmount: new Prisma.Decimal('4'),
        };

        const { service, getCounts, getRecords } =
            createTestService(
                payment,
                validSuccessProviderResponse,
                {
                    confirmedAmount: new Prisma.Decimal('10'),
                },
            );

        const result =
            await service.syncPaymentStatus(paymentId);

        const records = getRecords();

        assert.equal(result.status, 'CONFIRMED');

        assert.equal(
            getCounts().invoiceUpdateCalls,
            1,
        );

        assert.equal(
            records.invoiceUpdateData?.status,
            'PAID',
        );
    },
);
