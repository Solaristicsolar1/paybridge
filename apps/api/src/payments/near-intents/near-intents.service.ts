
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
    NEAR_INTENTS_STATUS_PATH,
    NEAR_INTENTS_DEPOSIT_TYPE,
    NEAR_INTENTS_RECIPIENT_TYPE,
    NEAR_INTENTS_REFUND_TYPE,
    NEAR_INTENTS_DESTINATION_CHAIN,
    NEAR_INTENTS_DESTINATION_SYMBOL,
} from './near-intents.constants';

import {
    NearIntentsToken,
    NearIntentsQuoteResponse,
    NearIntentsSwapStatus,
    CreateNearLiveQuoteInput,
} from './near-intents.types';

import { CreateNearQuoteDto } from './dto/create-quote.dto';

function isRecord(
    value: unknown,
): value is Record<string, unknown> {
    return (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value)
    );
}

@Injectable()
export class NearIntentsService {

    private get baseUrl(): string {
        return (
            process.env.NEAR_INTENTS_API_URL ??
            DEFAULT_NEAR_INTENTS_API_URL
        ).replace(/\/+$/, '');
    }

    private get apiKey(): string {
        const key = process.env.NEAR_INTENTS_API_KEY;

        if (!key) {
            throw new InternalServerErrorException(
                'NEAR Intents API key is not configured',
            );
        }

        return key;
    }

    // ==========================================
    // PROVIDER REQUEST HELPER
    // ==========================================

    private async providerRequest(
        path: string,
        options: RequestInit = {},
    ): Promise<unknown> {
        let response: Response;

        try {
            response = await fetch(
                `${this.baseUrl}${path}`,
                {
                    ...options,
                    headers: {
                        Accept: 'application/json',
                        ...(options.body && {
                            'Content-Type': 'application/json',
                        }),
                        ...options.headers,
                    },
                    signal: AbortSignal.timeout(20000),
                },
            );
        } catch {
            throw new BadGatewayException(
                'Unable to connect to NEAR Intents',
            );
        }

        if (!response.ok) {
            const providerResponse =
                (await response.text()).slice(0, 500);

            throw new BadGatewayException({
                message: 'NEAR Intents request failed',
                providerStatus: response.status,
                providerResponse,
            });
        }

        try {
            return await response.json();
        } catch {
            throw new BadGatewayException(
                'Invalid response received from NEAR Intents',
            );
        }
    }

    // ==========================================
    // GET SUPPORTED TOKENS
    // ==========================================

    async getSupportedTokens(): Promise<NearIntentsToken[]> {
        const data = await this.providerRequest(
            NEAR_INTENTS_TOKENS_PATH,
            {
                method: 'GET',
            },
        );

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

        if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(amount)) {
            throw new BadRequestException(
                'Invalid token amount',
            );
        }

        const [whole, fraction = ''] = amount.split('.');

