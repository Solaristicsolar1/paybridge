
import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { MailModule } from '../mail/mail.module';

import { BusinessMembersController } from './business-members.controller';
import { BusinessMembersService } from './business-members.service';

@Module({
    imports: [
        DatabaseModule,
        AuthModule,
        PermissionsModule,
        MailModule,
    ],

    controllers: [
        BusinessMembersController,
    ],

    providers: [
        BusinessMembersService,
    ],

    exports: [
        BusinessMembersService,
    ],
})
export class BusinessMembersModule { }
