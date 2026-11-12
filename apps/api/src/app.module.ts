import { Module } from '@nestjs/common';

import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { BusinessesModule } from './businesses/businesses.module';
import { BusinessMembersModule } from './business-members/business-members.module';
import { ClientsModule } from './clients/clients.module';
import { InvoicesModule } from './invoices/invoices.module';
import { ScheduleModule } from '@nestjs/schedule';
import {
  OverdueInvoicesModule,
} from './overdue-invoices/overdue-invoices.module';
import { PaymentsModule } from './payments/payments.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    DatabaseModule,
    HealthModule,
    AuthModule,
    BusinessesModule,
    BusinessMembersModule,
    ClientsModule,
    InvoicesModule,
    OverdueInvoicesModule,
    PaymentsModule,
  ],
})
export class AppModule { }