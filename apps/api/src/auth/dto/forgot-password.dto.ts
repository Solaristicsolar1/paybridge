
import { Transform } from 'class-transformer';

import {
    IsEmail,
    IsString,
    MaxLength,
} from 'class-validator';

export class ForgotPasswordDto {
    @Transform(({ value }) =>
        typeof value === 'string'
            ? value.trim().toLowerCase()
            : value,
    )
    @IsString()
    @IsEmail()
    @MaxLength(320)
    email!: string;
}
