import { Transform } from 'class-transformer';

import {
    IsEmail,
    IsOptional,
    IsString,
    MaxLength,
} from 'class-validator';

const trimOptional = ({ value }: { value: unknown }) =>
    typeof value === 'string'
        ? value.trim() || undefined
        : value;

export class UpdateClientDto {
    @Transform(trimOptional)
    @IsOptional()
    @IsString()
    @MaxLength(160)
    name?: string;

    @Transform(trimOptional)
    @IsOptional()
    @IsEmail()
    @MaxLength(320)
    email?: string;

    @Transform(trimOptional)
    @IsOptional()
    @IsString()
    @MaxLength(30)
    phone?: string;

    @Transform(trimOptional)
    @IsOptional()
    @IsString()
    @MaxLength(160)
    companyName?: string;

    @Transform(trimOptional)
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    billingAddress?: string;

    @Transform(trimOptional)
    @IsOptional()
    @IsString()
    @MaxLength(5000)
    notes?: string;
}