
import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { PermissionsModule } from '../permissions/permissions.module';

import { BusinessesController } from './businesses.controller';
import { BusinessesService } from './businesses.service';

@Module({
    imports: [
        DatabaseModule,
        AuthModule,
        PermissionsModule,
    ],

    controllers: [
        BusinessesController,
    ],

    providers: [
        BusinessesService,
    ],

    exports: [
        BusinessesService,
    ],
})
export class BusinessesModule { }
