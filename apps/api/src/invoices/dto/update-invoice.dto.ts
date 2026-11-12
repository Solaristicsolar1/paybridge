import { Transform, Type } from 'class-transformer';

import {
    ArrayMinSize,
    IsArray,
    IsDateString,
    IsOptional,
    IsString,
    Matches,
    MaxLength,
    ValidateNested,
} from 'class-validator';

import { CreateInvoiceItemDto } from './create-invoice.dto';

export class UpdateInvoiceDto {
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

    @Transform(({ value }) =>
        typeof value === 'string' ? value.trim() : value,
    )
    @IsOptional()
    @IsString()
    @MaxLength(5000)
    notes?: string;

    @IsOptional()
    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => CreateInvoiceItemDto)
    items?: CreateInvoiceItemDto[];
}