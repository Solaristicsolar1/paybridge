
import { Transform } from 'class-transformer';
import {
    SUPPORTED_CURRENCIES,
} from '../../common/constants/supported-currencies';

import {
    IsNotEmpty,
    IsOptional,
    IsString,
    IsIn,
    Length,
    Matches,
} from 'class-validator';

export class CreateBusinessDto {
    @Transform(({ value }) =>
        typeof value === 'string' ? value.trim() : value,
    )
    @IsString()
    @IsNotEmpty()
    @Length(2, 160)
    name!: string;

    @Transform(({ value }) =>
        typeof value === 'string'
            ? value.trim().toUpperCase()
            : value,
    )
    @IsOptional()
    @IsString()
    @IsIn(SUPPORTED_CURRENCIES, {
        message: 'Unsupported business currency',
    })
    defaultCurrency?: string;
}
