import { NextRequest, NextResponse } from 'next/server';
import {
  processFlutterwavePaymentCallback,
  type FlutterwavePaymentCallbackResult,
} from '@/lib/payment';
import {
  verifyFlutterwaveWebhookSignature,
  type FlutterwaveWebhookPayload,
} from '@/lib/flutterwave';

export const runtime = 'nodejs';

function getRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function getString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function getLeadIdFromPayload(
  payload: FlutterwaveWebhookPayload
): string | null {
  const data = getRecord(payload.data);
  const meta = getRecord(data?.meta);

  return getString(meta?.lead_id);
}

function getTransactionIdFromPayload(
  payload: FlutterwaveWebhookPayload
): string | null {
  const data = getRecord(payload.data);

  if (typeof data?.id === 'number' && Number.isFinite(data.id)) {
    return String(data.id);
  }

  return getString(data?.id);
}

function getTransactionReferenceFromPayload(
  payload: FlutterwaveWebhookPayload
): string | null {
  const data = getRecord(payload.data);

  return getString(data?.tx_ref) || getString(data?.txRef) || getString(data?.reference);
}

function isTerminalPaymentResult(
  result: FlutterwavePaymentCallbackResult
): boolean {
  return (
    result.status === 'submitted' ||
    result.status === 'pending' ||
    result.status === 'failed' ||
    result.status === 'invalid'
  );
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signatureHeader = request.headers.get('flutterwave-signature');

  try {
    const isValidSignature = verifyFlutterwaveWebhookSignature({
      rawBody,
      signatureHeader,
    });

    if (!isValidSignature) {
      console.error('Invalid Flutterwave webhook signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const payload = JSON.parse(rawBody) as FlutterwaveWebhookPayload;
    const leadId = getLeadIdFromPayload(payload);
    const transactionId = getTransactionIdFromPayload(payload);
    const transactionReference = getTransactionReferenceFromPayload(payload);

    if (!leadId || !transactionId) {
      console.error('Flutterwave webhook missing required identifiers', {
        type: payload.type,
        leadId,
        transactionId,
      });
      return NextResponse.json({ received: true }, { status: 200 });
    }

    const result = await processFlutterwavePaymentCallback({
      leadId,
      transactionId,
      transactionReference: transactionReference || undefined,
    });

    if (!isTerminalPaymentResult(result)) {
      console.error('Unexpected Flutterwave webhook result status', result.status);
    }

    return NextResponse.json(
      {
        received: true,
        status: result.status,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error processing Flutterwave webhook:', error);
    return NextResponse.json(
      { error: 'Failed to process webhook' },
      { status: 500 }
    );
  }
}
