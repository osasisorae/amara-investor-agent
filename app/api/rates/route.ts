import { NextRequest, NextResponse } from 'next/server';
import {
  normalizeGreyCurrency,
  type GreySupportedCurrency,
} from '@/lib/grey/currency';
import { getGreyRate } from '@/lib/grey/rates';
import { verifyInvestorSession } from '@/lib/investor-auth';
import { getClientIpAddress } from '@/lib/security/client-ip';
import {
  buildRateLimitKey,
  consumeSlidingWindowRateLimit,
  getRetryAfterHeaders,
} from '@/lib/security/rate-limit';

interface RateResponsePayload {
  rate: number;
  fee: number;
  sourceAmount: number;
  sourceCurrency: GreySupportedCurrency;
  destinationAmount: number;
  destinationCurrency: GreySupportedCurrency;
  fetchedAt: number;
}

interface CachedRateEntry {
  expiresAt: number;
  payload: RateResponsePayload | null;
}

const RATE_CACHE_TTL_MS = 60_000;
const RATE_REQUEST_WINDOW_SECONDS = 60;
const RATE_REQUEST_MAX_ATTEMPTS = 30;
const rateCache = new Map<string, CachedRateEntry>();
const ALLOWED_RATE_CURRENCIES = new Set<GreySupportedCurrency>([
  'NGN',
  'USD',
  'GBP',
  'EUR',
  'CAD',
  'AUD',
  'USDC',
  'USDT',
]);

function buildCacheHeaders() {
  return {
    'Cache-Control': 'private, max-age=60',
  };
}

export async function GET(request: NextRequest) {
  const session = await verifyInvestorSession(request);

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rateLimit = consumeSlidingWindowRateLimit({
    key: buildRateLimitKey({
      scope: 'grey-rates',
      keyParts: [session.leadId, getClientIpAddress(request) || 'unknown'],
    }),
    maxAttempts: RATE_REQUEST_MAX_ATTEMPTS,
    windowSeconds: RATE_REQUEST_WINDOW_SECONDS,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many rate requests. Try again shortly.' },
      {
        status: 429,
        headers: {
          ...getRetryAfterHeaders(rateLimit.retryAfterSeconds),
          'Cache-Control': 'private, no-store',
        },
      }
    );
  }

  const sourceCurrency = normalizeGreyCurrency(
    request.nextUrl.searchParams.get('source_currency')
  );
  const destinationCurrency = normalizeGreyCurrency(
    request.nextUrl.searchParams.get('destination_currency') || 'NGN'
  );
  const sourceAmountRaw =
    request.nextUrl.searchParams.get('source_amount') || '';
  const sourceAmount = Number(sourceAmountRaw);

  if (
    !sourceCurrency ||
    !destinationCurrency ||
    !ALLOWED_RATE_CURRENCIES.has(sourceCurrency) ||
    !ALLOWED_RATE_CURRENCIES.has(destinationCurrency)
  ) {
    return NextResponse.json(
      { error: 'Invalid currency' },
      { status: 400 }
    );
  }

  if (!Number.isFinite(sourceAmount) || sourceAmount <= 0) {
    return NextResponse.json(
      { error: 'Invalid source amount' },
      { status: 400 }
    );
  }

  if (sourceCurrency === destinationCurrency) {
    return NextResponse.json(
      {
        rate: 1,
        fee: 0,
        sourceAmount,
        sourceCurrency,
        destinationAmount: sourceAmount,
        destinationCurrency,
        fetchedAt: Date.now(),
      } satisfies RateResponsePayload,
      { headers: buildCacheHeaders() }
    );
  }

  const cacheKey = `${sourceCurrency}:${sourceAmount}:${destinationCurrency}`;
  const now = Date.now();
  const cached = rateCache.get(cacheKey);

  if (cached && cached.expiresAt > now) {
    if (!cached.payload) {
      return NextResponse.json(
        { error: 'Rate unavailable', fallback: true },
        { status: 503, headers: buildCacheHeaders() }
      );
    }

    return NextResponse.json(cached.payload, {
      headers: buildCacheHeaders(),
    });
  }

  const greyQuote = await getGreyRate({
    sourceAmount,
    sourceCurrency,
    destinationCurrency,
  });

  if (!greyQuote) {
    rateCache.set(cacheKey, {
      expiresAt: now + RATE_CACHE_TTL_MS,
      payload: null,
    });

    return NextResponse.json(
      { error: 'Rate unavailable', fallback: true },
      { status: 503, headers: buildCacheHeaders() }
    );
  }

  const payload: RateResponsePayload = {
    rate: greyQuote.rate,
    fee: greyQuote.fee,
    sourceAmount,
    sourceCurrency,
    destinationAmount: greyQuote.destinationAmount,
    destinationCurrency,
    fetchedAt: Date.now(),
  };

  rateCache.set(cacheKey, {
    expiresAt: now + RATE_CACHE_TTL_MS,
    payload,
  });

  return NextResponse.json(payload, {
    headers: buildCacheHeaders(),
  });
}
