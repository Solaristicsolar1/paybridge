
export const SUPPORTED_CURRENCIES = [
    'NGN',
    'USD',
    'GBP',
    'EUR',
    'CAD',
    'AUD',
    'KES',
    'GHS',
    'ZAR',
    'XOF',
] as const;

export type SupportedCurrency =
    (typeof SUPPORTED_CURRENCIES)[number];

export function isSupportedCurrency(
    currency: string,
): currency is SupportedCurrency {
    return (
        SUPPORTED_CURRENCIES as readonly string[]
    ).includes(currency);
}
