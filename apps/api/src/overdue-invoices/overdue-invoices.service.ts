
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { PrismaService } from '../database/prisma.service';

@Injectable()
export class OverdueInvoicesService {
    private readonly logger = new Logger(
        OverdueInvoicesService.name,
    );

    constructor(
        private readonly prisma: PrismaService,
    ) { }

    // Run daily at 00:05 UTC.
    @Cron('5 0 * * *', {
        name: 'process-overdue-invoices',
        timeZone: 'UTC',
    })
    async processOverdueInvoices(): Promise<number> {
        const now = new Date();

        const startOfToday = new Date(
            Date.UTC(
                now.getUTCFullYear(),
                now.getUTCMonth(),
                now.getUTCDate(),
            ),
        );

        const result = await this.prisma.invoice.updateMany({
            where: {
                status: {
                    in: ['SENT', 'PARTIALLY_PAID'],
                },
                dueDate: {
                    lt: startOfToday,
                },
            },
            data: {
                status: 'OVERDUE',
            },
        });

        this.logger.log(
            `Overdue processing completed. ${result.count} invoice(s) updated.`,
        );

        return result.count;
    }
}