        if (whole === undefined) {
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
    // VALIDATE QUOTE RESPONSE
    // ==========================================

    private validateQuoteResponse(
        data: unknown,
    ): NearIntentsQuoteResponse {
        if (!isRecord(data) || !isRecord(data.quote)) {
            throw new BadGatewayException(
                'Invalid quote structure received from NEAR Intents',
            );
        }

        const quote = data.quote;

        if (
            typeof data.correlationId !== 'string' ||
            typeof data.timestamp !== 'string' ||
            typeof data.signature !== 'string' ||
            typeof quote.amountIn !== 'string' ||
            typeof quote.amountOut !== 'string'
        ) {
            throw new BadGatewayException(
                'Incomplete quote response received from NEAR Intents',
            );
        }

        return data as unknown as NearIntentsQuoteResponse;
    }

    // ==========================================
    // GENERATE DRY-RUN QUOTE
    // ==========================================

    async createQuote(dto: CreateNearQuoteDto) {
        const tokens = await this.getSupportedTokens();

        const originToken = tokens.find(
            token => token.assetId === dto.originAsset,
        );

        const destinationToken = tokens.find(
            token => token.assetId === dto.destinationAsset,
        );

        if (!originToken || !destinationToken) {
            throw new BadRequestException(
                'Unsupported source or destination asset',
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
            depositType: NEAR_INTENTS_DEPOSIT_TYPE,

            destinationAsset: destinationToken.assetId,

            amount,

            recipient: dto.recipient,
            recipientType: NEAR_INTENTS_RECIPIENT_TYPE,

            refundTo: dto.refundTo,
            refundType: NEAR_INTENTS_REFUND_TYPE,

            deadline,
        };

        const data = await this.providerRequest(
            NEAR_INTENTS_QUOTE_PATH,
            {
                method: 'POST',
                headers: {
                    'X-API-Key': this.apiKey,
                },
                body: JSON.stringify(payload),
            },
        );

        return {
            provider: 'NEAR_INTENTS',
            dryRun: true,
            sourceAsset: originToken,
            destinationAsset: destinationToken,
            requestedAmount: dto.amount,
            amountInSmallestUnits: amount,
            quote: data,
        };
    }

    // ==========================================
    // GENERATE LIVE EXACT-OUTPUT QUOTE
    // ==========================================

    async createLiveQuote(
        input: CreateNearLiveQuoteInput,
    ) {
        const tokens = await this.getSupportedTokens();

        const originToken = tokens.find(
            token => token.assetId === input.originAsset,
        );

        const destinationToken = tokens.find(
            token => token.assetId === input.destinationAsset,
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

        if (
            destinationToken.blockchain !==
            NEAR_INTENTS_DESTINATION_CHAIN ||
            destinationToken.symbol.toUpperCase() !==
            NEAR_INTENTS_DESTINATION_SYMBOL
        ) {
            throw new BadRequestException(
                'Destination must be USDC on Base',
            );
        }

        if (input.originAsset === input.destinationAsset) {
            throw new BadRequestException(
                'Source and destination assets must be different',
            );
        }

        if (
            !input.recipient ||
            !input.refundTo
        ) {
            throw new BadRequestException(
                'Recipient and refund addresses are required',
            );
        }

        const amount = this.toSmallestUnits(
            input.destinationAmount,
            destinationToken.decimals,
        );

        const deadline = new Date(
            Date.now() + 30 * 60 * 1000,
        ).toISOString();

        const payload = {
            dry: false,

            swapType: 'EXACT_OUTPUT',

            slippageTolerance:
                input.slippageTolerance ?? 100,

            originAsset: originToken.assetId,

            depositType: NEAR_INTENTS_DEPOSIT_TYPE,

            destinationAsset: destinationToken.assetId,

            amount,

            recipient: input.recipient,

            recipientType: NEAR_INTENTS_RECIPIENT_TYPE,

            refundTo: input.refundTo,

            refundType: NEAR_INTENTS_REFUND_TYPE,

            deadline,

            confidentiality: 'public',
        };

        const data = await this.providerRequest(
            NEAR_INTENTS_QUOTE_PATH,
            {
                method: 'POST',
                headers: {
                    'X-API-Key': this.apiKey,
                },
                body: JSON.stringify(payload),
            },
        );

        const liveQuote = this.validateQuoteResponse(data);

        if (
            typeof liveQuote.quote.depositAddress !== 'string' ||
            liveQuote.quote.depositAddress.length === 0
        ) {
            throw new BadGatewayException(
                'NEAR Intents did not return a deposit address',
            );
        }

        if (
            liveQuote.quote.amountOut !== amount
        ) {
            throw new BadGatewayException(
                'NEAR Intents returned an unexpected destination amount',
            );
        }

        if (
            !/^\d+$/.test(liveQuote.quote.amountIn) ||
            (
                liveQuote.quote.minAmountIn !== undefined &&
                !/^\d+$/.test(liveQuote.quote.minAmountIn)
            )
        ) {
            throw new BadGatewayException(
                'NEAR Intents returned invalid input amounts',
            );
        }

        return {
            provider: 'NEAR_INTENTS',

            dryRun: false,

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

            requestedDestinationAmount:
                input.destinationAmount,

            amountOutSmallestUnits: amount,

            quote: liveQuote,
        };
    }

    // ==========================================
    // GET LIVE SWAP STATUS
    // ==========================================

    async getSwapStatus(
        depositAddress: string,
        depositMemo?: string,
    ): Promise<NearIntentsSwapStatus> {
        if (
            !depositAddress ||
            depositAddress.trim().length === 0
        ) {
            throw new BadRequestException(
                'Deposit address is required',
            );
        }

        const query = new URLSearchParams({
            depositAddress: depositAddress.trim(),
        });

        if (depositMemo) {
            query.set('depositMemo', depositMemo);
        }

        const data = await this.providerRequest(
            `${NEAR_INTENTS_STATUS_PATH}?${query.toString()}`,
            {
                method: 'GET',
                headers: {
                    'X-API-Key': this.apiKey,
                },
            },
        );

        if (
            !isRecord(data) ||
            typeof data.status !== 'string'
        ) {
            throw new BadGatewayException(
                'Invalid payment status response from NEAR Intents',
            );
        }

        return data as unknown as NearIntentsSwapStatus;
    }
}
