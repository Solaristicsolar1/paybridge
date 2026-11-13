
import { Transform, Type } from 'class-transformer';

import {
    IsInt,
    IsString,
    Matches,
    Max,
    MaxLength,
    Min,
} from 'class-validator';

const trimString = ({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value;

export class CreateInvoiceCheckoutDto {
    @Transform(trimString)
    @IsString()
    @MaxLength(300)
    originAsset!: string;

    @Transform(trimString)
    @IsString()
    @MaxLength(256)
    @Matches(/^0x[a-fA-F0-9]{40}$/, {
        message: 'Enter a valid EVM refund wallet address',
    })
    refundTo!: string;

    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(5000)
    slippageTolerance = 100;
}
