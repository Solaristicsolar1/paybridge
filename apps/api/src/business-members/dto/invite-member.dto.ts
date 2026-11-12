
import { Transform } from 'class-transformer';

import {
    IsEmail,
    IsIn,
    IsString,
} from 'class-validator';

export class InviteMemberDto {
    @Transform(({ value }) =>
        typeof value === 'string'
            ? value.trim().toLowerCase()
            : value,
    )
    @IsString()
    @IsEmail()
    email!: string;

    @IsIn(['ADMIN', 'ACCOUNTANT', 'MEMBER'])
    role!: 'ADMIN' | 'ACCOUNTANT' | 'MEMBER';
}
