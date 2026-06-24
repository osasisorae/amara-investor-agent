import { NextRequest, NextResponse } from 'next/server';
import { applyOrchestratorStageTransition } from '@/lib/agent/orchestrator';
import { getLeadById } from '@/lib/db/leads';
import {
  getLeadPaymentProgress,
  triggerPaymentInstructions,
} from '@/lib/payment';

// Payment stage ownership rule: agreement signing and payment setup may move a
// lead into `payment_pending`; closing the payment stage remains owned by the
// admin payment confirmation endpoint.
export async function POST(
  request: NextRequest,
  { params }: { params: { leadId: string } }
) {
  try {
    const lead = await getLeadById(params.leadId);

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    if (lead.kyc_approved !== 1 || !lead.approved_by || !lead.agreement_signed_at) {
      return NextResponse.json(
        { error: 'Payment checkout is locked until the agreement has been signed' },
        { status: 403 }
      );
    }

    if (lead.stage === 'closed') {
      return NextResponse.json(
        { error: 'This investment has already been closed' },
        { status: 400 }
      );
    }

    const paymentProgress = await getLeadPaymentProgress(lead.id);
    if (paymentProgress.submittedAt) {
      return NextResponse.json(
        {
          error:
            'A payment has already been submitted and is awaiting FutureX confirmation.',
        },
        { status: 409 }
      );
    }

    const paymentResult = await triggerPaymentInstructions(lead, {
      appBaseUrl: request.nextUrl.origin,
    });

    if (lead.stage !== 'payment_pending') {
      await applyOrchestratorStageTransition(lead.id, 'payment_pending');
    }

    return NextResponse.json({
      success: true,
      stage: 'payment_pending',
      paymentReference: paymentResult.paymentReference,
      paymentUrl: paymentResult.checkoutUrl,
      warning: paymentResult.warning,
    });
  } catch (error) {
    console.error('Error creating Flutterwave checkout:', error);
    return NextResponse.json(
      { error: 'Failed to create payment checkout' },
      { status: 500 }
    );
  }
}
