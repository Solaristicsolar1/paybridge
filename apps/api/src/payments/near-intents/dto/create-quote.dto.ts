import { Transform, Type } from 'class-transformer';

import {
    IsInt,
    IsOptional,
    IsString,
    Matches,
    Max,
    MaxLength,
    Min,
} from 'class-validator';

const trimString = ({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value;

export class CreateNearQuoteDto {
    @Transform(trimString)
    @IsString()
    @MaxLength(300)
    originAsset!: string;

    @Transform(trimString)
    @IsString()
    @MaxLength(300)
    destinationAsset!: string;

    @Transform(trimString)
    @IsString()
    @Matches(/^(?:0|[1-9]\d*)(?:\.\d+)?$/)
    @MaxLength(80)
    amount!: string;

    @Transform(trimString)
    @IsString()
    @MaxLength(256)
    recipient!: string;

    @Transform(trimString)
    @IsString()
    @MaxLength(256)
    refundTo!: string;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(5000)
    slippageTolerance = 100;
}
