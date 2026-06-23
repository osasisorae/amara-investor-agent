export function getOutreachEmailTemplate(params: {
  investorEmail: string;
  chatLink: string;
}): { subject: string; html: string; text: string } {
  const subject = 'Welcome to FutureX - Let\'s Start the Conversation';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'DM Sans', -apple-system, sans-serif; line-height: 1.6; color: #1f1a17; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .header { border-bottom: 2px solid #c9a66b; padding-bottom: 20px; margin-bottom: 30px; }
    .logo { font-family: 'DM Serif Display', serif; font-size: 24px; color: #1f1a17; }
    .gold { color: #c9a66b; }
    .content { margin-bottom: 30px; }
    .cta { background: #c9a66b; color: #fff; padding: 14px 32px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600; margin: 20px 0; }
    .footer { border-top: 1px solid #ddd; padding-top: 20px; margin-top: 40px; font-size: 14px; color: #6f655d; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">FutureX</div>
    </div>
    
    <div class="content">
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
      <span class="gold">her@investfuturex.com</span></p>
    </div>
    
    <div class="footer">
      <p>FutureX · Real Estate Syndication for Nigerian Diaspora Investors<br>
      investfuturex.com · info@investfuturex.com</p>
      <p style="font-size: 12px; margin-top: 20px;">You're receiving this because your email was added to our qualified investor register. If you believe this was sent in error, please reply and let us know.</p>
    </div>
  </div>
</body>
</html>
  `;

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
her@investfuturex.com

---
FutureX · Real Estate Syndication for Nigerian Diaspora Investors
investfuturex.com · info@investfuturex.com
  `;

  return { subject, html, text };
}

export function getKYCApprovalEmailTemplate(params: {
  investorName: string;
  agreementLink: string;
}): { subject: string; html: string; text: string } {
  const subject = 'KYC Approved - Your Investment Agreement is Ready';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'DM Sans', -apple-system, sans-serif; line-height: 1.6; color: #1f1a17; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .header { border-bottom: 2px solid #c9a66b; padding-bottom: 20px; margin-bottom: 30px; }
    .logo { font-family: 'DM Serif Display', serif; font-size: 24px; color: #1f1a17; }
    .gold { color: #c9a66b; }
    .content { margin-bottom: 30px; }
    .cta { background: #c9a66b; color: #fff; padding: 14px 32px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600; margin: 20px 0; }
    .alert { background: #f5e8ea; border-left: 4px solid #722f37; padding: 16px; margin: 20px 0; }
    .footer { border-top: 1px solid #ddd; padding-top: 20px; margin-top: 40px; font-size: 14px; color: #6f655d; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">FutureX</div>
    </div>
    
    <div class="content">
      <h2>Great news, ${params.investorName}!</h2>
      
      <p>Your KYC documents have been reviewed and <strong class="gold">approved</strong> by our compliance team. You're now ready to proceed with the investment agreement.</p>
      
      <div class="alert">
        <strong>Next Step:</strong> Review and sign your investment agreement
      </div>
      
      <p>The agreement outlines:</p>
      <ul>
        <li>Your fractional economic interest in the SPV (0.658% per ₦2.5M ticket)</li>
        <li>Profit distribution structure (70% to investors, 30% to FutureX)</li>
        <li>Timeline and exit provisions</li>
        <li>Full risk disclosures</li>
      </ul>
      
      <p>Please review the agreement carefully. Once you're ready to proceed, you'll sign electronically with an OTP verification sent to your email.</p>
      
      <a href="${params.agreementLink}" class="cta">Review Agreement →</a>
      
      <p>If you have any questions, just reply to this email or continue our conversation in the chat.</p>
      
      <p><strong>Amara</strong><br>
      FutureX Investor Agent<br>
      <span class="gold">her@investfuturex.com</span></p>
    </div>
    
    <div class="footer">
      <p>FutureX · Real Estate Syndication for Nigerian Diaspora Investors<br>
      investfuturex.com · info@investfuturex.com</p>
    </div>
  </div>
</body>
</html>
  `;

  const text = `
Great news, ${params.investorName}!

Your KYC documents have been reviewed and approved by our compliance team. You're now ready to proceed with the investment agreement.

Next Step: Review and sign your investment agreement

The agreement outlines:
- Your fractional economic interest in the SPV (0.658% per ₦2.5M ticket)
- Profit distribution structure (70% to investors, 30% to FutureX)
- Timeline and exit provisions
- Full risk disclosures

Please review the agreement carefully. Once you're ready to proceed, you'll sign electronically with an OTP verification sent to your email.

Review Agreement: ${params.agreementLink}

If you have any questions, just reply to this email or continue our conversation in the chat.

Amara
FutureX Investor Agent
her@investfuturex.com

---
FutureX · Real Estate Syndication for Nigerian Diaspora Investors
investfuturex.com · info@investfuturex.com
  `;

  return { subject, html, text };
}
