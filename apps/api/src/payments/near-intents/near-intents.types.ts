export interface NearIntentsToken {
    assetId: string;
    decimals: number;
    blockchain: string;
    symbol: string;
    price?: number;
    priceUpdatedAt?: string;
    contractAddress?: string | null;
}
