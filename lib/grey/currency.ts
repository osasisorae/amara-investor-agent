export const GREY_FIAT_CURRENCIES = [
  'NGN',
  'USD',
  'GBP',
  'EUR',
  'CAD',
  'AUD',
] as const;

export const GREY_STABLECOIN_CURRENCIES = ['USDC', 'USDT'] as const;

export const GREY_SUPPORTED_CURRENCIES = [
  ...GREY_FIAT_CURRENCIES,
  ...GREY_STABLECOIN_CURRENCIES,
] as const;

export type GreySupportedFiatCurrency =
  (typeof GREY_FIAT_CURRENCIES)[number];
export type GreyStablecoinCurrency =
  (typeof GREY_STABLECOIN_CURRENCIES)[number];
export type GreySupportedCurrency = (typeof GREY_SUPPORTED_CURRENCIES)[number];
export type GreyInvestorCurrency = Exclude<GreySupportedFiatCurrency, 'NGN'>;

const GBP_LOCATION_KEYWORDS = [
  'united kingdom',
  'uk',
  'london',
  'england',
  'scotland',
  'wales',
  'manchester',
  'birmingham',
];

const USD_LOCATION_KEYWORDS = [
  'united states',
  'usa',
  'us',
  'america',
  'las vegas',
  'nevada',
  'new york',
  'california',
  'texas',
];

const CAD_LOCATION_KEYWORDS = [
  'canada',
  'toronto',
  'vancouver',
  'calgary',
  'ontario',
  'british columbia',
];

const AUD_LOCATION_KEYWORDS = [
  'australia',
  'sydney',
  'melbourne',
  'brisbane',
  'perth',
];

const EUR_LOCATION_KEYWORDS = [
  'europe',
  'germany',
  'france',
  'netherlands',
  'amsterdam',
  'berlin',
  'munich',
  'paris',
  'ireland',
  'dublin',
  'italy',
  'spain',
  'belgium',
];

function normalizeText(value: string | null | undefined): string {
  return value?.toLowerCase().replace(/\s+/g, ' ').trim() || '';
}

export function isGreySupportedCurrency(
  value: unknown
): value is GreySupportedCurrency {
  return (
    typeof value === 'string' &&
    (GREY_SUPPORTED_CURRENCIES as readonly string[]).includes(
      value.trim().toUpperCase()
    )
  );
}

export function isGreyInvestorCurrency(
  value: unknown
): value is GreyInvestorCurrency {
  return (
    typeof value === 'string' &&
    (['USD', 'GBP', 'EUR', 'CAD', 'AUD'] as const).includes(
      value.trim().toUpperCase() as GreyInvestorCurrency
    )
  );
}

export function normalizeGreyCurrency(
  value: string | null | undefined
): GreySupportedCurrency | null {
  const normalized = value?.trim().toUpperCase();
  return normalized && isGreySupportedCurrency(normalized) ? normalized : null;
}

export function detectInvestorCurrencyFromLocation(
  location?: string | null
): GreyInvestorCurrency {
  const normalized = normalizeText(location);

  if (!normalized) {
    return 'USD';
  }

  if (GBP_LOCATION_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return 'GBP';
  }

  if (USD_LOCATION_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return 'USD';
  }

  if (CAD_LOCATION_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return 'CAD';
  }

  if (AUD_LOCATION_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return 'AUD';
  }

  if (EUR_LOCATION_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return 'EUR';
  }

  return 'USD';
}

export function formatCurrencyAmount(
  amount: number,
  currency: GreySupportedFiatCurrency,
  maximumFractionDigits = currency === 'NGN' ? 0 : 2
): string {
  const locale = currency === 'NGN' ? 'en-NG' : 'en-US';

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: maximumFractionDigits,
    maximumFractionDigits,
  }).format(amount);
}

export function formatStablecoinAmount(
  amount: number,
  currency: GreyStablecoinCurrency
): string {
  return `${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
}
