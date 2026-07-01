# Architecture: FutureX Investor Onboarding Agent

## System Overview

The system is a stateful multi-stage agent pipeline. The frontend serves both the investor-facing chat interface and the admin dashboard. The backend orchestrates agent logic, memory, email, and file handling. Qwen Cloud provides the reasoning layer. Every agent action is logged to a persistent audit trail in Turso.

---

## Component Map

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND (Next.js)                   │
│                                                             │
│  ┌──────────────────┐        ┌──────────────────────────┐  │
│  │  Investor Chat   │        │     Admin Dashboard      │  │
│  │  Interface       │        │  - Offeree Register      │  │
│  │  - Qualification │        │  - Pipeline view         │  │
│  │  - Deal Room     │        │  - KYC review/approve    │  │
│  │  - KYC Upload    │        │  - Audit trail view      │  │
│  │  - Agreement Sign│        │                          │  │
│  └────────┬─────────┘        └────────────┬─────────────┘  │
└───────────┼──────────────────────────────┼─────────────────┘
            │ API Routes                   │ API Routes
┌───────────▼──────────────────────────────▼─────────────────┐
│                     BACKEND (Next.js API)                   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Agent Orchestrator                      │   │
│  │  - Stage manager (reads/writes lead stage to DB)    │   │
│  │  - Routes message to correct agent behavior         │   │
│  │  - Enforces human-in-the-loop gates                 │   │
│  └──────┬──────────────┬───────────────────────────────┘   │
│         │              │                                    │
│  ┌──────▼──────┐ ┌─────▼────────────────────────────────┐  │
│  │  Qwen Cloud │ │         Memory & State Layer          │  │
│  │  Model API  │ │  Turso (libSQL)                       │  │
│  │             │ │  - leads table                        │  │
│  │  - Chat     │ │  - messages table                     │  │
│  │  - RAG Q&A  │ │  - qualification_answers table        │  │
│  │  - Email    │ │  - kyc_documents table                │  │
│  │    drafting │ │  - audit_events table                 │  │
│  └─────────────┘ │  - offeree_register table             │  │
│                  └───────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────┐  ┌───────────────┐  ┌─────────────────┐  │
│  │    Resend    │  │ File Storage  │  │  Knowledge Base │  │
│  │  (outreach + │  │ (KYC docs)    │  │  (markdown      │  │
│  │   agreement  │  │               │  │   files → RAG   │  │
│  │   delivery)  │  │               │  │   context)      │  │
│  └──────────────┘  └───────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                    Alibaba Cloud ECS
                    (Backend deployment)
```

---

## Data Flow Per Stage

### Stage 1 — Admin adds offeree
```
Admin UI → POST /api/admin/offeree → Insert into offeree_register → Trigger Stage 2
```

### Stage 2 — First outreach
```
Trigger → Agent drafts email (Qwen) → Send via Resend → Log audit_event(outreach_sent)
```

### Stage 3 — Qualification
```
Investor opens chat link → GET /api/chat/[leadId] → Load conversation history from Turso
→ Each message: POST /api/chat/[leadId]/message
→ Qwen evaluates qualification criteria
→ On pass: update lead.stage = 'deal_room', log audit_event
→ On fail: update lead.stage = 'disqualified', send closure email
```

### Stage 4 — Deal room
```
Investor asks question → POST /api/chat/[leadId]/message
→ Agent loads knowledge base context → Qwen generates answer
→ Out-of-scope questions → flag for human follow-up
→ All exchanges logged to messages table
```

### Stage 5 — KYC intake
```
Investor uploads documents → POST /api/kyc/[leadId]/upload
→ Files stored in file storage → metadata in kyc_documents table
→ Lead stage = 'pending_human_review'
→ Agent frozen — no further AI responses until admin acts
→ Admin notified via email
```

### Stage 6 — Human KYC review (HARD GATE)
```
Admin reviews in dashboard → POST /api/admin/kyc/[leadId]/decision
→ Approved: lead.stage = 'agreement_pending', log audit_event(kyc_approved)
→ Rejected: lead.stage = 'kyc_rejected', agent sends rejection email
```

### Stage 7 — Agreement
```
KYC approval trigger → Agent generates agreement link
→ Investor views agreement → log audit_event(agreement_viewed, timestamp, IP, user-agent)
→ Investor signs (typed name + OTP) → log audit_event(agreement_signed, name, OTP_timestamp, doc_hash)
→ Lead stage = 'agreement_signed'
```

### Stage 8 — Payment instructions
```
Signature trigger → Agent sends SPV-specific payment instructions via Resend
→ Payment reference tied to this lead + this SPV only
→ Admin notified to watch for inbound
```

---

## Database Schema (Turso)

```sql
-- Core lead record
CREATE TABLE leads (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  stage TEXT NOT NULL DEFAULT 'outreach_sent',
  -- stages: outreach_sent | qualifying | deal_room | kyc_intake | 
  --         pending_human_review | kyc_rejected | agreement_pending |
  --         agreement_signed | payment_pending | closed
  added_by TEXT NOT NULL,
  added_at INTEGER NOT NULL,
  approved_at INTEGER,
  approved_by TEXT
);

