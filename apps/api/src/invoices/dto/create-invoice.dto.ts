import { Transform, Type } from 'class-transformer';
import {
    SUPPORTED_CURRENCIES,
} from '../../common/constants/supported-currencies';

import {
    ArrayMinSize,
    IsArray,
    IsIn,
    IsDateString,
    IsOptional,
    IsString,
    Matches,
    MaxLength,
    ValidateNested,
} from 'class-validator';

export class CreateInvoiceItemDto {
    @Transform(({ value }) =>
        typeof value === 'string' ? value.trim() : value,
    )
    @IsString()
    @MaxLength(500)
    description!: string;

    @IsString()
    @Matches(/^(?=.*[1-9])\d+(\.\d{1,8})?$/)
    quantity!: string;

    @IsString()
    @Matches(/^\d+(\.\d{1,8})?$/)
    unitPrice!: string;
}

export class CreateInvoiceDto {
    @IsString()
    @Matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
    clientId!: string;

    @Transform(({ value }) =>
        typeof value === 'string'
            ? value.trim().toUpperCase()
            : value,
    )
    @IsOptional()
    @IsString()
    @IsIn(SUPPORTED_CURRENCIES, {
        message: 'Unsupported invoice currency',
    })
    currency?: string;

    @IsOptional()
    @IsDateString()
    issueDate?: string;

    @IsOptional()
    @IsDateString()
    dueDate?: string;

    @IsOptional()
    @IsString()
    @Matches(/^(?:0|[1-9]\d*)(?:\.\d{1,4})?$/)
    taxRate?: string;

    @IsOptional()
    @IsString()
    @MaxLength(5000)
    notes?: string;

    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => CreateInvoiceItemDto)
    items!: CreateInvoiceItemDto[];
}