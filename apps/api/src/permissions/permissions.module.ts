
import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';
import { BusinessAccessGuard } from './business-access.guard';

@Module({
    imports: [
        DatabaseModule,
    ],

    providers: [
        BusinessAccessGuard,
    ],

    exports: [
        BusinessAccessGuard,
    ],
})
export class PermissionsModule { }
