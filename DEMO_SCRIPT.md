# Amara Demo Script — 3-Minute Video

**Qwen Cloud Hackathon 2026 — Track 4: Autopilot Agent**

---

## Introduction (15 seconds)

**[Show landing page at localhost:3000]**

"Meet Amara — an AI-powered investor onboarding agent for FutureX, built with Qwen Cloud. Amara automates the full investor pipeline from first contact to signed agreement, with human-in-the-loop compliance checkpoints enforced by Nigerian law."

---

## Stage 1: Admin Adds Offeree (20 seconds)

**[Navigate to /admin]**

"The process starts with a human checkpoint. An admin adds an investor's email to the qualified offeree register."

**[Fill in form]**
- Email: `demo@example.com`
- Full Name: `Demo Investor`
- Notes: `Diaspora investor from UK`

**[Click "Add & Send Outreach Email"]**

"Amara immediately sends a personalized outreach email inviting them to start the conversation."

**[Show email inbox - received email]**

---

## Stage 2: Investor Opens Chat (25 seconds)

**[Click chat link from email → Opens /chat/[leadId]]**

"The investor opens the chat. Amara introduces herself and begins the qualification conversation."

**[Type message]**
> "Hi Amara, I'm interested in learning more about this opportunity."

**[Amara responds]**

"Amara asks structured questions to assess if the investor meets the criteria."

---

## Stage 3: Qualification (30 seconds)

**[Continue conversation]**

**Amara:** "Great! Let me understand if this fits your investment goals. Are you a member of the Nigerian diaspora or a verified local high net worth individual?"

**Investor:** "Yes, I'm Nigerian diaspora based in London."

**Amara:** "Perfect. What's your investment horizon? This is a 5-year hold period."

**Investor:** "I'm looking for medium-term investments, 5 years works for me."

**Amara:** "Excellent. The minimum ticket size is ₦5M. Does that fit your budget?"

**Investor:** "Yes, that's within my range."

**Amara:** "Wonderful! You meet all the qualification criteria. I'm granting you access to the deal room where you can review the full investment brief and ask detailed questions."

**[Show stage badge update: "Qualification" → "Deal Room"]**

---

## Stage 4: Deal Room Access (30 seconds)

**[Investor asks question]**
> "What's the expected return on a ₦2.5M investment over 5 years?"

**[Amara responds with knowledge base information]**

"Amara answers using the knowledge base. She provides detailed information about the Akwa Ibom Hospitality Vehicle — returns, structure, risks."

**[Show response with numbers]**
- Base case: ~₦6.99M total proceeds (~2.8× multiple)
- Cash distributions: ~₦1.44M over 4 years
- Exit value: ~₦5.55M at Year 5

**[Investor asks follow-up]**
> "What are the main risks?"

**[Amara lists risks with mitigations]**

"All answers come from the knowledge base. No guessing, no hallucination."

---

## Stage 5: KYC Intake (20 seconds)

**[Investor ready to proceed]**
> "I'm ready to move forward. What's next?"

**[Amara guides to KYC]**

"Amara explains the KYC process. The investor would upload documents here (passport, proof of residence). For the demo, we'll simulate this."

**[Show stage update: "Deal Room" → "KYC Intake" → "Pending Human Review"]**

"Once documents are uploaded, Amara freezes. The agent cannot proceed until a human compliance officer reviews the KYC."

---

## Stage 6: Human KYC Review (25 seconds)

**[Switch to admin dashboard /admin]**

"Back in the admin dashboard, the compliance officer sees the investor is pending review."

**[Show lead in "Pending Human Review" state]**

"The officer reviews the documents and clicks 'Approve KYC'."

**[Click Approve button]**

**[Show success message]**

"Amara immediately sends an approval email with the investment agreement link."

**[Show email inbox - approval email received]**

---

## Stage 7: Agreement & Audit Trail (20 seconds)

**[Return to investor chat]**

**[Show stage update: "Agreement Pending"]**

"The investor can now review and sign the agreement. Every action is logged to the audit trail:"

**[Show database or admin view of audit_events]**
- outreach_sent
- qualification_passed
- deal_room_accessed
- kyc_submitted
- kyc_approved
- agreement_viewed

"Full compliance. Full transparency. Zero manual work for stages 2-5."

---

## Closing (15 seconds)

**[Show architecture diagram or README]**

"Amara is built with:"
- Qwen Cloud for AI reasoning
- Turso for persistent memory
- Resend for email delivery
- Next.js for the full-stack app

"Human-in-the-loop checkpoints are architecturally enforced. The agent can't bypass compliance."

**[Show GitHub repository]**

"Fully open source. Ready for production. Built for FutureX, built with Qwen."

**[End screen]**
- **Repository**: github.com/osasisorae/amara-investor-agent
- **Built by**: Osas Isorae
- **Contact**: her@investfuturex.com

---

## Key Points to Emphasize

1. **Autonomous but Compliant**: Amara handles 6 of 8 stages autonomously, with 2 hard human checkpoints
2. **Qwen Integration**: Every conversation uses Qwen for reasoning, knowledge base Q&A, and qualification
3. **Persistent Memory**: Full conversation history and state stored in Turso
4. **Audit Trail**: Every action logged with timestamp, IP, user agent
5. **Real-World Use Case**: Solving a genuine problem for Nigerian diaspora investors
6. **Production-Ready**: Full deployment guide, error handling, email templates

---

## Technical Highlights for Judges

- **Agent Orchestrator**: Routes messages by stage, enforces state transitions
- **RAG Implementation**: Knowledge base loaded as context for deal room queries
- **Human Gates**: Architecturally enforced at offeree registration and KYC approval
- **Email Automation**: Outreach and approval emails sent automatically via Resend
- **Cross-Session Memory**: Conversation state persists across sessions in Turso
- **Alibaba Cloud Proof**: Deployment guide includes ECS setup instructions

---

## Demo Environment Setup

Before recording:

1. ✅ Database migrated (`npm run db:migrate`)
2. ✅ Dev server running (`npm run dev`)
3. ✅ Email inbox ready to show (use real email or Resend test)
4. ✅ Browser windows prepared (admin + investor chat)
5. ✅ Screen recording software ready (OBS, Loom, etc.)
6. ✅ GitHub repository updated and public
7. ✅ Test the full flow once before recording

---

## Recording Tips

- Keep the pace brisk but clear
- Show actual functionality, not just slides
- Highlight Qwen API calls in real-time
- Emphasize the human checkpoints visually
- Show the audit trail in the database
- End with the GitHub repository

**Total Time: ~3 minutes**

Good luck! 🚀
