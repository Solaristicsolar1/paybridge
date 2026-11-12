
import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';

import {
    isSupportedCurrency,
} from '../common/constants/supported-currencies';

import { Prisma } from '@paybridge/database';

import { PrismaService } from '../database/prisma.service';

import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { ListInvoicesDto } from './dto/list-invoices.dto';

const MONEY_SCALE = 8;

const invoiceInclude = {
    client: true,
    items: {
        orderBy: {
            position: 'asc' as const,
        },
    },
    installments: {
        orderBy: {
            installmentNumber: 'asc' as const,
        },
    },
    _count: {
        select: {
            payments: true,
        },
    },
};

@Injectable()
export class InvoicesService {
    constructor(
        private readonly prisma: PrismaService,
    ) { }

    // ==========================================
    // DECIMAL CALCULATIONS
    // ==========================================

    private money(value: Prisma.Decimal) {
        return value.toDecimalPlaces(
            MONEY_SCALE,
            Prisma.Decimal.ROUND_HALF_UP,
        );
    }

    private calculateItems(
        items: CreateInvoiceDto['items'],
    ) {
        let subtotal = new Prisma.Decimal(0);

        const calculatedItems = items.map((item, index) => {
            const quantity = new Prisma.Decimal(item.quantity);
            const unitPrice = new Prisma.Decimal(item.unitPrice);

            if (
                !quantity.isFinite() ||
                !unitPrice.isFinite() ||
                quantity.lte(0) ||
                unitPrice.isNegative()
            ) {
                throw new BadRequestException(
                    'Invalid invoice item quantity or price',
                );
            }

            const lineTotal = this.money(
                quantity.mul(unitPrice),
            );

            subtotal = subtotal.plus(lineTotal);

            return {
                description: item.description,
                quantity,
                unitPrice,
                lineTotal,
                position: index,
            };
        });

        return {
            items: calculatedItems,
            subtotal: this.money(subtotal),
        };
    }

    private calculateTax(
        subtotal: Prisma.Decimal,
        taxRate: string,
    ) {
        const rate = new Prisma.Decimal(taxRate);

        if (
            !rate.isFinite() ||
            rate.isNegative() ||
            rate.gt(100)
        ) {
            throw new BadRequestException(
                'Tax rate must be between 0 and 100',
            );
        }

        return this.money(
            subtotal.mul(rate).div(100),
        );
    }

    private validateDates(
        issueDate: Date,
        dueDate?: Date,
    ) {
        if (
            dueDate &&
            dueDate.getTime() < issueDate.getTime()
        ) {
            throw new BadRequestException(
                'Invoice due date cannot be earlier than issue date',
            );
        }
    }

    // ==========================================
    // GENERATE INVOICE NUMBER
    // ==========================================

    private async generateInvoiceNumber(
        tx: Prisma.TransactionClient,
        businessId: string,
        issueDate: Date,
    ) {
        const year = issueDate.getUTCFullYear();

        const sequence = await tx.invoiceNumberSequence.upsert({
            where: {
                businessId_year: {
                    businessId,
                    year,
                },
            },

            create: {
                businessId,
                year,
                nextNumber: 2,
            },

            update: {
                nextNumber: {
                    increment: 1,
                },
            },

            select: {
                nextNumber: true,
            },
        });

        const currentNumber = sequence.nextNumber - 1;

        return `INV-${year}-${String(currentNumber).padStart(6, '0')}`;
    }

    // ==========================================
    // CREATE DRAFT INVOICE
    // ==========================================

