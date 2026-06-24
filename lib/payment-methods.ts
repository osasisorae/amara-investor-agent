export const PAYMENT_METHODS = ['ngn', 'usd', 'crypto'] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return (
    typeof value === 'string' &&
    (PAYMENT_METHODS as readonly string[]).includes(value)
  );
}

export function getPaymentMethodLabel(method: PaymentMethod): string {
  switch (method) {
    case 'ngn':
      return 'Nigerian Naira (NGN) bank transfer';
    case 'usd':
      return 'US Dollars (USD) wire transfer';
    case 'crypto':
      return 'Crypto (USDC/USDT)';
  }
}
