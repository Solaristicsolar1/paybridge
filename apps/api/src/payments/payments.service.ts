
import {
    Injectable,
    NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';

import { ListPaymentsDto } from './dto/list-payments.dto';

@Injectable()
export class PaymentsService {
    constructor(
        private readonly prisma: PrismaService,
    ) { }

    // LIST BUSINESS PAYMENTS
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

    // GET SINGLE BUSINESS PAYMENT
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
}