-- Full conversation history
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL,
  role TEXT NOT NULL, -- 'agent' | 'investor'
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- Qualification answers
CREATE TABLE qualification_answers (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  passed INTEGER NOT NULL -- 0 | 1
);

-- KYC documents
CREATE TABLE kyc_documents (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL,
  doc_type TEXT NOT NULL,
  file_url TEXT NOT NULL,
  uploaded_at INTEGER NOT NULL
);

-- Full audit trail
CREATE TABLE audit_events (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  metadata TEXT, -- JSON blob
  ip_address TEXT,
  user_agent TEXT,
  created_at INTEGER NOT NULL
);

-- Offeree register
CREATE TABLE offeree_register (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  added_by TEXT NOT NULL,
  added_at INTEGER NOT NULL,
  notes TEXT
);
```

---

## Qwen Integration Pattern

```typescript
// Every agent call follows this pattern
const response = await fetch("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${process.env.QWEN_API_KEY}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    model: "qwen-plus", // or qwen-turbo for speed
    messages: [
      { role: "system", content: STAGE_SYSTEM_PROMPT },
      ...conversationHistory, // full history from Turso
      { role: "user", content: investorMessage }
    ]
  })
});
```

Each stage has its own system prompt. The orchestrator selects the correct prompt based on `lead.stage`.

---

## Diagram Generation Prompt

Use this prompt with any diagram tool (Claude, Mermaid, Eraser.io, Whimsical):

```
Generate a system architecture diagram for a hackathon project called "FutureX Investor Onboarding Agent."

The system has these components:
- Next.js frontend with two interfaces: Investor Chat Interface and Admin Dashboard
- Next.js API backend with an Agent Orchestrator at the center
- Qwen Cloud API (external) connected to the orchestrator for AI reasoning
- Turso (libSQL) database for persistent memory and audit trail
- Resend for email delivery
- File Storage for KYC documents
- A Knowledge Base (markdown files) used for RAG context injection
- Alibaba Cloud ECS as the deployment host for the backend

The flow:
1. Admin adds an email via dashboard → triggers agent
2. Agent sends outreach email via Resend
3. Investor opens chat → qualification conversation with Qwen
4. Qualified investor enters deal room → Qwen answers questions using knowledge base context
5. Investor uploads KYC → agent freezes → admin notified
6. Admin approves KYC in dashboard → agent resumes
7. Agent sends agreement → investor signs → audit trail captured in Turso
8. Agent sends payment instructions → admin monitors

Show two explicit HUMAN CHECKPOINT markers at: (1) offeree registration and (2) KYC approval.
Style: clean, technical, suitable for a hackathon submission. Use boxes and arrows. Label all connections.
```

---

## Environment Variables Required

```
QWEN_API_KEY=
TURSO_DATABASE_URL=
TURSO_AUTH_TOKEN=
RESEND_API_KEY=
FILE_STORAGE_URL=
FILE_STORAGE_KEY=
ADMIN_EMAIL=
ADMIN_PASSWORD=
ADMIN_JWT_SECRET=
INVESTOR_JWT_SECRET=
ADMIN_ALERT_EMAIL=
```