    async createInvoice(
        businessId: string,
        userId: string,
        dto: CreateInvoiceDto,
    ) {
        const issueDate = dto.issueDate
            ? new Date(dto.issueDate)
            : new Date();

        const dueDate = dto.dueDate
            ? new Date(dto.dueDate)
            : undefined;

        this.validateDates(issueDate, dueDate);

        const business = await this.prisma.business.findUnique({
            where: {
                id: businessId,
            },
            select: {
                defaultCurrency: true,
            },
        });

        if (!business) {
            throw new NotFoundException(
                'Business not found',
            );
        }

        const client = await this.prisma.client.findFirst({
            where: {
                id: dto.clientId,
                businessId,
            },
            select: {
                id: true,
            },
        });

        if (!client) {
            throw new NotFoundException(
                'Client not found in this business',
            );
        }

        const currency = dto.currency ?? business.defaultCurrency;

        if (!isSupportedCurrency(currency)) {
            throw new BadRequestException(
                'The selected invoice currency is not supported',
            );
        }
        const { items, subtotal } = this.calculateItems(
            dto.items,
        );

        const taxAmount = this.calculateTax(
            subtotal,
            dto.taxRate ?? '0',
        );

        const totalAmount = this.money(
            subtotal.plus(taxAmount),
        );

        return this.prisma.$transaction(async (tx) => {
            const invoiceNumber = await this.generateInvoiceNumber(
                tx,
                businessId,
                issueDate,
            );

            return tx.invoice.create({
                data: {
                    businessId,
                    clientId: dto.clientId,
                    createdById: userId,
                    invoiceNumber,
                    currency,
                    issueDate,
                    ...(dueDate && { dueDate }),
                    subtotal,
                    taxRate: new Prisma.Decimal(dto.taxRate ?? '0'),
                    taxAmount,
                    totalAmount,
                    ...(dto.notes !== undefined && {
                        notes: dto.notes,
                    }),
                    items: {
                        create: items,
                    },
                },
                include: invoiceInclude,
            });
        });
    }

    // ==========================================
    // LIST INVOICES
    // ==========================================

