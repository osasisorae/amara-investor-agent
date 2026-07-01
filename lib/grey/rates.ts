import {
  normalizeGreyCurrency,
  type GreySupportedCurrency,
} from './currency';
import { getRequiredEnvValue } from '@/lib/security/env';

const GREY_API_KEY = getRequiredEnvValue('GREY_API_KEY');

interface GreyRateArgs {
  sourceAmount: number;
  sourceCurrency: string;
  destinationCurrency: string;
}

export interface GreyRateQuote {
  destinationAmount: number;
  rate: number;
  fee: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readNumericValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.replace(/,/g, '').trim();
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function pickNumericValue(
  record: Record<string, unknown>,
  keys: string[]
): number | null {
  for (const key of keys) {
    const value = readNumericValue(record[key]);
    if (value !== null) {
      return value;
    }
  }

  return null;
}

function resolvePayload(
  body: Record<string, unknown>
): Record<string, unknown> | null {
  if (isRecord(body.data)) {
    return body.data;
  }

  return body;
}

function normalizeCurrencyOrNull(
  value: string,
  label: 'source' | 'destination'
): GreySupportedCurrency | null {
  const normalized = normalizeGreyCurrency(value);

  if (!normalized) {
    console.error(`[Grey Rates] Unsupported ${label} currency:`, value);
    return null;
  }

  return normalized;
}

export async function getGreyRate({
  sourceAmount,
  sourceCurrency,
  destinationCurrency,
}: GreyRateArgs): Promise<GreyRateQuote | null> {
  const normalizedSource = normalizeCurrencyOrNull(
    sourceCurrency,
    'source'
  );
  const normalizedDestination = normalizeCurrencyOrNull(
    destinationCurrency,
    'destination'
  );

  if (
    !normalizedSource ||
    !normalizedDestination ||
    !Number.isFinite(sourceAmount) ||
    sourceAmount <= 0
  ) {
    return null;
  }

  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch('https://api.grey.co/v1/rates', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GREY_API_KEY}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        source_amount: sourceAmount,
        source_currency: normalizedSource,
        destination_currency: normalizedDestination,
        transaction_type: 'deposit',
      }),
      cache: 'no-store',
      signal: controller.signal,
    });

    const rawBody = await response.text();

    if (!response.ok) {
      console.error('[Grey Rates] Request failed:', {
        status: response.status,
        body: rawBody,
      });
      return null;
    }

    let parsedBody: unknown = null;

    try {
      parsedBody = rawBody ? JSON.parse(rawBody) : null;
    } catch (error) {
      console.error('[Grey Rates] Failed to parse JSON response:', error);
      return null;
    }

    if (!isRecord(parsedBody)) {
      console.error('[Grey Rates] Response payload is not an object.');
      return null;
    }

    const payload = resolvePayload(parsedBody);

    if (!payload) {
      console.error('[Grey Rates] Missing response payload.');
      return null;
    }

    const destinationAmount =
      pickNumericValue(payload, [
        'destination_amount',
        'destinationAmount',
        'converted_amount',
        'amount',
        'target_amount',
      ]) ??
      pickNumericValue(parsedBody, [
        'destination_amount',
        'destinationAmount',
        'converted_amount',
        'amount',
        'target_amount',
      ]);
    const explicitRate =
      pickNumericValue(payload, ['rate', 'exchange_rate', 'fx_rate']) ??
      pickNumericValue(parsedBody, ['rate', 'exchange_rate', 'fx_rate']);
    const fee =
      pickNumericValue(payload, ['fee', 'fees', 'transaction_fee']) ??
      pickNumericValue(parsedBody, ['fee', 'fees', 'transaction_fee']) ??
      0;

    if (destinationAmount === null) {
      console.error('[Grey Rates] Could not determine destination amount.', {
        body: parsedBody,
      });
      return null;
    }

    const computedRate =
      explicitRate !== null
        ? explicitRate
        : destinationAmount > 0
          ? destinationAmount / sourceAmount
          : null;

    if (computedRate === null) {
      console.error('[Grey Rates] Could not determine rate.', {
        body: parsedBody,
      });
      return null;
    }

    return {
      destinationAmount,
      rate: computedRate,
      fee,
    };
  } catch (error) {
    console.error('[Grey Rates] Error fetching rate:', error);
    return null;
  } finally {
    globalThis.clearTimeout(timeout);
  }
}
