
import {
    BadGatewayException,
    BadRequestException,
    ConflictException,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';

import {
    Cron,
    CronExpression,
} from '@nestjs/schedule';

import { Prisma } from '@paybridge/database';

import { PrismaService } from '../database/prisma.service';

import { ListPaymentsDto } from './dto/list-payments.dto';
import { CreateInvoiceCheckoutDto } from './dto/create-invoice-checkout.dto';

import { NearIntentsService } from './near-intents/near-intents.service';

import {
    NearIntentsToken,
} from './near-intents/near-intents.types';

const DESTINATION_CHAIN = 'base';
const DESTINATION_SYMBOL = 'USDC';

const EVM_CHAINS = new Set([
    'eth',
    'arb',
    'base',
    'pol',
    'bsc',
    'op',
    'avax',
    'gnosis',
    'linea',
    'zksync',
    'scroll',
    'mantle',
]);

const MONEY_SCALE = 8;

@Injectable()
export class PaymentsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly nearIntentsService: NearIntentsService,
    ) { }

    private readonly logger =
        new Logger(PaymentsService.name);

    private isPolling = false;

    // ==========================================
    // ASSET HELPERS
    // ==========================================

    private getDestinationToken(
        tokens: NearIntentsToken[],
    ) {
        const token = tokens.find(
            item =>
                item.blockchain === DESTINATION_CHAIN &&
                item.symbol.toUpperCase() === DESTINATION_SYMBOL,
        );

        if (!token) {
            throw new BadRequestException(
                'USDC on Base is currently unavailable',
            );
        }

        return token;
    }

    private formatUnits(
        rawAmount: string,
        decimals: number,
    ): string {
        const value = BigInt(rawAmount);
        const scale = 10n ** BigInt(decimals);

        const whole = value / scale;

        const fraction = (value % scale)
            .toString()
            .padStart(decimals, '0')
            .replace(/0+$/, '');

        return fraction
            ? `${whole.toString()}.${fraction}`
            : whole.toString();
    }

    private getQuoteExpiry(
        quote: {
            timeWhenInactive?: string;
            deadline?: string;
        },
    ): Date | null {
        const value =
            quote.timeWhenInactive ?? quote.deadline;

        if (!value) {
            return null;
        }

        const date = new Date(value);

        return Number.isNaN(date.getTime())
            ? null
            : date;
    }

    private checkoutResponse(payment: {
        id: string;
        status: string;
        invoiceAmount: Prisma.Decimal;
        sourceAssetId: string | null;
        sourceChain: string | null;
        sourceTokenSymbol: string | null;
        destinationAssetId: string | null;
        destinationAmount: Prisma.Decimal | null;
        depositAddress: string | null;
        depositMemo: string | null;
        expiresAt: Date | null;
        providerReference: string | null;
        providerResponse: Prisma.JsonValue | null;
    }) {
        const response = payment.providerResponse as {
            quote?: {
                depositAddress?: string;
                depositMemo?: string;
                amountIn?: string;
                amountInFormatted?: string;
                amountOut?: string;
                amountOutFormatted?: string;
                timeEstimate?: number;
            };
        } | null;

        return {
            paymentId: payment.id,
            status: payment.status,

            invoiceAmount: payment.invoiceAmount.toString(),

            sourceAsset: {
                assetId: payment.sourceAssetId,
                blockchain: payment.sourceChain,
                symbol: payment.sourceTokenSymbol,
            },

            destinationAsset: {
                assetId: payment.destinationAssetId,
                blockchain: DESTINATION_CHAIN,
                symbol: DESTINATION_SYMBOL,
                amount: payment.destinationAmount?.toString(),
            },

            deposit: payment.depositAddress
                ? {
                    address: payment.depositAddress,
                    memo: payment.depositMemo,
                    amount: response?.quote?.amountIn,
                    formattedAmount:
                        response?.quote?.amountInFormatted,
                    expiresAt: payment.expiresAt,
                }
                : null,

            providerReference: payment.providerReference,
            estimatedSeconds: response?.quote?.timeEstimate,
        };
    }

    // ==========================================
    // GET PUBLIC CHECKOUT ASSETS
    // ==========================================

    async getCheckoutAssets() {
        const tokens =
            await this.nearIntentsService.getSupportedTokens();

        const destinationToken =
            this.getDestinationToken(tokens);

        return tokens
            .filter(token =>
                EVM_CHAINS.has(token.blockchain.toLowerCase()) &&
                token.assetId !== destinationToken.assetId,
            )
            .map(token => ({
                assetId: token.assetId,
                symbol: token.symbol,
                blockchain: token.blockchain,
                decimals: token.decimals,
            }));
    }

    // ==========================================
    // CREATE PUBLIC INVOICE CHECKOUT
    // ==========================================

    async createInvoiceCheckout(
        invoiceToken: string,
        dto: CreateInvoiceCheckoutDto,
        idempotencyKey: string,
    ) {
        if (
            !idempotencyKey ||
            idempotencyKey.trim().length === 0 ||
            idempotencyKey.length > 128
        ) {
            throw new BadRequestException(
                'A valid Idempotency-Key header is required',
            );
        }

        const tokens =
            await this.nearIntentsService.getSupportedTokens();

        const sourceToken = tokens.find(
            token => token.assetId === dto.originAsset,
        );

        if (!sourceToken) {
            throw new BadRequestException(
                'Unsupported source asset',
            );
        }

        if (
            !EVM_CHAINS.has(sourceToken.blockchain.toLowerCase())
        ) {
            throw new BadRequestException(
                'This source network is not yet supported for checkout',
            );
        }

        const destinationToken =
            this.getDestinationToken(tokens);

        if (
            sourceToken.assetId === destinationToken.assetId
        ) {
            throw new BadRequestException(
                'Choose a different source asset',
            );
        }

        const now = new Date();

        // ======================================
        // RESERVE THE INVOICE PAYMENT
        // ======================================

        const reservation = await this.prisma.$transaction(
            async tx => {
                // Lock the invoice to prevent concurrent
                // payment reservations.

                await tx.$queryRaw<Array<{ id: string }>>`
                    SELECT "id"
                    FROM "Invoice"
                    WHERE "publicToken" = ${invoiceToken}::uuid
                    FOR UPDATE
                `;

                const invoice = await tx.invoice.findUnique({
                    where: {
                        publicToken: invoiceToken,
                    },
                    include: {
                        business: {
                            select: {
                                basePayoutAddress: true,
                            },
                        },
                    },
                });

                if (!invoice) {
                    throw new NotFoundException(
                        'Invoice not found',
                    );
                }

                // Idempotent replay.
                const existingByKey =
                    await tx.payment.findUnique({
                        where: {
                            idempotencyKey,
                        },
                    });

                if (existingByKey) {
                    if (
                        existingByKey.invoiceId !== invoice.id ||
                        existingByKey.sourceAssetId !== dto.originAsset
                    ) {
                        throw new ConflictException(
                            'Idempotency key has already been used for another checkout',
                        );
                    }

                    return {
                        existing: existingByKey,
                        payment: null,
                        invoice: null,
                    };
                }

                if (invoice.currency !== 'USD') {
                    throw new BadRequestException(
                        'Only USD invoices are supported for crypto checkout currently',
                    );
                }

                if (
                    !['SENT', 'PARTIALLY_PAID', 'OVERDUE']
                        .includes(invoice.status)
                ) {
                    throw new ConflictException(
                        'This invoice is not available for payment',
                    );
                }

                const payoutAddress =
                    invoice.business.basePayoutAddress;

                if (
                    !payoutAddress ||
                    !/^0x[a-fA-F0-9]{40}$/.test(payoutAddress)
                ) {
                    throw new BadRequestException(
                        'The business has not configured a valid Base payout address',
                    );
                }

                // Do not allow overlapping active checkouts
                // against the same outstanding balance.

                const activeCheckout = await tx.payment.findFirst({
                    where: {
                        invoiceId: invoice.id,
                        status: 'PENDING',
                    },
                    select: {
                        id: true,
                    },
                });

                if (activeCheckout) {
                    throw new ConflictException(
                        'This invoice has a payment awaiting settlement verification',
                    );
                }

                const paidPayments =
                    await tx.payment.aggregate({
                        where: {
                            invoiceId: invoice.id,
                            status: 'CONFIRMED',
                        },
                        _sum: {
                            invoiceAmount: true,
                        },
                    });

                const paidAmount =
                    paidPayments._sum.invoiceAmount ??
                    new Prisma.Decimal(0);

                const outstanding =
                    invoice.totalAmount.minus(paidAmount);

                if (outstanding.lte(0)) {
                    throw new ConflictException(
                        'This invoice has already been paid',
                    );
                }

                // USDC on Base supports six decimal places.
                if (outstanding.decimalPlaces() > 6) {
                    throw new BadRequestException(
                        'Invoice balance exceeds USDC precision',
                    );
                }

                const destinationAmount =
                    outstanding.toFixed(6);

                const payment = await tx.payment.create({
                    data: {
                        invoiceId: invoice.id,

                        // Snapshot the merchant's payout wallet.
                        payoutAddress,

                        // Snapshot the customer's original refund wallet.
                        sourceRefundAddress: dto.refundTo,

                        status: 'PENDING',

                        provider: 'near-intents-1click',

                        idempotencyKey,

                        invoiceAmount: outstanding,

                        sourceAssetId: sourceToken.assetId,
                        sourceChain: sourceToken.blockchain,
                        sourceTokenSymbol: sourceToken.symbol,

                        destinationAssetId:
                            destinationToken.assetId,

                        destinationChain: DESTINATION_CHAIN,
                        destinationTokenSymbol: DESTINATION_SYMBOL,

                        destinationAmount:
                            new Prisma.Decimal(destinationAmount),

                        providerStatus: 'CREATING_QUOTE',
                    },
                });

                await tx.paymentEvent.create({
                    data: {
                        paymentId: payment.id,
                        eventType: 'CHECKOUT_RESERVED',
                        newStatus: 'PENDING',
                        reference: idempotencyKey,
                    },
                });

                return {
                    existing: null,
                    payment,
                    invoice: {
                        id: invoice.id,
                        invoiceNumber: invoice.invoiceNumber,
                        businessId: invoice.businessId,
                        payoutAddress,
                        destinationAmount,
                    },
                };
            },
        );

        // Existing idempotent request.
        if (reservation.existing) {
            return this.checkoutResponse(
                reservation.existing,
            );
        }

        const payment = reservation.payment!;
        const invoice = reservation.invoice!;

        // ======================================
        // GENERATE LIVE NEAR QUOTE
        // ======================================

        try {
            const liveQuote =
                await this.nearIntentsService.createLiveQuote({
                    originAsset: sourceToken.assetId,

                    destinationAsset:
                        destinationToken.assetId,

                    destinationAmount:
                        invoice.destinationAmount,

                    recipient: invoice.payoutAddress,

                    refundTo: dto.refundTo,

                    slippageTolerance:
                        dto.slippageTolerance,
                });

            const providerQuote = liveQuote.quote;

            const expiry = this.getQuoteExpiry(
                providerQuote.quote,
            );

            const sourceAmount =
                sourceToken.decimals <= 18
                    ? new Prisma.Decimal(
                        this.formatUnits(
                            providerQuote.quote.amountIn,
                            sourceToken.decimals,
                        ),
                    )
                    : undefined;

            const updatedPayment =
                await this.prisma.$transaction(
                    async tx => {
                        const updated =
                            await tx.payment.update({
                                where: {
                                    id: payment.id,
                                },
                                data: {
                                    providerReference:
                                        providerQuote.correlationId,

                                    providerCorrelationId:
                                        providerQuote.correlationId,

                                    providerStatus:
                                        'PENDING_DEPOSIT',

                                    sourceAmount: sourceAmount ?? null,

                                    depositAddress:
                                        providerQuote.quote.depositAddress!,

                                    depositMemo:
                                        providerQuote.quote.depositMemo ?? null,

                                    expiresAt: expiry,

                                    providerResponse:
                                        JSON.parse(
                                            JSON.stringify(providerQuote),
                                        ) as Prisma.InputJsonValue,
                                },
                            });

                        await tx.paymentEvent.create({
                            data: {
                                paymentId: payment.id,
                                eventType: 'LIVE_QUOTE_CREATED',
                                previousStatus: 'PENDING',
                                newStatus: 'PENDING',
                                reference:
                                    providerQuote.correlationId,
                            },
                        });

                        return updated;
                    },
                );

            return this.checkoutResponse(updatedPayment);

        } catch (error) {
            await this.prisma.$transaction(
                async tx => {
                    await tx.payment.update({
                        where: {
                            id: payment.id,
                        },
                        data: {
                            status: 'FAILED',
                            providerStatus: 'QUOTE_FAILED',
                        },
                    });

                    await tx.paymentEvent.create({
                        data: {
                            paymentId: payment.id,
                            eventType: 'QUOTE_CREATION_FAILED',
                            previousStatus: 'PENDING',
                            newStatus: 'FAILED',
                        },
                    });
                },
            );

            throw error;
        }
    }

    // ==========================================
    // LIST BUSINESS PAYMENTS
    // ==========================================

    async getPayments(
        businessId: string,
        query: ListPaymentsDto,
    ) {
        const { page, limit } = query;

        const where = {
            invoice: {
                is: {
                    businessId,
                },
            },
        };

        const [data, total] = await Promise.all([
            this.prisma.payment.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: {
                    createdAt: 'desc',
                },
                include: {
                    events: {
                        orderBy: {
                            occurredAt: 'desc',
                        },
                    },
                    installment: true,
                    invoice: {
                        select: {
                            id: true,
                            invoiceNumber: true,
                            currency: true,
                            totalAmount: true,
                            status: true,
                        },
                    },
                },
            }),

            this.prisma.payment.count({
                where,
            }),
        ]);

        return {
            data,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
                hasNextPage: page * limit < total,
                hasPreviousPage: page > 1,
            },
        };
    }

    // ==========================================
    // GET SINGLE BUSINESS PAYMENT
    // ==========================================

    async getPayment(
        businessId: string,
        paymentId: string,
    ) {
        const payment = await this.prisma.payment.findFirst({
            where: {
                id: paymentId,
                invoice: {
                    is: {
                        businessId,
                    },
                },
            },
            include: {
                events: {
                    orderBy: {
                        occurredAt: 'desc',
                    },
                },
                installment: true,
                invoice: {
                    select: {
                        id: true,
                        invoiceNumber: true,
                        currency: true,
                        subtotal: true,
                        taxAmount: true,
                        totalAmount: true,
                        status: true,
                    },
                },
            },
        });

        if (!payment) {
            throw new NotFoundException(
                'Payment not found',
            );
        }

        return payment;
    }


    // ==========================================
    // CONVERT BASE USDC AMOUNT TO SMALLEST UNITS
    // ==========================================

    private toUsdcSmallestUnits(
        amount: Prisma.Decimal,
    ): string {
        const [whole, fraction = ''] =
            amount.toFixed(6).split('.');

        if (whole === undefined) {
            throw new BadGatewayException(
                'Invalid expected USDC amount',
            );
        }

        return (
            BigInt(whole) * 1_000_000n +
            BigInt(fraction.padEnd(6, '0'))
        ).toString();
    }

    // ==========================================
    // SYNCHRONIZE ONE PAYMENT WITH NEAR INTENTS
    // ==========================================

    async syncPaymentStatus(paymentId: string) {
        const payment = await this.prisma.payment.findUnique({
            where: { id: paymentId },
        });

        if (!payment) {
            throw new NotFoundException('Payment not found');
        }

        if (
            !['PENDING', 'EXPIRED'].includes(payment.status)
        ) {
            return payment;
        }

        if (
            !payment.depositAddress ||
            !payment.providerCorrelationId
        ) {
            throw new BadRequestException(
                'Payment has no NEAR deposit instructions',
            );
        }

        const providerStatus =
            await this.nearIntentsService.getSwapStatus(
                payment.depositAddress,
                payment.depositMemo ?? undefined,
            );

        // Verify that NEAR returned the correct swap.

        if (
            providerStatus.correlationId !==
            payment.providerCorrelationId
        ) {
            throw new BadGatewayException(
                'NEAR payment correlation ID mismatch',
            );
        }

        const providerState = providerStatus.status;

        let nextStatus:
            | 'CONFIRMED'
            | 'FAILED'
            | 'REFUNDED'
            | null = null;

        let destinationTxHash: string | null = null;
        let sourceTxHash: string | null = null;

        // ======================================
        // VERIFY SUCCESSFUL SETTLEMENT
        // ======================================

        if (providerState === 'SUCCESS') {
            const quoteResponse =
                providerStatus.quoteResponse;

            const swapDetails =
                providerStatus.swapDetails;

            const expectedAmount =
                payment.destinationAmount;

            const payoutAddress = payment.payoutAddress;

            if (
                !quoteResponse ||
                !swapDetails ||
                !expectedAmount ||
                !payoutAddress
            ) {
                throw new BadGatewayException(
                    'Incomplete NEAR settlement information',
                );
            }

            const quoteRequest =
                quoteResponse.quoteRequest;

            if (
                quoteRequest.destinationAsset !==
                payment.destinationAssetId
            ) {
                throw new BadGatewayException(
                    'Settlement destination asset mismatch',
                );
            }

            if (
                typeof quoteRequest.recipient !== 'string' ||
                quoteRequest.recipient.toLowerCase() !==
                payoutAddress.toLowerCase()
            ) {
                throw new BadGatewayException(
                    'Settlement recipient mismatch',
                );
            }

            const expectedRawAmount =
                this.toUsdcSmallestUnits(expectedAmount);

            if (
                quoteResponse.quote.amountOut !==
                expectedRawAmount ||
                swapDetails.amountOut !==
                expectedRawAmount
            ) {
                throw new BadGatewayException(
                    'Settlement amount does not match the expected invoice payment',
                );
            }

            destinationTxHash =
                swapDetails.destinationChainTxHashes
                    ?.find(item =>
                        typeof item.hash === 'string' &&
                        item.hash.length > 0,
                    )?.hash ?? null;

            sourceTxHash =
                swapDetails.originChainTxHashes
                    ?.find(item =>
                        typeof item.hash === 'string' &&
                        item.hash.length > 0,
                    )?.hash ?? null;

            if (!destinationTxHash) {
                throw new BadGatewayException(
                    'Successful settlement has no destination transaction hash',
                );
            }

            nextStatus = 'CONFIRMED';
        }

        if (providerState === 'FAILED') {
            nextStatus = 'FAILED';
        }

        if (providerState === 'REFUNDED') {
            nextStatus = 'REFUNDED';
        }

        // ======================================
        // UPDATE PAYMENT AND RECONCILE INVOICE
        // ======================================

        return this.prisma.$transaction(async tx => {
            // Lock invoice first to serialize financial updates.

            await tx.$queryRaw<Array<{ id: string }>>`
                SELECT "id"
                FROM "Invoice"
                WHERE "id" = ${payment.invoiceId}::uuid
                FOR UPDATE
            `;

            await tx.$queryRaw<Array<{ id: string }>>`
                SELECT "id"
                FROM "Payment"
                WHERE "id" = ${paymentId}::uuid
                FOR UPDATE
            `;

            const current = await tx.payment.findUnique({
                where: { id: paymentId },
            });

            if (!current) {
                throw new NotFoundException(
                    'Payment not found',
                );
            }

            // Idempotency: never credit a payment twice.

            if (current.status === 'CONFIRMED') {
                return current;
            }

            if (
                !['PENDING', 'EXPIRED'].includes(
                    current.status,
                )
            ) {
                return current;
            }

            // Avoid unnecessary database writes.

            if (
                !nextStatus &&
                current.providerStatus === providerState
            ) {
                return current;
            }

            const now = new Date();

            const updated = await tx.payment.update({
                where: { id: paymentId },

                data: {
                    ...(nextStatus
                        ? { status: nextStatus }
                        : {}),

                    providerStatus: providerState,

                    ...(nextStatus === 'CONFIRMED'
                        ? {
                            destinationTxHash:
                                destinationTxHash!,

                            sourceTxHash:
                                sourceTxHash ??
                                current.sourceTxHash,

                            confirmedAt: now,
                        }
                        : {}),

                    ...(nextStatus === 'REFUNDED'
                        ? { refundedAt: now }
                        : {}),

                    providerResponse:
                        JSON.parse(
                            JSON.stringify(providerStatus),
                        ) as Prisma.InputJsonValue,
                },
            });

            await tx.paymentEvent.create({
                data: {
                    paymentId,

                    eventType:
                        nextStatus === 'CONFIRMED'
                            ? 'PAYMENT_CONFIRMED'
                            : nextStatus === 'FAILED'
                                ? 'PAYMENT_FAILED'
                                : nextStatus === 'REFUNDED'
                                    ? 'PAYMENT_REFUNDED'
                                    : 'PROVIDER_STATUS_UPDATED',

                    previousStatus: current.status,
                    newStatus: updated.status,

                    reference:
                        providerStatus.correlationId,

                    metadata: {
                        providerStatus: providerState,
                        destinationTxHash,
                        sourceTxHash,
                    },
                },
            });

            // ==================================
            // RECONCILE INVOICE AFTER CONFIRMATION
            // ==================================

            if (nextStatus === 'CONFIRMED') {
                const invoice = await tx.invoice.findUnique({
                    where: {
                        id: payment.invoiceId,
                    },
                });

                if (!invoice) {
                    throw new NotFoundException(
                        'Invoice not found',
                    );
                }

                const confirmed =
                    await tx.payment.aggregate({
                        where: {
                            invoiceId: invoice.id,
                            status: 'CONFIRMED',
                        },

                        _sum: {
                            invoiceAmount: true,
                        },
                    });

                const paidAmount =
                    confirmed._sum.invoiceAmount ??
                    new Prisma.Decimal(0);


                const invoiceStatus =
                    paidAmount.gt(invoice.totalAmount)
                        ? 'OVERPAID'
                        : paidAmount.equals(invoice.totalAmount)
                            ? 'PAID'
                            : paidAmount.gt(0)
                                ? 'PARTIALLY_PAID'
                                : invoice.status;


                if (
                    invoice.status !== invoiceStatus &&
                    !['DRAFT', 'CANCELLED'].includes(
                        invoice.status,
                    )
                ) {
                    await tx.invoice.update({
                        where: {
                            id: invoice.id,
                        },

                        data: {
                            status: invoiceStatus,
                        },
                    });
                }
            }

            return updated;
        });
    }

    // ==========================================
    // AUTOMATIC PENDING PAYMENT MONITOR
    // ==========================================


    // ==========================================
    // AUTOMATIC PENDING PAYMENT MONITOR
    // ==========================================

    @Cron('*/30 * * * * *')
    async pollPendingPayments(): Promise<void> {
        if (this.isPolling) {
            return;
        }

        this.isPolling = true;

        try {
            const payments =
                await this.prisma.payment.findMany({
                    where: {
                        provider: 'near-intents-1click',

                        status: {
                            in: ['PENDING', 'EXPIRED'],
                        },

                        depositAddress: {
                            not: null,
                        },

                        providerCorrelationId: {
                            not: null,
                        },
                    },

                    select: {
                        id: true,
                    },

                    orderBy: [
                        {
                            lastStatusCheckedAt: {
                                sort: 'asc',
                                nulls: 'first',
                            },
                        },
                        {
                            createdAt: 'asc',
                        },
                    ],

                    take: 50,
                });

            for (const payment of payments) {
                try {
                    await this.syncPaymentStatus(payment.id);
                } catch (error) {
                    this.logger.warn(
                        `Payment synchronization failed for ${payment.id}: ${error instanceof Error
                            ? error.message
                            : 'Unknown error'
                        }`,
                    );
                } finally {
                    try {
                        await this.prisma.payment.updateMany({
                            where: {
                                id: payment.id,
                                status: {
                                    in: ['PENDING', 'EXPIRED'],
                                },
                            },

                            data: {
                                lastStatusCheckedAt: new Date(),
                            },
                        });
                    } catch (error) {
                        this.logger.error(
                            `Failed to record payment check time for ${payment.id}: ${error instanceof Error
                                ? error.message
                                : 'Unknown error'
                            }`,
                        );
                    }
                }
            }
        } finally {
            this.isPolling = false;
        }
    }

    // ==========================================
    // PUBLIC INVOICE PAYMENT STATUS
    // ==========================================

    async getPublicPaymentStatus(
        invoiceToken: string,
        paymentId: string,
    ) {
        const payment =
            await this.prisma.payment.findFirst({
                where: {
                    id: paymentId,

                    invoice: {
                        is: {
                            publicToken: invoiceToken,
                        },
                    },
                },

                select: {
                    id: true,
                    status: true,
                    providerStatus: true,
                    sourceChain: true,
                    sourceTokenSymbol: true,
                    destinationChain: true,
                    destinationTokenSymbol: true,
                    destinationAmount: true,
                    destinationTxHash: true,
                    confirmedAt: true,
                    refundedAt: true,
                    expiresAt: true,
                    createdAt: true,
                },
            });

        if (!payment) {
            throw new NotFoundException(
                'Payment not found',
            );
        }

        return payment;
    }

}
