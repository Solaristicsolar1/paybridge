import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { PermissionsModule } from '../permissions/permissions.module';

import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';

@Module({
    imports: [
        DatabaseModule,
        AuthModule,
        PermissionsModule,
    ],

    controllers: [
        ClientsController,
    ],

    providers: [
        ClientsService,
    ],

    exports: [
        ClientsService,
    ],
})
export class ClientsModule { }