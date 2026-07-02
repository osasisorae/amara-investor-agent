# Codebase Snapshot

Snapshot date: 2026-07-02
Branch: `main`
Commit: `2b3156e`

## What This Repo Is

This is a Next.js 14 App Router application for FutureX's "Amara" investor onboarding flow.

The live product currently includes:

- public investor access via `/chat`
- authenticated investor workspaces via `/chat/[leadId]`
- KYC intake and agreement signing flows
- admin review and payment confirmation flows
- JWT cookie auth with route middleware
- Turso-backed lead, message, KYC, OTP, and audit persistence
- Resend email delivery
- Cloudflare R2 document storage
- Grey rate lookups and manual payment instruction handling

## Active Runtime Structure

### App pages

- `/` -> landing page
- `/chat` -> investor email + OTP access flow
- `/chat/[leadId]` -> authenticated investor workspace / deal room
- `/agreement/[leadId]` -> authenticated agreement review + signing
- `/admin` -> authenticated admin dashboard
- `/admin/login` -> admin login

### API routes

#### Admin

- `/api/admin/auth`
- `/api/admin/leads`
- `/api/admin/leads/[leadId]`
- `/api/admin/offeree`
- `/api/admin/kyc/[leadId]`
- `/api/admin/kyc/[leadId]/documents`
- `/api/admin/kyc/[leadId]/document-url`
- `/api/admin/payment/[leadId]`

#### Investor access and chat

- `/api/chat/access`
- `/api/chat/[leadId]`
- `/api/chat/[leadId]/messages`

#### KYC and agreement

- `/api/kyc/[leadId]/personal-details`
- `/api/kyc/[leadId]/investor-profile`
- `/api/kyc/[leadId]/documents`
- `/api/kyc/[leadId]/upload`
- `/api/kyc/[leadId]/funding-source`
- `/api/kyc/[leadId]/risk-declarations`
- `/api/kyc/[leadId]/payment-account`
- `/api/agreement/[leadId]/otp`
- `/api/agreement/[leadId]/sign`

#### Payment and rates

- `/api/payment/[leadId]/confirm-sent`
- `/api/rates`

### Core runtime directories

- `app/` -> pages and route handlers
- `components/` -> admin, deal-room, and KYC UI components
- `lib/agent/` -> orchestration, prompts, qualification logic
- `lib/agreement/` -> agreement template and commitment selection
- `lib/chat/` -> component payloads and access-link helpers
- `lib/db/` -> Turso data access
- `lib/email/` -> Resend client + templates
- `lib/grey/` -> FX rate integration
- `lib/knowledge-base/` -> structured deal-room content parsing
- `lib/kyc/` -> KYC requirements + submission logic
- `lib/security/` -> env validation, middleware auth support, IP parsing, rate limits
- `lib/storage/` -> Cloudflare R2 helpers
- `public/` -> shipped static images and markdown deal docs
- `migrations/` -> libSQL schema
- `scripts/` -> migration runner

## Runtime Notes

- `middleware.ts` is now part of the active security model. It protects admin routes, investor routes, and `/api/rates` before route handlers run.
- Session auth is environment-backed and JWT-cookie-based. It is not database-backed.
- KYC storage is R2-only in the current code. There is no active Blob storage implementation.
- The rate limiter is in-memory and process-local.

## Local-Only Or Ambiguous Content

These items exist in the workspace but are not clearly part of the tracked, reproducible app state:

- `knowledge-base/`
- `legal/`
- `research/`
- `pro-haul/`

Important detail:

- `knowledge-base/akwa-ibom-hospitality.md` and `knowledge-base/nigerian-real-estate-guide.md` are used by `lib/knowledge-base/loader.ts` and `lib/knowledge-base/deal-room-data.ts`.
- Those files are also covered by `.gitignore`, which means a fresh clone may not contain the knowledge-base content the app expects unless it is restored manually.
- `legal/` and `research/` appear to be supporting materials, not active runtime code.
- `pro-haul/` appears to be a separate local workspace and is not part of the Amara app.

## Hanging Or Placeholder Directories

These directories exist but currently have no route implementation:

- `app/payment`
- `app/api/payment/[leadId]/checkout`
- `app/api/payment/flutterwave/webhook`

They look like unfinished or abandoned payment work and should either be implemented, documented, or removed.

## Documentation Audit

### Current or mostly current

- `SECURITY.md`
- `CONTRIBUTING.md`
- `.env.example`

Notes:

- `.env.example` is closer to reality than the older docs, but it still contains compatibility variables and stale comments.
- `OTP_PROVIDER`, `OTP_EXPIRES_IN_MINUTES`, and `DEMO_MODE` appear in `.env.example` but are not part of the active runtime behavior.
- `NEXT_PUBLIC_BASE_URL` is still read in code and should not be labeled as purely legacy.

### Needs refresh

- `README.md`
- `DEPLOYMENT.md`
- `architecture.md`

Known drift:

- they still mention Vercel Blob even though the active storage code is R2-only
- they still mention Alibaba ECS or Railway even though the active deployment path is Vercel
- they describe route names that no longer exist, such as `/api/chat/[leadId]/message` and `/api/admin/kyc/[leadId]/decision`
- they describe audit details that were intentionally minimized in the recent security pass
- they do not describe the current middleware-based auth enforcement

### Archival or planning docs

- `PRD.md`
- `DEMO_SCRIPT.md`
- `SETUP_CHECKLIST.md`
- `CHAT_UI_IMPROVEMENTS.md`
- `kyc-v2-spec.md`

These are still useful as background, but they read like planning or hackathon artifacts rather than current source-of-truth documentation.

## Specific Documentation Mismatches

### README.md

- says `knowledge-base/` is part of the shipped project structure, but those files are currently ignored locally rather than clearly versioned
- documents `FILE_STORAGE_PROVIDER` and Vercel Blob as active options, but the code only implements R2 helpers
- documents `DEMO_MODE`, but the current runtime does not use it

### DEPLOYMENT.md

- says `admin_users` is part of the active auth story; current runtime auth uses environment credentials plus JWT cookies
- documents Blob setup as a required deployment step
- documents `OTP_PROVIDER` and `OTP_EXPIRES_IN_MINUTES`, which are not active runtime controls
- includes Alibaba ECS guidance that does not match the actual Vercel deployment path currently in use

### architecture.md

- uses outdated API route names
- still frames Alibaba ECS as the backend host
- does not show middleware or the current auth/session model
- describes older audit semantics that no longer match the minimized event payloads

### CONTRIBUTING.md

- tells contributors to copy `.env.example` to `.env.local`
- the actual local workflow in this repo currently uses `.env`

## Missing Documentation

The biggest missing pieces are:

- a single current source-of-truth document for the real route map and module ownership
- an explicit distinction between active docs and archival hackathon docs
- a short operations runbook for local setup, production env sync, deploy, and post-deploy verification
- a note explaining how required knowledge-base content is supposed to be versioned or restored
- a small auth smoke-test checklist for protected routes after each deploy

## Recommended Cleanup Order

1. Make `README.md`, `DEPLOYMENT.md`, and `architecture.md` reflect the current app, not the original plan.
2. Decide whether `knowledge-base/` should be tracked, moved, or generated; right now it is a reproducibility gap.
3. Mark planning docs as archival in their headings or move them into an archive folder.
4. Either implement or delete the empty payment route directories.
5. Add a concise production runbook and auth smoke-test checklist.
