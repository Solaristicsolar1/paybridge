
import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { PermissionsModule } from '../permissions/permissions.module';

import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { NearIntentsService } from './near-intents/near-intents.service';

@Module({
    imports: [
        DatabaseModule,
        AuthModule,
        PermissionsModule,
    ],

    controllers: [
        PaymentsController,
    ],

    providers: [
        PaymentsService,
        NearIntentsService,
    ],

    exports: [
        PaymentsService,
        NearIntentsService,
    ],
})
export class PaymentsModule { }
