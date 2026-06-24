export interface NgnPaymentDetails {
  bank: string;
  accountName: string;
  accountNumber: string;
  sortCode: string;
}

export interface UsdPaymentDetails {
  bank: string;
  accountName: string;
  accountNumber: string;
  routingNumber: string;
  swiftCode: string;
}

export interface CryptoPaymentDetails {
  usdc_eth: string;
  usdc_sol: string;
  usdc_bnb: string;
  usdt_bnb: string;
  usdt_trx: string;
}

export interface SerializablePaymentDetails {
  ngn: NgnPaymentDetails;
  usd: UsdPaymentDetails;
  crypto: CryptoPaymentDetails;
}

function readEnvValue(
  value: string | undefined,
  fallback = 'Not configured'
): string {
  return value?.trim() || fallback;
}

export const PAYMENT_DETAILS: SerializablePaymentDetails = {
  ngn: {
    bank: readEnvValue(process.env.FUTUREX_NGN_BANK_NAME, 'Zenith Bank'),
    accountName: readEnvValue(
      process.env.FUTUREX_ACCOUNT_NAME,
      'FutureX Nexus Development Limited'
    ),
    accountNumber: readEnvValue(process.env.FUTUREX_NGN_ACCOUNT_NUMBER),
    sortCode: readEnvValue(process.env.FUTUREX_NGN_SORT_CODE),
  },
  usd: {
    bank: readEnvValue(process.env.FUTUREX_USD_BANK_NAME, 'Grey Finance'),
    accountName: readEnvValue(
      process.env.FUTUREX_ACCOUNT_NAME,
      'FutureX Nexus Development Limited'
    ),
    accountNumber: readEnvValue(process.env.FUTUREX_USD_ACCOUNT_NUMBER),
    routingNumber: readEnvValue(process.env.FUTUREX_USD_ROUTING_NUMBER),
    swiftCode: readEnvValue(process.env.FUTUREX_USD_SWIFT),
  },
  crypto: {
    usdc_eth: readEnvValue(process.env.FUTUREX_USDC_ETH_ADDRESS),
    usdc_sol: readEnvValue(process.env.FUTUREX_USDC_SOL_ADDRESS),
    usdc_bnb: readEnvValue(process.env.FUTUREX_USDC_BNB_ADDRESS),
    usdt_bnb: readEnvValue(process.env.FUTUREX_USDT_BNB_ADDRESS),
    usdt_trx: readEnvValue(process.env.FUTUREX_USDT_TRX_ADDRESS),
  },
};

export function shouldShowCryptoPaymentOptions(slotCount: number): boolean {
  return slotCount >= 2;
}

export function getApproximateUsdAmount(slotCount: number): string {
  const perSlotUsd = 3300;
  return `$${(slotCount * perSlotUsd).toLocaleString('en-US')}`;
}
