import {
  MINIMUM_HOLD_YEARS,
  MINIMUM_TICKET_NGN,
} from '@/lib/agent/qualification';
import {
  AGREEMENT_VERSION,
  EXIT_STRATEGY,
  SPV_NAME,
  TARGET_RETURN,
} from '@/lib/agreement/template';

const HTML_EMAIL_FOOTER = `
  <p>
    FutureX Nexus Development Limited<br>
    <a href="https://investfuturex.com" style="color: inherit; text-decoration: none;">investfuturex.com</a>
  </p>
`;

const TEXT_EMAIL_FOOTER = `FutureX Nexus Development Limited
investfuturex.com`;

function getEmailHeaderMarkup(): string {
  return `
  <div class="header">
    <h1 style="font-family:Georgia,serif;color:#111;">FutureX</h1>
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
  investorEmail: string;
  chatLink: string;
}): { subject: string; html: string; text: string } {
  const subject = 'Welcome to FutureX - Let\'s Start the Conversation';

  const html = renderEmailLayout(
    `
      <h2>Hi there,</h2>
      
      <p>Your email was recently added to our investor offeree register by the FutureX team. I wanted to personally reach out and introduce myself.</p>
      
      <p>I'm <strong class="gold">Amara</strong>, an AI agent built specifically to guide investors like you through the FutureX investment process. My role is to help you understand our current opportunity - the <strong>Akwa Ibom Hospitality Vehicle</strong> - answer your questions, and make the entire process as smooth and transparent as possible.</p>
      
      <p>Here's what I'll help you with:</p>
      <ul>
        <li>Understanding if this investment fits your goals</li>
        <li>Answering detailed questions about the deal structure, returns, and risks</li>
        <li>Guiding you through KYC and compliance requirements</li>
        <li>Providing full transparency at every step</li>
      </ul>
      
      <p>This isn't a sales pitch. It's a conversation. If the opportunity doesn't fit, I'll tell you. If it does, I'll make sure you have everything you need to make an informed decision.</p>
      
      <a href="${params.chatLink}" class="cta">Start the Conversation →</a>
      
      <p>I look forward to hearing from you.</p>
      
      <p><strong>Amara</strong><br>
      FutureX Investor Agent<br>
      <span class="gold">amara@investfuturex.com</span></p>
    `,
    HTML_EMAIL_FOOTER
  );

  const text = `
Hi there,

Your email was recently added to our investor offeree register by the FutureX team. I wanted to personally reach out and introduce myself.

I'm Amara, an AI agent built specifically to guide investors like you through the FutureX investment process. My role is to help you understand our current opportunity - the Akwa Ibom Hospitality Vehicle - answer your questions, and make the entire process as smooth and transparent as possible.

Here's what I'll help you with:
- Understanding if this investment fits your goals
- Answering detailed questions about the deal structure, returns, and risks
- Guiding you through KYC and compliance requirements
- Providing full transparency at every step

This isn't a sales pitch. It's a conversation. If the opportunity doesn't fit, I'll tell you. If it does, I'll make sure you have everything you need to make an informed decision.

Start the conversation: ${params.chatLink}

I look forward to hearing from you.

Amara
FutureX Investor Agent
amara@investfuturex.com

${TEXT_EMAIL_FOOTER}
  `;

  return { subject, html, text };
}

export function getKYCApprovalEmailTemplate(params: {
  investorName: string;
  agreementLink: string;
}): { subject: string; html: string; text: string } {
  const subject = 'KYC Approved - Your Investment Agreement is Ready';

  const html = renderEmailLayout(
    `
      <h2>Great news, ${params.investorName}!</h2>
      
      <p>Your KYC documents have been reviewed and <strong class="gold">approved</strong> by our compliance team. You're now ready to proceed with the investment agreement.</p>
      
      <div class="alert">
        <strong>Next Step:</strong> Review and sign your investment agreement
      </div>
      
      <p>The agreement outlines:</p>
      <ul>
        <li>Your subscription into the ${SPV_NAME}</li>
        <li>The minimum ${MINIMUM_HOLD_YEARS}-year hold period and exit terms</li>
        <li>Target return framing (${TARGET_RETURN}) and governance terms</li>
        <li>Full risk disclosures</li>
      </ul>
      
      <p>Please review the agreement carefully. Once you're ready to proceed, you'll sign electronically with an OTP verification sent to your email.</p>
      
      <a href="${params.agreementLink}" class="cta">Review Agreement →</a>
      
      <p>If you have any questions, just reply to this email or continue our conversation in the chat.</p>
      
      <p><strong>Amara</strong><br>
      FutureX Investor Agent<br>
      <span class="gold">amara@investfuturex.com</span></p>
    `,
    HTML_EMAIL_FOOTER
  );

  const text = `
Great news, ${params.investorName}!

Your KYC documents have been reviewed and approved by our compliance team. You're now ready to proceed with the investment agreement.

Next Step: Review and sign your investment agreement

The agreement outlines:
- Your subscription into the ${SPV_NAME}
- The minimum ${MINIMUM_HOLD_YEARS}-year hold period and exit terms
- Target return framing (${TARGET_RETURN}) and governance terms
- Full risk disclosures

Please review the agreement carefully. Once you're ready to proceed, you'll sign electronically with an OTP verification sent to your email.

Review Agreement: ${params.agreementLink}

If you have any questions, just reply to this email or continue our conversation in the chat.

Amara
FutureX Investor Agent
amara@investfuturex.com

${TEXT_EMAIL_FOOTER}
  `;

  return { subject, html, text };
}

export function getDealRoomAccessEmailTemplate(params: {
  investorName: string;
  chatLink: string;
}): { subject: string; html: string; text: string } {
  const subject = 'You now have access to the FutureX deal room';

  const html = renderEmailLayout(
    `
      <h2>You&apos;re qualified, ${params.investorName}.</h2>

      <p>You&apos;ve met the qualification criteria for the <strong class="gold">Akwa Ibom Hospitality Vehicle</strong>, and your deal room access is now active.</p>

      <div class="alert">
        <strong>Continue here:</strong> use the same secure conversation link below to review materials and ask due diligence questions.
      </div>

      <p>You can now use Amara to walk through:</p>
      <ul>
        <li>The offering memorandum and opportunity summary</li>
        <li>Key economics, risks, and timeline</li>
        <li>Next-step onboarding and KYC requirements</li>
      </ul>

      <a href="${params.chatLink}" class="cta">Open the Deal Room →</a>

      <p>If anything is unclear, reply in the chat and Amara will guide you from there.</p>

      <p><strong>Amara</strong><br>
      FutureX Investor Agent<br>
      <span class="gold">amara@investfuturex.com</span></p>
    `,
    HTML_EMAIL_FOOTER
  );

  const text = `
You're qualified, ${params.investorName}.

You've met the qualification criteria for the Akwa Ibom Hospitality Vehicle, and your deal room access is now active.

Continue here using the same secure conversation link:
${params.chatLink}

You can now use Amara to walk through:
- The offering memorandum and opportunity summary
- Key economics, risks, and timeline
- Next-step onboarding and KYC requirements

If anything is unclear, reply in the chat and Amara will guide you from there.

Amara
FutureX Investor Agent
amara@investfuturex.com

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
  paymentReference: string;
  bankDetails: string;
  commitmentLabel: string;
  deadlineLabel: string;
}): { subject: string; html: string; text: string } {
  const subject = 'Your FutureX payment instructions';

  const html = renderEmailLayout(
    `
      <h2>Thank you, ${params.investorName}.</h2>

      <p>Your agreement has been signed for the <strong class="gold">${SPV_NAME}</strong>. Your payment instructions are now ready.</p>

      <div class="alert">
        <strong>Payment reference:</strong> ${params.paymentReference}<br/>
        <strong>Recorded commitment:</strong> ${params.commitmentLabel}<br/>
        <strong>Deadline:</strong> ${params.deadlineLabel}
      </div>

      <p>Please include the payment reference exactly as written in your transfer narration.</p>

      <p><strong>Bank details</strong></p>
      ${renderPlainTextParagraphs(params.bankDetails)}

      <p>What happens next:</p>
      <ul>
        <li>Send the transfer using the payment reference above</li>
        <li>Our team confirms receipt and allocation</li>
        <li>You receive the final onboarding confirmation and next-step updates</li>
      </ul>

      <p>This investment is structured around a minimum ticket size of <strong>${`₦${MINIMUM_TICKET_NGN.toLocaleString('en-NG')}`}</strong>, a <strong>${MINIMUM_HOLD_YEARS}-year</strong> hold period, and an expected exit via <strong>${EXIT_STRATEGY.toLowerCase()}</strong>.</p>
    `,
    HTML_EMAIL_FOOTER
  );

  const text = `
Thank you, ${params.investorName}.

Your agreement has been signed for the ${SPV_NAME}. Your payment instructions are now ready.

Payment reference: ${params.paymentReference}
Recorded commitment: ${params.commitmentLabel}
Deadline: ${params.deadlineLabel}

Please include the payment reference exactly as written in your transfer narration.

Bank details:
${params.bankDetails}

What happens next:
- Send the transfer using the payment reference above
- Our team confirms receipt and allocation
- You receive the final onboarding confirmation and next-step updates

${TEXT_EMAIL_FOOTER}
  `;

  return { subject, html, text };
}
