# Amara Investor Agent

**Qwen Cloud Hackathon 2026 — Track 4: Autopilot Agent**

Amara is an AI-powered investor onboarding agent for FutureX, a real estate syndication company targeting Nigerian diaspora investors. Named after the founder Chimara, Amara handles the full investor pipeline from first outreach to signed agreement — with human-in-the-loop checkpoints enforced by Nigerian securities law.

---

## What Amara Does

Amara is **not a chatbot**. She is an autonomous workflow agent that:

- ✅ Initiates personalized outreach after human approval
- ✅ Qualifies investors via structured conversation
- ✅ Serves deal room materials conditionally based on qualification
- ✅ Triages KYC document intake
- ✅ Unlocks investment agreements only after human compliance approval
- ✅ Captures a legally defensible audit trail at every step

---

## 8-Stage Agent Flow

| Stage | Actor | Action |
|-------|-------|--------|
| 1 | Human | Adds email to offeree register via admin dashboard |
| 2 | Amara | Sends personalized first outreach email |
| 3 | Amara | Runs qualification conversation via chat interface |
| 4 | Amara | Grants deal room access. Answers due diligence questions via RAG |
| 5 | Amara | Collects KYC intake — documents uploaded and flagged for review |
| 6 | Human | Reviews KYC in admin dashboard. Approves or rejects |
| 7 | Amara | Unlocks and sends agreement after human approval. Captures audit trail |
| 8 | Amara | Sends SPV-specific payment instructions with exact reference |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 App Router + TypeScript + Tailwind CSS |
| Agent Reasoning | Qwen (via Qwen Cloud Model Studio API) |
| Persistent Memory | Turso (libSQL) — conversation state, lead status, audit trail |
| Email | Resend |
| File Storage | Cloudflare R2 (KYC documents) |
| Payment Operations | Grey Finance manual wire instructions + admin confirmation |
| Backend Deployment | Vercel |
| Auth | Custom JWT cookie auth using jose (`lib/admin-auth.ts`, `lib/investor-auth.ts`) |

---

## Legal Constraints (Baked into Architecture)

- ❌ No cold outreach to unapproved addresses
- ❌ No deal materials shown to unqualified leads
- ❌ AI is KYC triage only — human approval required
- ❌ Agreement unlocks only after human compliance approval
- ❌ Payment tied to specific SPV reference
- ✅ Privacy consent collected before KYC upload
- ✅ Full audit trail: OTP timestamp, IP, user-agent, agreement version, signed-at, document hash

---

## Project Structure

```
amara-investor-agent/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   ├── admin/        # Admin dashboard APIs
│   │   ├── chat/         # Investor chat APIs
│   │   └── kyc/          # KYC upload/review APIs
│   ├── admin/            # Admin dashboard UI
│   ├── chat/             # Investor chat interface
│   └── layout.tsx
├── lib/
│   ├── agent/            # Agent orchestration logic (`lib/agent/orchestrator.ts`)
│   ├── db/               # Database client and queries
│   ├── email/            # Email templates and sender
│   └── qwen/             # Qwen API integration
├── knowledge-base/        # Deal room markdown files
├── migrations/            # Database schema migrations
├── public/               # Static assets
└── components/           # Shared UI components
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- Turso CLI installed
- Qwen Cloud API key
- Resend API key
- Vercel account (for Blob storage)

### Installation

```bash
# Clone the repository
git clone git@github.com:osasisorae/amara-investor-agent.git
cd amara-investor-agent

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Fill in your API keys in .env

# Initialize database
turso db shell [your-database-name] < migrations/001_initial_schema.sql

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

---

## Environment Variables

See `.env.example` for all required variables:

### Core Services
- `QWEN_API_KEY` - Qwen Cloud API key for agent reasoning
- `QWEN_API_BASE_URL` - Qwen Cloud workspace endpoint
- `QWEN_MODEL` - Model to use (default: qwen-plus)

### Database
- `TURSO_DATABASE_URL` - Turso database connection string
- `TURSO_AUTH_TOKEN` - Turso authentication token

### Email
- `RESEND_API_KEY` - Resend email API key
- `RESEND_FROM_EMAIL` - Verified sender email (e.g., amara@investfuturex.com)

### File Storage
- `FILE_STORAGE_PROVIDER` - Choose 'cloudflare-r2' or 'vercel-blob'
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` - Cloudflare R2 credentials
- `R2_BUCKET_NAME` - R2 bucket name (e.g., amara-kyc)
- `R2_ENDPOINT` - R2 endpoint URL
- Or: `BLOB_READ_WRITE_TOKEN` - Vercel Blob storage token (alternative)

### Payment Details
- `FUTUREX_NGN_ACCOUNT_NUMBER` - Grey/NGN receiving account number
- `FUTUREX_NGN_SORT_CODE` - NGN bank sort code
- `FUTUREX_USD_ACCOUNT_NUMBER` - USD receiving account number
- `FUTUREX_USD_ROUTING_NUMBER` - USD routing number
- `FUTUREX_USD_SWIFT` - USD SWIFT code
- `FUTUREX_USDC_ETH_ADDRESS` - USDC on Ethereum wallet
- `FUTUREX_USDC_SOL_ADDRESS` - USDC on Solana wallet
- `FUTUREX_USDC_BNB_ADDRESS` - USDC on BNB Chain wallet
- `FUTUREX_USDT_BNB_ADDRESS` - USDT on BNB Chain wallet
- `FUTUREX_USDT_TRX_ADDRESS` - USDT on TRON wallet

### Authentication
- `ADMIN_EMAIL` - Admin dashboard login email
- `ADMIN_PASSWORD` - Admin dashboard password
- `ADMIN_JWT_SECRET` - JWT signing secret for admin session cookies
- `INVESTOR_JWT_SECRET` - Optional dedicated JWT signing secret for investor session cookies

### App Configuration
- `NEXT_PUBLIC_APP_URL` - Your app URL (http://localhost:3000 for dev)
- `NODE_ENV` - Environment (development/production)
- `DEMO_MODE` - Set to 'true' to skip OTP verification (testing only)

---

## Demo Video Script

The hackathon submission video will demonstrate:

1. Admin adds email → Amara sends outreach email
2. Investor opens chat → qualifies through conversation
3. Investor accesses deal room → asks a due diligence question → Amara answers from knowledge base
4. Investor uploads KYC → Amara flags for review
5. Admin approves KYC → Amara unlocks agreement
6. Investor signs → full audit trail captured

**One complete end-to-end run. One investor.**

---

## Success Criteria

**For Judges:**
- Amara handles ambiguous investor inputs gracefully
- Human-in-the-loop checkpoints are visible and enforced
- Qwen persistent memory demonstrates cross-session recall
- Backend proof on Alibaba Cloud provided
- Architecture diagram is clean and accurate

**For FutureX:**
- First real investor onboarded through Amara post-hackathon
- Founder removed from stages 2–5 entirely

---

## License

MIT License - See [LICENSE](LICENSE) for details.

---

## Team

**Builder:** Osas Isorae  
**Company:** FutureX  
**Contact:** amara@investfuturex.com  
**Hackathon:** Qwen Cloud Hackathon 2026 — Track 4: Autopilot Agent  
**Submission Deadline:** July 9, 2026

---

Built with ❤️ for Nigerian diaspora investors.
