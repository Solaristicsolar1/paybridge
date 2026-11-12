import { Transform } from 'class-transformer';

import {
    IsString,
    Matches,
} from 'class-validator';

export class UpdateBusinessPayoutDto {
    @Transform(({ value }) =>
        typeof value === 'string' ? value.trim() : value,
    )
    @IsString()
    @Matches(/^0x[a-fA-F0-9]{40}$/, {
        message: 'Enter a valid EVM wallet address',
    })
    basePayoutAddress!: string;
}
