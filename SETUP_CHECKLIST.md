# Pre-Build Setup Checklist

## ✅ Already Complete
- [x] Qwen Cloud API key configured and tested
- [x] Turso database created (futurex-osasisorae.aws-us-east-1.turso.io)
- [x] Resend API key obtained
- [x] Admin credentials defined

---

## 🔴 Critical - Complete Before Building

### 1. Generate NextAuth Secret
**Why:** Required for secure session management in the admin dashboard

```bash
openssl rand -base64 32
```

Add the output to `.env` as `NEXTAUTH_SECRET=`

---

### 2. Verify Resend Domain or Use Test Domain
**Why:** Resend won't send emails without a verified domain

**Option A (Fastest for hackathon):**
Use Resend's test domain: `onboarding@resend.dev`
- Already added to `.env` as `RESEND_FROM_EMAIL`
- Emails will only deliver to your verified email address (osasisorae@gmail.com)

**Option B (Production-ready):**
Verify your own domain in Resend dashboard
- Add DNS records
- Update `RESEND_FROM_EMAIL` in `.env`

**Test now:**
```bash
curl -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer re_8tEYjXZa_QG49kunGaLZYnT1zct5JYJkB" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "onboarding@resend.dev",
    "to": "osasisorae@gmail.com",
    "subject": "FutureX Test",
    "text": "Email delivery working!"
  }'
```

---

### 3. Initialize Turso Database Schema
**Why:** The database tables defined in architecture.md don't exist yet

**Run this after we scaffold the project:**
```bash
turso db shell futurex-osasisorae < migrations/001_initial_schema.sql
```

We'll generate the migration file during setup.

---

### 4. Choose File Storage Provider
**Why:** Need to store KYC documents somewhere

**Option A (Recommended for hackathon): Vercel Blob**
- Deploy Next.js app to Vercel first
- Vercel auto-provisions blob storage
- Get token from Vercel dashboard → Storage tab
- Add to `.env` as `BLOB_READ_WRITE_TOKEN`

**Option B: Cloudflare R2**
- Create R2 bucket: `futurex-kyc-docs`
- Get credentials from Cloudflare dashboard
- Add to `.env` (R2 variables)

**Decision needed:** Which one do you want to use?

---

## 🟡 Medium Priority - Can Build First, Add Later

### 5. OTP Implementation Decision
**Why:** Stage 7 (agreement signing) requires OTP verification

**Current plan in `.env`:** Email-based OTP via Resend
- No additional service needed
- Code will generate 6-digit OTP
- Send via Resend API
- Store in database with expiry

**Alternative:** For production, you might want SMS via Twilio

**Action:** None required now. We'll implement email OTP first.

---

## 🟢 Optional - Nice to Have

### 6. Demo Mode Flag
Already added to `.env` as `DEMO_MODE=false`

When testing, set to `true` to:
- Skip real OTP verification (use any code)
- Add seed data automatically
- Show debug info in UI

---

## Next Steps (Answer These)

From your earlier questions, we need to decide:

### A. Knowledge Base Format for RAG (Stage 4)
**Question:** How should we implement the deal room knowledge base?

**Options:**
1. **Simple context injection** (fastest for hackathon)
   - Store markdown files in `/knowledge-base/` folder
   - On investor question, load ALL markdown as context
   - Let Qwen answer from full context
   - No vector database needed

2. **Basic embeddings** (more sophisticated)
   - Use OpenAI/Qwen embeddings API
   - Store vectors in Turso (supports vector search)
   - Semantic search for relevant docs
   - More tokens-efficient but adds complexity

**Recommendation:** Start with Option 1 for hackathon. It works great for small knowledge bases (5-10 docs).

### B. File Storage Final Decision
**Question:** Vercel Blob or Cloudflare R2?

**Recommendation:** Vercel Blob (simpler, auto-provisions)

---

## Ready to Start Building?

Once you:
1. Generate and add `NEXTAUTH_SECRET`
2. Confirm Resend is working (run curl test above)
3. Decide on knowledge base approach (Option 1 or 2)
4. Confirm file storage choice (Vercel Blob recommended)

Then I'll scaffold:
- Next.js project structure
- Database migrations
- Agent orchestrator skeleton
- Knowledge base folder with sample docs
- Initial admin dashboard
