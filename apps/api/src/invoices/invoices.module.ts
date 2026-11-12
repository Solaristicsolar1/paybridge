import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { PermissionsModule } from '../permissions/permissions.module';

import {
    InvoicesController,
    PublicInvoicesController,
} from './invoices.controller';

import { InvoicesService } from './invoices.service';

@Module({
    imports: [
        DatabaseModule,
        AuthModule,
        PermissionsModule,
    ],

    controllers: [
        InvoicesController,
        PublicInvoicesController,
    ],

    providers: [
        InvoicesService,
    ],

    exports: [
        InvoicesService,
    ],
})
export class InvoicesModule {}
