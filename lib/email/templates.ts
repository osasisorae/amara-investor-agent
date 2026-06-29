import {
  MINIMUM_HOLD_YEARS,
} from '@/lib/agent/qualification';
import {
  AGREEMENT_VERSION,
  SPV_NAME,
} from '@/lib/agreement/template';

const HTML_EMAIL_FOOTER = `
  <p>
    FutureX Nexus Development Limited<br>
    <a href="https://investfuturex.com" style="color: inherit; text-decoration: none;">investfuturex.com</a>
  </p>
`;

const TEXT_EMAIL_FOOTER = `FutureX Nexus Development Limited
investfuturex.com`;

const PAYMENT_INSTRUCTIONS_HTML_FOOTER = `
  <p>
    FutureX Nexus Development Limited &middot; investfuturex.com
  </p>
`;

const PAYMENT_INSTRUCTIONS_TEXT_FOOTER =
  'FutureX Nexus Development Limited · investfuturex.com';

function getEmailAssetBaseUrl(): string {
  const configuredUrl =
    process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || '';
  const normalizedUrl = configuredUrl.replace(/\/$/, '');

  if (
    normalizedUrl &&
    !normalizedUrl.includes('localhost') &&
    !normalizedUrl.includes('127.0.0.1')
  ) {
    return normalizedUrl;
  }

  return 'https://amara.investfuturex.com';
}

function getEmailHeaderMarkup(): string {
  const wordmarkUrl = `${getEmailAssetBaseUrl()}/futurex-wordmark-email.png`;

  return `
  <div class="header">
    <img
      src="${wordmarkUrl}"
      alt="FutureX"
      style="display:block; width:auto; height:28px;"
    />
  </div>
  `;
}

