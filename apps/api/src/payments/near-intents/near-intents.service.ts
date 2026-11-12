import {
    BadGatewayException,
    BadRequestException,
    Injectable,
    InternalServerErrorException,
} from '@nestjs/common';

import {
    DEFAULT_NEAR_INTENTS_API_URL,
    NEAR_INTENTS_TOKENS_PATH,
    NEAR_INTENTS_QUOTE_PATH,
} from './near-intents.constants';

import { NearIntentsToken } from './near-intents.types';
import { CreateNearQuoteDto } from './dto/create-quote.dto';

@Injectable()
export class NearIntentsService {

    private get baseUrl(): string {
        return (
            process.env.NEAR_INTENTS_API_URL ??
            DEFAULT_NEAR_INTENTS_API_URL
        ).replace(/\/+$/, '');
    }

    // ==========================================
    // GET SUPPORTED TOKENS
    // ==========================================

    async getSupportedTokens(): Promise<NearIntentsToken[]> {
        let response: Response;

        try {
            response = await fetch(
                `${this.baseUrl}${NEAR_INTENTS_TOKENS_PATH}`,
                {
                    method: 'GET',
                    headers: {
                        Accept: 'application/json',
                    },
                    signal: AbortSignal.timeout(15000),
                },
            );
        } catch {
            throw new BadGatewayException(
                'Unable to connect to NEAR Intents',
            );
        }

        if (!response.ok) {
            throw new BadGatewayException(
                'NEAR Intents token service returned an error',
            );
        }

        let data: unknown;

        try {
            data = await response.json();
        } catch {
            throw new BadGatewayException(
                'Invalid response received from NEAR Intents',
            );
        }

        if (!Array.isArray(data)) {
            throw new BadGatewayException(
                'Unexpected token response from NEAR Intents',
            );
        }

        return data as NearIntentsToken[];
    }

    // ==========================================
    // CONVERT HUMAN AMOUNT TO SMALLEST UNITS
    // ==========================================

    private toSmallestUnits(
        amount: string,
        decimals: number,
    ): string {
        if (
            !Number.isInteger(decimals) ||
            decimals < 0 ||
            decimals > 30
        ) {
            throw new BadRequestException(
                'Unsupported token decimal configuration',
            );
        }

        const [whole, fraction = ''] = amount.split('.');

        if (whole === undefined || whole.length === 0) {
            throw new BadRequestException(
                'Invalid token amount',
            );
        }

        if (fraction.length > decimals) {
            throw new BadRequestException(
                `Amount supports a maximum of ${decimals} decimal places`,
            );
        }

        const wholeUnits =
            BigInt(whole) * (10n ** BigInt(decimals));

        const fractionalUnits = BigInt(
            fraction.padEnd(decimals, '0') || '0',
        );

        const result = wholeUnits + fractionalUnits;

        if (result <= 0n) {
            throw new BadRequestException(
                'Amount must be greater than zero',
            );
        }

        return result.toString();
    }

    // ==========================================
    // GENERATE DRY-RUN SWAP QUOTE
    // ==========================================

    async createQuote(dto: CreateNearQuoteDto) {
        const apiKey = process.env.NEAR_INTENTS_API_KEY;

        if (!apiKey) {
            throw new InternalServerErrorException(
                'NEAR Intents API key is not configured',
            );
        }

        // Confirm that both assets exist in the supported list.
        const tokens = await this.getSupportedTokens();

        const originToken = tokens.find(
            token => token.assetId === dto.originAsset,
        );

        const destinationToken = tokens.find(
            token => token.assetId === dto.destinationAsset,
        );

        if (!originToken) {
            throw new BadRequestException(
                'Unsupported source asset',
            );
        }

        if (!destinationToken) {
            throw new BadRequestException(
                'Unsupported destination asset',
            );
        }

        if (dto.originAsset === dto.destinationAsset) {
            throw new BadRequestException(
                'Source and destination assets must be different',
            );
        }

        const amount = this.toSmallestUnits(
            dto.amount,
            originToken.decimals,
        );

        const deadline = new Date(
            Date.now() + 3 * 60 * 1000,
        ).toISOString();

        const payload = {
            dry: true,
            swapType: 'EXACT_INPUT',

            slippageTolerance:
                dto.slippageTolerance ?? 100,

            originAsset: originToken.assetId,
            depositType: 'ORIGIN_CHAIN',

            destinationAsset: destinationToken.assetId,

            amount,

            recipient: dto.recipient,
            recipientType: 'DESTINATION_CHAIN',

            refundTo: dto.refundTo,
            refundType: 'ORIGIN_CHAIN',

            deadline,
        };

        let response: Response;

        try {
            response = await fetch(
                `${this.baseUrl}${NEAR_INTENTS_QUOTE_PATH}`,
                {
                    method: 'POST',

                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                        'X-API-Key': apiKey,
                    },

                    body: JSON.stringify(payload),

                    signal: AbortSignal.timeout(20000),
                },
            );
        } catch {
            throw new BadGatewayException(
                'Unable to connect to NEAR Intents quote service',
            );
        }

        if (!response.ok) {
            const providerResponse =
                (await response.text()).slice(0, 500);

            throw new BadGatewayException({
                message: 'NEAR Intents quote request failed',
                providerStatus: response.status,
                providerResponse,
            });
        }

        let quote: unknown;

        try {
            quote = await response.json();
        } catch {
            throw new BadGatewayException(
                'Invalid quote response received from NEAR Intents',
            );
        }

        return {
            provider: 'NEAR_INTENTS',
            dryRun: true,

            sourceAsset: {
                assetId: originToken.assetId,
                symbol: originToken.symbol,
                blockchain: originToken.blockchain,
                decimals: originToken.decimals,
            },

            destinationAsset: {
                assetId: destinationToken.assetId,
                symbol: destinationToken.symbol,
                blockchain: destinationToken.blockchain,
                decimals: destinationToken.decimals,
            },

            requestedAmount: dto.amount,
            amountInSmallestUnits: amount,

            quote,
        };
    }
}
