
export interface NearIntentsToken {
    assetId: string;
    decimals: number;
    blockchain: string;
    symbol: string;
    price?: number;
    priceUpdatedAt?: string;
    contractAddress?: string | null;
}

export interface NearIntentsQuote {
    depositAddress?: string;
    depositMemo?: string;

    amountIn: string;
    amountInFormatted?: string;
    amountOut: string;
    amountOutFormatted?: string;

    minAmountIn?: string;
    maxAmountIn?: string;
    minAmountOut?: string;

    deadline?: string;
    timeWhenInactive?: string;
    timeEstimate?: number;

    refundFee?: string;
    withdrawFee?: string;
}

export interface NearIntentsQuoteResponse {
    correlationId: string;
    timestamp: string;
    signature: string;

    quoteRequest: Record<string, unknown>;

    quote: NearIntentsQuote;
}

export interface NearIntentsSwapStatus {
    correlationId: string;
    status:
    | 'KNOWN_DEPOSIT_TX'
    | 'PENDING_DEPOSIT'
    | 'PROCESSING'
    | 'INCOMPLETE_DEPOSIT'
    | 'SUCCESS'
    | 'REFUNDED'
    | 'FAILED'
    | string;

    updatedAt: string;

    quoteResponse?: NearIntentsQuoteResponse;

    swapDetails?: {
        amountIn?: string;
        amountOut?: string;
        originChainTxHashes?: Array<{
            hash: string;
            explorerUrl: string;
        }>;
        destinationChainTxHashes?: Array<{
            hash: string;
            explorerUrl: string;
        }>;
        refundedAmount?: string;
        refundReason?: string;
    };
}

export interface CreateNearLiveQuoteInput {
    originAsset: string;
    destinationAsset: string;

    destinationAmount: string;

    recipient: string;
    refundTo: string;

    slippageTolerance?: number;
}
