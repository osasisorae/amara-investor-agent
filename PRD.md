# PRD: FutureX Investor Onboarding Agent
**Hackathon:** Qwen Cloud Hackathon — Track 4: Autopilot Agent  
**Submission Deadline:** July 9, 2026  
**Owner:** Osas Isorae  

---

## Problem Statement

FutureX is a real estate syndication company targeting Nigerian diaspora investors. The current investor acquisition process is entirely manual — cold outreach, sales calls, repeated Q&A over WhatsApp, document chasing, and KYC collection handled by the founder. This creates three failure points:

1. **Unscalable founder time** — every lead requires direct involvement
2. **Drop-off between interest and commitment** — leads go cold waiting for responses
3. **Compliance risk** — inconsistent process creates gaps in the audit trail

The agent automates stages 2–7 of the investor journey while enforcing two hard human-in-the-loop checkpoints required by Nigerian securities law (ISA 2025) and data protection regulation (NDPC GAID 2025).

---

## Solution Overview

An AI-powered investor onboarding agent that handles the full pipeline from first outreach to signed agreement — triggered by a human adding a verified email to the offeree register, ending when the human compliance officer approves KYC.

**This is not a chatbot. It is an autonomous workflow agent** that:
- Initiates outreach
- Qualifies investors via structured conversation
- Serves deal room materials conditionally
- Triages KYC intake
- Unlocks agreements only after human approval
- Captures a legally defensible audit trail at every step

---

## Legal Constraints (Non-Negotiable)

These constraints are baked into the architecture, not bolted on:

- **No cold outreach to unapproved addresses.** The agent only activates after a human adds an email to the offeree register.
- **No deal materials shown to unqualified leads.** Qualification gate is hard — fail = conversation closed.
- **AI is KYC triage only.** Agent collects documents and flags for review. It does not approve.
- **Agreement unlocks only after human compliance approval.** No code path bypasses this.
- **Payment tied to specific SPV reference.** No generic wallet, no pooled collection.
- **Privacy consent collected before KYC upload.** Separate explicit step, not bundled into T&Cs.
- **Full audit trail per investor:** OTP timestamp, IP, user-agent, agreement version, viewed-at, signed-at, document hash.

---

## 8-Stage Agent Flow

| Stage | Actor | Action |
|-------|-------|--------|
| 1 | Human | Adds email to offeree register via admin dashboard |
| 2 | Agent | Sends personalised first outreach email — access request, not pitch |
| 3 | Agent | Runs qualification conversation via chat interface |
| 4 | Agent | Grants deal room access to qualified leads. Serves SPV materials. Answers due diligence questions via RAG over knowledge base |
| 5 | Agent | Collects KYC intake — name, ID type, country of residence, document upload |
| 6 | Human | Reviews KYC in admin dashboard. Approves or rejects. Agent is frozen until decision |
| 7 | Agent | Unlocks and sends agreement after human approval. Captures full audit trail on sign |
| 8 | Agent | Sends SPV-specific payment instructions tied to exact reference. Logs receipt confirmation |

---

## Qualification Criteria (Stage 3)

Agent disqualifies and closes if any of these fail:
- Not Nigerian diaspora or verified local HNI
- Investment horizon under 3 years
- Ticket size below minimum (₦5m or USD equivalent)
- Unwilling to proceed through KYC

---

## Knowledge Base (Stage 4 RAG)

Agent answers due diligence questions from:
- FutureX company overview and operator thesis
- Akwa Ibom Hospitality SPV deal brief (returns, structure, timeline, exit)
- SPV legal structure explanation
- FX repatriation process for diaspora investors
- Risk disclosures
- FAQ compiled from real investor questions

Agent responses outside knowledge base scope: *"That question requires a direct conversation with our team. I'll flag it for follow-up."*

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js App Router + TypeScript + Tailwind |
| Agent reasoning | Qwen (via Qwen Cloud Model Studio API) |
| Persistent memory | Turso (libSQL) — conversation state, lead status, audit trail |
| Email | Resend |
| File storage | Cloudflare R2 or Vercel Blob (KYC documents) |
| Backend deployment | Alibaba Cloud ECS (pending verification) or Railway (interim) |
| Auth | Custom (same pattern as SIC) |

---

## Persistent Memory Requirements

The agent must remember across sessions:
- Which stage each lead is at
- Qualification answers already given
- Documents uploaded
- Admin approval status
- All messages exchanged
- Full audit trail events with timestamps

---

## Admin Dashboard Requirements

Minimal but functional:
- Add email to offeree register
- View lead pipeline by stage
- Review KYC documents and approve/reject
- View full conversation history per lead
- View audit trail per lead

---

## Demo Scope (Hackathon Submission)

The 3-minute video must show:
1. Admin adds email → agent sends outreach email
2. Investor opens chat → qualifies through conversation
3. Investor accesses deal room → asks a due diligence question → agent answers from knowledge base
4. Investor uploads KYC → agent flags for review
5. Admin approves KYC → agent unlocks agreement
6. Investor signs → audit trail captured

One complete end-to-end run. One investor. No edge cases needed for the demo.

---

## Out of Scope (Hackathon Build)

- Multiple SPVs
- Actual payment processing
- Full production KYC with real ID verification APIs
- Mobile app
- Investor portal beyond the onboarding flow

---

## Success Criteria

**For judges:**
- Agent handles ambiguous investor inputs gracefully
- Human-in-the-loop checkpoints are visible and enforced
- Qwen persistent memory demonstrates cross-session recall
- Backend proof on Alibaba Cloud provided
- Architecture diagram is clean and accurate

**For FutureX:**
- First real investor onboarded through the agent post-hackathon
- Founder removed from stages 2–5 entirely
