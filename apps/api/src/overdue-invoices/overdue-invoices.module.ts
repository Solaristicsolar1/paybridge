import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';

import {
    OverdueInvoicesService,
} from './overdue-invoices.service';

@Module({
    imports: [
        DatabaseModule,
    ],
    providers: [
        OverdueInvoicesService,
    ],
})
export class OverdueInvoicesModule { }