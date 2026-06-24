import { createHmac } from 'node:crypto';
import { SPV_NAME } from '@/lib/agreement/template';

const FLUTTERWAVE_API_BASE_URL =
  process.env.FLUTTERWAVE_API_BASE_URL || 'https://api.flutterwave.com';
const FLUTTERWAVE_PAYMENT_OPTIONS =
  process.env.FLUTTERWAVE_PAYMENT_OPTIONS || 'card,banktransfer,ussd';

function requireFlutterwaveSecretKey(): string {
  const secretKey = process.env.FLUTTERWAVE_SK?.trim();

  if (!secretKey) {
    throw new Error(
      'FLUTTERWAVE_SK environment variable is required to create Flutterwave checkout links'
    );
  }

  return secretKey;
}

function requireFlutterwaveWebhookSecretHash(): string {
  const secretHash = process.env.FLUTTERWAVE_WEBHOOK_SECRET_HASH?.trim();

  if (!secretHash) {
    throw new Error(
      'FLUTTERWAVE_WEBHOOK_SECRET_HASH environment variable is required to verify Flutterwave webhooks'
    );
  }

  return secretHash;
}

function normalizeBaseUrl(baseUrl?: string): string {
  return (
    baseUrl?.replace(/\/$/, '') ||
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
    ''
  );
}

function buildRedirectUrl(params: { appBaseUrl?: string; leadId: string }): string {
  const appBaseUrl = normalizeBaseUrl(params.appBaseUrl);
  if (!appBaseUrl) {
    throw new Error(
      'NEXT_PUBLIC_APP_URL or a request origin is required for Flutterwave redirects'
    );
  }

  const redirectUrl = new URL('/payment/callback', appBaseUrl);
  redirectUrl.searchParams.set('leadId', params.leadId);
  return redirectUrl.toString();
}

function buildLogoUrl(appBaseUrl?: string): string | undefined {
  const normalizedBaseUrl = normalizeBaseUrl(appBaseUrl);
  if (!normalizedBaseUrl) {
    return undefined;
  }

  return `${normalizedBaseUrl}/futurex-wordmark-email.png`;
}

function coerceCheckoutUrl(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed;
}

export interface FlutterwaveCheckoutSession {
  checkoutUrl: string;
  transactionReference: string;
  responseMessage?: string;
}

export interface FlutterwaveVerifiedPayment {
  transactionId: string;
  transactionReference: string;
  status: string;
  amount: number;
  currency: string;
  customerEmail?: string;
  raw: Record<string, unknown>;
}

export interface FlutterwaveWebhookPayload {
  id?: string;
  timestamp?: number;
  type?: string;
  data?: Record<string, unknown>;
}

export function verifyFlutterwaveWebhookSignature(params: {
  rawBody: string;
  signatureHeader?: string | null;
}): boolean {
  const secretHash = requireFlutterwaveWebhookSecretHash();
  const signatureHeader = params.signatureHeader?.trim();

  if (!signatureHeader) {
    return false;
  }

  const computedSignature = createHmac('sha256', secretHash)
    .update(params.rawBody)
    .digest('base64');

  return computedSignature === signatureHeader;
}

export async function createFlutterwaveCheckoutSession(params: {
  leadId: string;
  leadEmail: string;
  investorName: string;
  phoneNumber?: string;
  amount: number;
  currency: string;
  paymentReference: string;
  slotCount: number;
  commitmentLabel: string;
  appBaseUrl?: string;
}): Promise<FlutterwaveCheckoutSession> {
  const secretKey = requireFlutterwaveSecretKey();
  const transactionReference = `${params.paymentReference}-${Date.now()}`;
  const redirectUrl = buildRedirectUrl({
    appBaseUrl: params.appBaseUrl,
    leadId: params.leadId,
  });
  const logoUrl = buildLogoUrl(params.appBaseUrl);

  const payload = {
    tx_ref: transactionReference,
    amount: params.amount,
    currency: params.currency,
    redirect_url: redirectUrl,
    payment_options: FLUTTERWAVE_PAYMENT_OPTIONS,
    customer: {
      email: params.leadEmail,
      name: params.investorName,
      phonenumber: params.phoneNumber || undefined,
    },
    customizations: {
      title: 'FutureX Investment Checkout',
      description: `${SPV_NAME} commitment payment`,
      logo: logoUrl,
    },
    meta: {
      lead_id: params.leadId,
      payment_reference: params.paymentReference,
      slot_count: params.slotCount,
      commitment_label: params.commitmentLabel,
    },
  };

  const response = await fetch(`${FLUTTERWAVE_API_BASE_URL}/v3/payments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const responseBody = (await response.json().catch(() => null)) as
    | Record<string, unknown>
    | null;

  if (!response.ok) {
    const errorMessage =
      typeof responseBody?.message === 'string'
        ? responseBody.message
        : 'Flutterwave checkout creation failed';
    throw new Error(errorMessage);
  }

  const data =
    responseBody && typeof responseBody.data === 'object' && responseBody.data
      ? (responseBody.data as Record<string, unknown>)
      : null;
  const checkoutUrl =
    coerceCheckoutUrl(data?.link) ||
    coerceCheckoutUrl(data?.checkout_url) ||
    coerceCheckoutUrl(responseBody?.link);

  if (!checkoutUrl) {
    throw new Error('Flutterwave did not return a hosted checkout URL');
  }

  return {
    checkoutUrl,
    transactionReference,
    responseMessage:
      typeof responseBody?.message === 'string' ? responseBody.message : undefined,
  };
}

export async function verifyFlutterwaveTransaction(
  transactionId: string
): Promise<FlutterwaveVerifiedPayment> {
  const secretKey = requireFlutterwaveSecretKey();

  const response = await fetch(
    `${FLUTTERWAVE_API_BASE_URL}/v3/transactions/${encodeURIComponent(
      transactionId
    )}/verify`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
    }
  );

  const responseBody = (await response.json().catch(() => null)) as
    | Record<string, unknown>
    | null;

  if (!response.ok) {
    const errorMessage =
      typeof responseBody?.message === 'string'
        ? responseBody.message
        : 'Flutterwave transaction verification failed';
    throw new Error(errorMessage);
  }

  const data =
    responseBody && typeof responseBody.data === 'object' && responseBody.data
      ? (responseBody.data as Record<string, unknown>)
      : null;

  if (!data) {
    throw new Error('Flutterwave verification response was missing transaction data');
  }

  const amount =
    typeof data.amount === 'number'
      ? data.amount
      : Number(typeof data.amount === 'string' ? data.amount : NaN);

  return {
    transactionId: String(data.id ?? transactionId),
    transactionReference:
      typeof data.tx_ref === 'string'
        ? data.tx_ref
        : typeof data.txRef === 'string'
          ? data.txRef
          : '',
    status:
      typeof data.status === 'string'
        ? data.status
        : typeof responseBody?.status === 'string'
          ? responseBody.status
          : 'unknown',
    amount: Number.isFinite(amount) ? amount : 0,
    currency:
      typeof data.currency === 'string'
        ? data.currency
        : typeof responseBody?.currency === 'string'
          ? responseBody.currency
          : 'NGN',
    customerEmail:
      data.customer &&
      typeof data.customer === 'object' &&
      typeof (data.customer as Record<string, unknown>).email === 'string'
        ? ((data.customer as Record<string, unknown>).email as string)
        : undefined,
    raw: data,
  };
}