    async getInvoices(
        businessId: string,
        query: ListInvoicesDto,
    ) {
        const page = query.page;
        const limit = query.limit;

        const search = query.search?.trim();

        const where: Prisma.InvoiceWhereInput = {
            businessId,

            ...(query.status && {
                status: query.status as
                    | 'DRAFT'
                    | 'SENT'
                    | 'PARTIALLY_PAID'
                    | 'PAID'
                    | 'OVERDUE'
                    | 'CANCELLED',
            }),

            ...(query.fromDate || query.toDate
                ? {
                    issueDate: {
                        ...(query.fromDate && {
                            gte: new Date(query.fromDate),
                        }),
                        ...(query.toDate && {
                            lte: new Date(query.toDate),
                        }),
                    },
                }
                : {}),

            ...(search && {
                OR: [
                    {
                        invoiceNumber: {
                            contains: search,
                            mode: 'insensitive',
                        },
                    },
                    {
                        client: {
                            is: {
                                name: {
                                    contains: search,
                                    mode: 'insensitive',
                                },
                            },
                        },
                    },
                    {
                        client: {
                            is: {
                                email: {
                                    contains: search,
                                    mode: 'insensitive',
                                },
                            },
                        },
                    },
                ],
            }),
        };

        const [data, total] = await Promise.all([
            this.prisma.invoice.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: {
                    createdAt: 'desc',
                },
                include: invoiceInclude,
            }),

            this.prisma.invoice.count({
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
    // GET SINGLE INVOICE
    // ==========================================

    async getInvoice(
        businessId: string,
        invoiceId: string,
    ) {
        const invoice = await this.prisma.invoice.findFirst({
            where: {
                id: invoiceId,
                businessId,
            },
            include: invoiceInclude,
        });

        if (!invoice) {
            throw new NotFoundException(
                'Invoice not found',
            );
        }

        return invoice;
    }


    // ==========================================
    // UPDATE DRAFT INVOICE
    // ==========================================

    async updateInvoice(
        businessId: string,
        invoiceId: string,
        dto: UpdateInvoiceDto,
    ) {
        return this.prisma.$transaction(async (tx) => {

            // Lock invoice row to prevent concurrent
            // modifications by other operations using
            // the same locking convention.

            await tx.$queryRaw<Array<{ id: string }>>`
                SELECT "id"
                FROM "Invoice"
                WHERE "id" = ${invoiceId}::uuid
                  AND "businessId" = ${businessId}::uuid
                FOR UPDATE
            `;

            const invoice = await tx.invoice.findFirst({
                where: {
                    id: invoiceId,
                    businessId,
                },
            });

            if (!invoice) {
                throw new NotFoundException(
                    'Invoice not found',
                );
            }

            if (invoice.status !== 'DRAFT') {
                throw new ConflictException(
                    'Only draft invoices can be updated',
                );
            }

            // Any payment record means financial history
            // exists. Do not allow invoice modifications.

            const existingPayment =
                await tx.payment.findFirst({
                    where: {
                        invoiceId,
                    },
                    select: {
                        id: true,
                        status: true,
                    },
                });

            if (existingPayment) {
                throw new ConflictException(
                    'This invoice cannot be edited because payment history already exists',
                );
            }

            // Identify changes affecting invoice finances.

            const financialFieldsChanged =
                dto.issueDate !== undefined ||
                dto.dueDate !== undefined ||
                dto.taxRate !== undefined ||
                dto.items !== undefined;

            // Existing installments must retain their
            // original financial schedule.

            if (financialFieldsChanged) {
                const existingInstallment =
                    await tx.installment.findFirst({
                        where: {
                            invoiceId,
                        },
                        select: {
                            id: true,
                        },
                    });

                if (existingInstallment) {
                    throw new ConflictException(
                        'Financial details cannot be changed while installments exist',
                    );
                }
            }

            // Validate dates.

            const issueDate = dto.issueDate
                ? new Date(dto.issueDate)
                : invoice.issueDate;

            const dueDate = dto.dueDate
                ? new Date(dto.dueDate)
                : invoice.dueDate ?? undefined;

            this.validateDates(issueDate, dueDate);

            // Preserve the existing tax rate unless
            // a new rate is explicitly supplied.

            const taxRate = dto.taxRate !== undefined
                ? new Prisma.Decimal(dto.taxRate)
                : invoice.taxRate;

            let subtotal = invoice.subtotal;

            let calculatedItems:
                ReturnType<InvoicesService['calculateItems']>['items']
                | undefined;

            // Recalculate invoice items when supplied.

            if (dto.items !== undefined) {
                const calculated = this.calculateItems(
                    dto.items,
                );

                subtotal = calculated.subtotal;
                calculatedItems = calculated.items;
            }

            // Always calculate tax from the stored
            // or newly supplied tax rate.

            const taxAmount = this.calculateTax(
                subtotal,
                taxRate.toString(),
            );

            const totalAmount = this.money(
                subtotal.plus(taxAmount),
            );

            // Update invoice atomically.

            return tx.invoice.update({
                where: {
                    id: invoiceId,
                },

                data: {
                    issueDate,
                    dueDate: dueDate ?? null,
                    subtotal,
                    taxRate,
                    taxAmount,
                    totalAmount,

                    ...(dto.notes !== undefined && {
                        notes: dto.notes,
                    }),

                    ...(calculatedItems && {
                        items: {
                            deleteMany: {},
                            create: calculatedItems,
                        },
                    }),
                },

                include: invoiceInclude,
            });
        });
    }



    // ==========================================
    // ISSUE INVOICE
    // ==========================================

    async issueInvoice(
        businessId: string,
        invoiceId: string,
    ) {
        return this.prisma.$transaction(async (tx) => {

            // Lock invoice row to prevent concurrent
            // updates, cancellations and issuance.

            await tx.$queryRaw<Array<{ id: string }>>`
                SELECT "id"
                FROM "Invoice"
                WHERE "id" = ${invoiceId}::uuid
                  AND "businessId" = ${businessId}::uuid
                FOR UPDATE
            `;

            const invoice = await tx.invoice.findFirst({
                where: {
                    id: invoiceId,
                    businessId,
                },
            });

            if (!invoice) {
                throw new NotFoundException(
                    'Invoice not found',
                );
            }

            if (invoice.status !== 'DRAFT') {
                throw new ConflictException(
                    'Only draft invoices can be issued',
                );
            }

            // An invoice must contain at least one item.

            const itemCount = await tx.invoiceItem.count({
                where: {
                    invoiceId,
                },
            });

            if (itemCount === 0) {
                throw new BadRequestException(
                    'An invoice must contain at least one item before it can be issued',
                );
            }

            // Invoice must have a positive total.

            if (invoice.totalAmount.lte(0)) {
                throw new BadRequestException(
                    'Invoice total must be greater than zero',
                );
            }

            // Issue invoice.

            return tx.invoice.update({
                where: {
                    id: invoiceId,
                },
                data: {
                    status: 'SENT',
                },
                include: invoiceInclude,
            });
        });
    }

    // ==========================================
    // CANCEL INVOICE
    // ==========================================

    async cancelInvoice(
        businessId: string,
        invoiceId: string,
    ) {
        return this.prisma.$transaction(async (tx) => {

            // Lock the invoice row to prevent concurrent
            // cancellation and financial operations.
            await tx.$queryRaw<Array<{ id: string }>>`
                SELECT "id"
                FROM "Invoice"
                WHERE "id" = ${invoiceId}::uuid
                  AND "businessId" = ${businessId}::uuid
                FOR UPDATE
            `;

            const invoice = await tx.invoice.findFirst({
                where: {
                    id: invoiceId,
                    businessId,
                },
            });

            if (!invoice) {
                throw new NotFoundException(
                    'Invoice not found',
                );
            }

            if (
                invoice.status !== 'DRAFT' &&
                invoice.status !== 'SENT'
            ) {
                throw new ConflictException(
                    'This invoice cannot be cancelled in its current status',
                );
            }

            // Pending payments may still settle.
            // Confirmed and refunded payments have financial history.
            const protectedPayment =
                await tx.payment.findFirst({
                    where: {
                        invoiceId,
                        status: {
                            in: [
                                'PENDING',
                                'CONFIRMED',
                                'REFUNDED',
                            ],
                        },
                    },
                    select: {
                        id: true,
                        status: true,
                    },
                });

            if (protectedPayment) {
                throw new ConflictException(
                    `This invoice cannot be cancelled because it has a ${protectedPayment.status.toLowerCase()} payment record`,
                );
            }

            // Never cancel an invoice with paid or partially
            // paid installments.
            const protectedInstallment =
                await tx.installment.findFirst({
                    where: {
                        invoiceId,
                        status: {
                            in: [
                                'PARTIALLY_PAID',
                                'PAID',
                            ],
                        },
                    },
                    select: {
                        id: true,
                        status: true,
                    },
                });

            if (protectedInstallment) {
                throw new ConflictException(
                    `This invoice cannot be cancelled because it has a ${protectedInstallment.status.toLowerCase()} installment`,
                );
            }

            // Cancel unpaid installments as part of the
            // same database transaction.
            await tx.installment.updateMany({
                where: {
                    invoiceId,
                    status: {
                        in: [
                            'SCHEDULED',
                            'DUE',
                            'OVERDUE',
                        ],
                    },
                },
                data: {
                    status: 'CANCELLED',
                },
            });

            // Finally cancel the invoice.
            return tx.invoice.update({
                where: {
                    id: invoiceId,
                },
                data: {
                    status: 'CANCELLED',
                },
                include: invoiceInclude,
            });
        });
    }


    // ==========================================
    // PUBLIC INVOICE VIEW
    // ==========================================

    async getPublicInvoice(token: string) {
        const invoice = await this.prisma.invoice.findFirst({
            where: {
                publicToken: token,
                status: {
                    in: [
                        'SENT',
                        'PARTIALLY_PAID',
                        'PAID',
                        'OVERDUE',
                    ],
                },
            },
            select: {
                invoiceNumber: true,
                status: true,
                currency: true,
                issueDate: true,
                dueDate: true,
                subtotal: true,
                taxRate: true,
                taxAmount: true,
                totalAmount: true,
                notes: true,
                client: {
                    select: {
                        name: true,
                        companyName: true,
                        billingAddress: true,
                    },
                },
                items: {
                    orderBy: {
                        position: 'asc',
                    },
                    select: {
                        description: true,
                        quantity: true,
                        unitPrice: true,
                        lineTotal: true,
                    },
                },
            },
        });

        if (!invoice) {
            throw new NotFoundException(
                'Invoice not found',
            );
        }

        return invoice;
    }
}