function renderEmailLayout(content: string, footer: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'DM Sans', -apple-system, sans-serif; line-height: 1.6; color: #1f1a17; margin: 0; background: #f8f5f0; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .card { background: #ffffff; border: 1px solid #ebe4da; border-radius: 18px; padding: 32px 28px; box-shadow: 0 18px 50px rgba(31, 26, 23, 0.08); }
    .header { border-bottom: 2px solid #c9a66b; padding-bottom: 20px; margin-bottom: 30px; }
    .gold { color: #c9a66b; }
    .content { margin-bottom: 30px; }
    .cta { background: #c9a66b; color: #fff !important; padding: 14px 32px; text-decoration: none; border-radius: 999px; display: inline-block; font-weight: 600; margin: 20px 0; }
    .alert { background: #f5e8ea; border-left: 4px solid #722f37; padding: 16px; margin: 20px 0; }
    .footer { border-top: 1px solid #ddd; padding-top: 20px; margin-top: 40px; font-size: 14px; color: #6f655d; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      ${getEmailHeaderMarkup()}
      <div class="content">
        ${content}
      </div>
      <div class="footer">
        ${footer}
      </div>
    </div>
  </div>
</body>
</html>
  `;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderPlainTextParagraphs(body: string): string {
  return body
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br/>')}</p>`)
    .join('');
}

export function getOutreachEmailTemplate(params: {
  investorName?: string;
  chatLink: string;
}): { subject: string; html: string; text: string } {
  const subject = 'Your Private FutureX Access';
  const greeting = params.investorName?.trim()
    ? `Hi ${escapeHtml(params.investorName.trim().split(/\s+/)[0])},`
    : 'Hi there,';
  const textGreeting = params.investorName?.trim()
    ? `Hi ${params.investorName.trim().split(/\s+/)[0]},`
    : 'Hi there,';

  const html = renderEmailLayout(
    `
      <h2>${greeting}</h2>

      <p>You were recently added by the FutureX team for private access to our current hospitality opportunity in Uyo, Akwa Ibom.</p>

      <p>We have built a guided deal room where you can review the opportunity clearly, understand how the structure works, ask due diligence questions, and decide whether it is worth exploring further.</p>

      <p>To protect your access, we&apos;ll first send a one time code to your email before opening the conversation.</p>

      <p>If it is not a fit, that will become clear quickly. If it is, the next steps are already there for you.</p>

      <a href="${params.chatLink}" class="cta">Verify Email and Open the Deal Room →</a>

      <p>Best,<br>
      <strong>FutureX Team</strong></p>
    `,
    HTML_EMAIL_FOOTER
  );

  const text = `
${textGreeting}

You were recently added by the FutureX team for private access to our current hospitality opportunity in Uyo, Akwa Ibom.

We have built a guided deal room where you can review the opportunity clearly, understand how the structure works, ask due diligence questions, and decide whether it is worth exploring further.

To protect your access, we'll first send a one time code to your email before opening the conversation.

If it is not a fit, that will become clear quickly. If it is, the next steps are already there for you.

Verify email and open the deal room: ${params.chatLink}

Best,
FutureX Team

${TEXT_EMAIL_FOOTER}
  `;

  return { subject, html, text };
}

export function getKYCApprovalEmailTemplate(params: {
  investorName: string;
  agreementLink: string;
}): { subject: string; html: string; text: string } {
  const subject = 'Your agreement is ready for review';

  const html = renderEmailLayout(
    `
      <h2>Your KYC review is complete, ${params.investorName}.</h2>

      <p>Your documents have been reviewed and <strong class="gold">approved</strong> by the FutureX compliance team. You are now cleared to review and sign the investment agreement.</p>

      <div class="alert">
        <strong>Next step:</strong> verify your email, then review and sign your agreement using the secure link below.
      </div>

      <p>The agreement contains your subscription into the ${SPV_NAME}, the minimum ${MINIMUM_HOLD_YEARS}-year hold period and exit terms, governance provisions, and the full risk disclosures.</p>

      <p>Please review it carefully. When you are ready to sign, you will verify with a one time code sent to your email.</p>

      <a href="${params.agreementLink}" class="cta">Verify Email and Review Agreement →</a>

      <p>If anything is unclear, continue the conversation in your deal room before signing.</p>

      <p><strong>FutureX Compliance Team</strong></p>
    `,
    HTML_EMAIL_FOOTER
  );

  const text = `
Your KYC review is complete, ${params.investorName}.

Your documents have been reviewed and approved by the FutureX compliance team. You are now cleared to review and sign the investment agreement.

Next step: verify your email, then review and sign your agreement using the secure link below.

The agreement contains your subscription into the ${SPV_NAME}, the minimum ${MINIMUM_HOLD_YEARS}-year hold period and exit terms, governance provisions, and the full risk disclosures.

Please review it carefully. When you are ready to sign, you will verify with a one time code sent to your email.

Verify email and review agreement: ${params.agreementLink}

If anything is unclear, continue the conversation in your deal room before signing.

FutureX Compliance Team

${TEXT_EMAIL_FOOTER}
  `;

  return { subject, html, text };
}

export function getDealRoomAccessEmailTemplate(params: {
  investorName: string;
  chatLink: string;
}): { subject: string; html: string; text: string } {
  const subject = 'Your FutureX deal room is ready';

  const html = renderEmailLayout(
    `
      <h2>You&apos;re qualified, ${params.investorName}.</h2>

      <p>You&apos;ve met the qualification criteria for the <strong class="gold">Akwa Ibom Hospitality Vehicle</strong>. Your secure deal room is now open.</p>

      <div class="alert">
        <strong>Next step:</strong> use the secure link below to verify your email, then open the deal room and continue your diligence.
      </div>

      <p>Inside the deal room, you can:</p>
      <ul>
        <li>Review the opportunity summary and supporting materials</li>
        <li>Ask due diligence questions about the structure, risks, and timeline</li>
        <li>Continue to onboarding and KYC when you are ready</li>
      </ul>

      <a href="${params.chatLink}" class="cta">Verify Email and Open the Deal Room →</a>

      <p>If anything is unclear, continue the conversation from the same secure link.</p>

      <p><strong>FutureX Team</strong></p>
    `,
    HTML_EMAIL_FOOTER
  );

  const text = `
You're qualified, ${params.investorName}.

You've met the qualification criteria for the Akwa Ibom Hospitality Vehicle. Your secure deal room is now open.

Next step: use the secure link below to verify your email, then open the deal room and continue your diligence.

${params.chatLink}

Inside the deal room, you can:
- Review the opportunity summary and supporting materials
- Ask due diligence questions about the structure, risks, and timeline
- Continue to onboarding and KYC when you are ready

If anything is unclear, continue the conversation from the same secure link.

FutureX Team

${TEXT_EMAIL_FOOTER}
  `;

  return { subject, html, text };
}

export function getOtpEmailTemplate(params: {
  investorName: string;
  otpCode: string;
  expiryMinutes: number;
}): { subject: string; html: string; text: string } {
  const subject = 'Your FutureX signing verification code';

  const html = renderEmailLayout(
    `
      <h2>Hello ${params.investorName},</h2>

      <p>Use the verification code below to complete signing for the ${SPV_NAME} agreement.</p>

      <div class="alert" style="font-size: 24px; letter-spacing: 0.2em; font-weight: 700;">
        ${params.otpCode}
      </div>

      <p>This code expires in ${params.expiryMinutes} minutes. If you did not request it, please ignore this email and contact FutureX.</p>

      <p><strong>Agreement version:</strong> ${AGREEMENT_VERSION}</p>
    `,
    HTML_EMAIL_FOOTER
  );

  const text = `
Hello ${params.investorName},

Use the verification code below to complete signing for the ${SPV_NAME} agreement:

${params.otpCode}

This code expires in ${params.expiryMinutes} minutes.
Agreement version: ${AGREEMENT_VERSION}

${TEXT_EMAIL_FOOTER}
  `;

  return { subject, html, text };
}

export function getInvestorAccessOtpEmailTemplate(params: {
  investorName: string;
  otpCode: string;
  expiryMinutes: number;
}): { subject: string; html: string; text: string } {
  const subject = 'Your FutureX investor access code';

  const html = renderEmailLayout(
    `
      <h2>Hello ${params.investorName},</h2>

      <p>Use the verification code below to reopen your FutureX investor conversation.</p>

      <div class="alert" style="font-size: 24px; letter-spacing: 0.2em; font-weight: 700;">
        ${params.otpCode}
      </div>

      <p>This code expires in ${params.expiryMinutes} minutes. If you did not request it, you can safely ignore this email.</p>
    `,
    HTML_EMAIL_FOOTER
  );

  const text = `
Hello ${params.investorName},

Use the verification code below to reopen your FutureX investor conversation:

${params.otpCode}

This code expires in ${params.expiryMinutes} minutes.

${TEXT_EMAIL_FOOTER}
  `;

  return { subject, html, text };
}

export function getAdminHumanReviewEmailTemplate(params: {
  investorEmail: string;
  leadId: string;
  reason: string;
  chatLink: string;
}): { subject: string; html: string; text: string } {
  const subject = `Human review requested for ${params.investorEmail}`;

  const html = renderEmailLayout(
    `
      <h2>Human review requested</h2>

      <p>Amara flagged a lead for manual follow-up.</p>

      <ul>
        <li><strong>Lead:</strong> ${params.investorEmail}</li>
        <li><strong>Lead ID:</strong> ${params.leadId}</li>
        <li><strong>Reason:</strong> ${escapeHtml(params.reason)}</li>
      </ul>

      <a href="${params.chatLink}" class="cta">Open Conversation →</a>
    `,
    HTML_EMAIL_FOOTER
  );

  const text = `
Human review requested

Lead: ${params.investorEmail}
Lead ID: ${params.leadId}
Reason: ${params.reason}

Open conversation: ${params.chatLink}

${TEXT_EMAIL_FOOTER}
  `;

  return { subject, html, text };
}

export function getAdminKycSubmissionEmailTemplate(params: {
  investorEmail: string;
  leadId: string;
  chatLink: string;
}): { subject: string; html: string; text: string } {
  const subject = `New KYC submission ready for review: ${params.investorEmail}`;

  const html = renderEmailLayout(
    `
      <h2>New KYC submission</h2>

      <p>A qualified investor has completed KYC intake and is ready for human compliance review.</p>

      <ul>
        <li><strong>Investor:</strong> ${params.investorEmail}</li>
        <li><strong>Lead ID:</strong> ${params.leadId}</li>
      </ul>

      <a href="${params.chatLink}" class="cta">Open Conversation →</a>
    `,
    HTML_EMAIL_FOOTER
  );

  const text = `
New KYC submission

Investor: ${params.investorEmail}
Lead ID: ${params.leadId}

Open conversation: ${params.chatLink}

${TEXT_EMAIL_FOOTER}
  `;

  return { subject, html, text };
}

export function getKycRejectionEmailTemplate(params: {
  investorName: string;
  reason: string;
}): { subject: string; html: string; text: string } {
  const subject = 'KYC update: action required';

  const html = renderEmailLayout(
    `
      <h2>Hello ${escapeHtml(params.investorName)},</h2>

      <p>Your recent KYC submission needs another pass before our compliance team can approve it.</p>

      <div class="alert">
        <strong>Reason for rejection:</strong><br/>
        ${escapeHtml(params.reason)}
      </div>

      <p>Please message Amara to restart the KYC process and resubmit your documents.</p>
    `,
    HTML_EMAIL_FOOTER
  );

  const text = `
Hello ${params.investorName},

Your recent KYC submission needs another pass before our compliance team can approve it.

Reason for rejection:
${params.reason}

Please message Amara to restart the KYC process and resubmit your documents.

${TEXT_EMAIL_FOOTER}
  `;

  return { subject, html, text };
}

export function getPaymentInstructionsEmailTemplate(params: {
  investorName: string;
  chatUrl: string;
  paymentReference: string;
  commitmentLabel: string;
}): { subject: string; html: string; text: string } {
  const subject = `Your FutureX payment instructions — ${params.paymentReference}`;

  const html = renderEmailLayout(
    `
      <h2>Thank you, ${params.investorName}.</h2>

      <p>Your agreement has been signed for the <strong class="gold">${SPV_NAME}</strong>.</p>
      <p>Your agreement is signed. Use the link below to verify your email and return to your investor conversation to complete payment.</p>

      <div class="alert">
        <strong>Payment reference:</strong> ${params.paymentReference}<br/>
        <strong>Recorded commitment:</strong> ${params.commitmentLabel}
      </div>

      <p>
        <a class="cta" href="${params.chatUrl}">Verify Email and Return to Your Conversation →</a>
      </p>
    `,
    PAYMENT_INSTRUCTIONS_HTML_FOOTER
  );

  const text = `
Thank you, ${params.investorName}.

Your agreement has been signed for the ${SPV_NAME}.
Your agreement is signed. Use the link below to verify your email and return to your investor conversation to complete payment.

Payment reference: ${params.paymentReference}
Recorded commitment: ${params.commitmentLabel}

Verify email and return to your conversation:
${params.chatUrl}

${PAYMENT_INSTRUCTIONS_TEXT_FOOTER}
  `;

  return { subject, html, text };
}
