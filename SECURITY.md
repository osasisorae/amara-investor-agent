# Security

## Summary

| ID | Severity | Area | Status |
| --- | --- | --- | --- |
| SEC-001 | Critical | Authentication | RESOLVED |
| SEC-002 | Critical | Data Exposure | RESOLVED |
| SEC-003 | High | Authorization | RESOLVED |
| SEC-004 | High | Authentication | RESOLVED |
| SEC-005 | High | OTP Security | RESOLVED |
| SEC-006 | High | OTP Security | RESOLVED |
| SEC-007 | High | Agent / Prompt Injection | RESOLVED |
| SEC-008 | High | Agent / Prompt Injection | RESOLVED |
| SEC-009 | High | Data Retention | RESOLVED |
| SEC-010 | Medium | Authentication | OPEN |
| SEC-011 | Medium | Authentication | RESOLVED |
| SEC-012 | Medium | Input Validation | RESOLVED |
| SEC-013 | Medium | Authorization | RESOLVED |
| SEC-014 | Medium | JWT Hardening | RESOLVED |
| SEC-015 | Medium | Secrets & Environment | RESOLVED |
| SEC-016 | Medium | Secrets & Environment | RESOLVED |
| SEC-017 | Medium | Data Exposure | RESOLVED |
| SEC-018 | Medium | Email & External API | RESOLVED |
| SEC-019 | Medium | Email & External API | OPEN |
| SEC-020 | Medium | Data Exposure | OPEN |
| SEC-021 | Medium | Data Exposure | OPEN |
| SEC-022 | Low | Authentication | RESOLVED |
| SEC-023 | Low | OTP Security | OPEN |
| SEC-024 | Low | JWT Hardening | RESOLVED |
| SEC-025 | Low | Secrets & Environment | RESOLVED |
| SEC-026 | Low | Logging | RESOLVED |

## Vulnerability Disclosure Policy

Please report security vulnerabilities by email only. Do not open public GitHub issues, pull requests, or discussions for security reports.

Send reports to: `info@investfuturex.com`

Please include:

- A clear description of the issue
- Steps to reproduce it
- The affected URL, route, or file if known
- Any proof of concept, screenshots, or logs that help validate the report
- Your preferred name for acknowledgment if the report is accepted

Expected response time:

- Acknowledgment within 3 business days
- Initial triage update within 7 business days
- A remediation timeline after validation, based on severity and operational impact

What reporters can expect:

- Confirmation that the report was received
- A decision on whether the issue is valid and in scope
- A fix timeline or mitigation update once triage is complete
- Credit after remediation if requested and appropriate

## Known Vulnerabilities (Audit — 2026-06-28)

---
ID: SEC-001
Severity: Critical
Area: Authentication
File: app/api/chat/[leadId]/route.ts (line 162)
Status: RESOLVED
Description: The chat route GET and POST handlers do not verify the investor session before loading or mutating a conversation. Any caller with a valid leadId can fetch the chat and receive a fresh investor session cookie.
Resolved: Added investor session verification and route leadId checks to both chat handlers, and removed session cookie minting from the route.
Fix planned: Yes
---

---
ID: SEC-002
Severity: Critical
Area: Data Exposure
File: app/api/chat/[leadId]/route.ts (line 178)
Status: RESOLVED
Description: The public chat GET route returns the full lead row and complete message history. This exposes investor data and conversation history to any caller who knows a valid leadId.
Resolved: The GET handler now requires a verified investor session for the same leadId and returns only the chat-safe lead fields needed by the UI.
Fix planned: Yes
---

---
ID: SEC-003
Severity: High
Area: Authorization
File: app/agreement/[leadId]/page.tsx (line 23)
Status: RESOLVED
Description: The agreement page is not bound to an investor session. Any holder of a KYC approved leadId can load the agreement page and view the investor agreement details.
Resolved: The agreement page now requires a matching investor session and redirects unauthenticated users into the verified access flow before rendering.
Fix planned: Yes
---

---
ID: SEC-004
Severity: High
Area: Authentication
File: app/api/agreement/[leadId]/otp/route.ts (line 13), app/api/agreement/[leadId]/sign/route.ts (line 28)
Status: RESOLVED
Description: Agreement OTP issuance and agreement signing are handled by public routes with no investor session verification. Sensitive signing actions are therefore authorized only by leadId and OTP.
Resolved: Both agreement OTP issuance and signing routes now require a verified investor session for the matching leadId before any action is processed.
Fix planned: Yes
---

---
ID: SEC-005
Severity: High
Area: OTP Security
File: app/api/chat/access/route.ts (line 35), app/api/agreement/[leadId]/otp/route.ts (line 13), app/api/agreement/[leadId]/sign/route.ts (line 28)
Status: RESOLVED
Description: OTP generation and verification flows have no rate limiting, cooldown, or brute force protection. Attackers can repeatedly request or guess codes without any server side throttling.
Resolved: Added OTP send cooldowns, per-window send limits, in-memory IP throttles, and verification attempt limits for both chat access and agreement signing flows.
Fix planned: Yes
---

---
ID: SEC-006
Severity: High
Area: OTP Security
File: lib/db/otp.ts (line 35)
Status: RESOLVED
Description: OTP codes are stored in plaintext in the database. A database read exposes active verification codes directly.
Resolved: OTP codes are now stored as HMAC-SHA256 hashes at rest, while verification supports a short compatibility window for older plaintext codes that may still exist.
Fix planned: Yes
---

---
ID: SEC-007
Severity: High
Area: Agent / Prompt Injection
File: lib/agent/orchestrator.ts (line 1296)
Status: RESOLVED
Description: Investor message text is passed directly into the Qwen conversation with no sanitization or policy boundary beyond the prompt. A malicious user can attempt prompt injection against the agent workflow.
Resolved: Investor messages are now normalized, bounded, wrapped as untrusted input, and sent under an explicit server-side security boundary before reaching Qwen.
Fix planned: Yes
---

---
ID: SEC-008
Severity: High
Area: Agent / Prompt Injection
File: lib/agent/orchestrator.ts (line 1363), lib/agent/orchestrator.ts (line 1457)
Status: RESOLVED
Description: The server executes model returned tool calls, including update_lead_stage, without a strict server side transition policy. A successful prompt injection could drive unauthorized stage changes.
Resolved: Tool execution is now stage-gated at runtime, invalid tool calls are denied safely, and lead stage changes are enforced against a server-side transition graph.
Fix planned: Yes
---

---
ID: SEC-009
Severity: High
Area: Data Retention
File: lib/db/leads.ts (line 90), app/api/admin/kyc/[leadId]/route.ts (line 363), app/api/kyc/[leadId]/documents/route.ts (line 120)
Status: RESOLVED
Description: KYC files are not reliably deleted from R2 when a lead is deleted, when KYC is rejected, or when document removal fails. Sensitive files can remain in object storage after the database record is gone.
Resolved: Lead deletion and KYC rejection now purge R2 objects before database cleanup, and investor-side document removal aborts if storage deletion fails so metadata is retained until cleanup succeeds.
Fix planned: Yes
---

---
ID: SEC-010
Severity: Medium
Area: Authentication
File: app/api/
Status: OPEN
Description: Authentication enforcement is route by route with no middleware layer. This makes missing checks easy to introduce by omission, as shown by the current chat and agreement gaps.
Fix planned: Yes
---

---
ID: SEC-011
Severity: Medium
Area: Authentication
File: app/api/admin/auth/route.ts (line 24)
Status: RESOLVED
Description: Admin login has no rate limiting, lockout, or login attempt controls. Repeated credential guessing is not throttled.
Resolved: Admin login now applies server-side sliding-window throttles per IP and per IP plus email combination before a session is issued.
Fix planned: Yes
---

---
ID: SEC-012
Severity: Medium
Area: Input Validation
File: app/api/kyc/[leadId]/upload/route.ts (line 192)
Status: RESOLVED
Description: KYC upload validation relies on file extension and MIME type only. There is no magic byte or file signature inspection to confirm the uploaded content is actually an allowed document type.
Resolved: KYC uploads now validate JPEG, PNG, and PDF magic bytes and reject files whose binary signature does not match the claimed file type.
Fix planned: Yes
---

---
ID: SEC-013
Severity: Medium
Area: Authorization
File: app/api/agreement/[leadId]/otp/route.ts (line 49)
Status: RESOLVED
Description: Agreement OTP issuance persists slot count before any session verification. A caller who knows a leadId can tamper with the stored commitment selection and disrupt the signing flow.
Resolved: Agreement OTP issuance now verifies the investor session before persisting slot count, preventing unauthorized commitment tampering by leadId alone.
Fix planned: Yes
---

---
ID: SEC-014
Severity: Medium
Area: JWT Hardening
File: lib/investor-auth.ts (line 15)
Status: RESOLVED
Description: Investor JWT signing falls back to the admin JWT secret when INVESTOR_JWT_SECRET is not set. This collapses the admin and investor trust domains onto one shared secret.
Resolved: Investor session signing and verification now require a dedicated INVESTOR_JWT_SECRET with no fallback to the admin signing secret.
Fix planned: Yes
---

---
ID: SEC-015
Severity: Medium
Area: Secrets & Environment
File: lib/admin-auth.ts (line 14), lib/investor-auth.ts (line 15)
Status: RESOLVED
Description: JWT secrets are not validated at startup. Missing values only fail at first use, which increases the risk of misconfigured deployments reaching runtime.
Resolved: Security-sensitive environment variables are now validated during server startup so missing JWT and related authentication configuration fails closed before the app serves requests.
Fix planned: Yes
---

---
ID: SEC-016
Severity: Medium
Area: Secrets & Environment
File: lib/agent/orchestrator.ts (line 83), lib/kyc/submission.ts (line 27)
Status: RESOLVED
Description: Sensitive operational email notifications fall back to a hardcoded personal address if the admin alert env var is missing. That creates a risk of misrouted investor or compliance communications.
Resolved: ADMIN_ALERT_EMAIL is now required and validated as an email address before operational notifications can be sent.
Fix planned: Yes
---

---
ID: SEC-017
Severity: Medium
Area: Data Exposure
File: app/api/kyc/[leadId]/upload/route.ts (line 93), app/api/kyc/[leadId]/upload/route.ts (line 256)
Status: RESOLVED
Description: Upload error responses expose internal failure details to investors, including missing R2 environment keys and raw error messages. This leaks operational configuration information.
Resolved: KYC upload responses now return generic storage and failure messages without exposing missing environment keys or raw internal errors to investors.
Fix planned: Yes
---

---
ID: SEC-018
Severity: Medium
Area: Email & External API
File: app/api/chat/access/route.ts (line 35), app/api/agreement/[leadId]/otp/route.ts (line 13)
Status: RESOLVED
Description: Public OTP endpoints can trigger repeated emails to known leads with no throttling. This creates an email abuse and nuisance risk.
Resolved: Public OTP issuance now enforces cooldowns, per-window limits, and IP-based throttling before any access or agreement code email is sent.
Fix planned: Yes
---

---
ID: SEC-019
Severity: Medium
Area: Email & External API
File: app/api/rates/route.ts (line 42)
Status: OPEN
Description: The rates endpoint is unauthenticated and can be queried repeatedly with varying amounts to bypass the short cache. This can be abused to exhaust Grey API quota.
Fix planned: Yes
---

---
ID: SEC-020
Severity: Medium
Area: Data Exposure
File: app/api/kyc/[leadId]/risk-declarations/route.ts (line 85), app/api/agreement/[leadId]/sign/route.ts (line 124)
Status: OPEN
Description: Full risk declaration answers and detailed agreement signing metadata are stored in audit_events. The audit trail therefore contains sensitive investor compliance and signing data.
Fix planned: Yes
---

---
ID: SEC-021
Severity: Medium
Area: Data Exposure
File: app/api/chat/access/route.ts (line 87), app/api/agreement/[leadId]/sign/route.ts (line 137)
Status: OPEN
Description: The application logs x-forwarded-for directly as the client IP without proxy trust validation. This makes the recorded IP address spoofable and unreliable as an audit field.
Fix planned: Yes
---

---
ID: SEC-022
Severity: Low
Area: Authentication
File: app/api/admin/auth/route.ts (line 44)
Status: RESOLVED
Description: Admin authentication compares supplied credentials directly against configured values with no throttling. This is a weaker form of the broader login hardening issue.
Resolved: Admin credential verification now runs behind rate limits and uses constant-time hash comparison instead of direct string equality.
Fix planned: Yes
---

---
ID: SEC-023
Severity: Low
Area: OTP Security
File: lib/db/otp.ts (line 15)
Status: OPEN
Description: OTP generation uses a cryptographically sound random source and a 10 minute expiry window. This is not a flaw by itself, but the current window should be reviewed in the context of missing rate limits.
Fix planned: Yes
---

---
ID: SEC-024
Severity: Low
Area: JWT Hardening
File: lib/admin-auth.ts (line 14), lib/investor-auth.ts (line 15)
Status: RESOLVED
Description: JWT secret strength is not validated at startup. Short or weak secrets would still be accepted if provided in the environment.
Resolved: Admin and investor JWT secrets now enforce a minimum length during startup validation before any signing or verification code runs.
Fix planned: Yes
---

---
ID: SEC-025
Severity: Low
Area: Secrets & Environment
File: lib/grey/rates.ts (line 79)
Status: RESOLVED
Description: Grey rates integration fails open by returning null when the API key is missing. The application degrades gracefully, but the missing secret can go unnoticed until runtime.
Resolved: GREY_API_KEY is now required during server startup and the Grey rates integration no longer degrades silently when the API key is missing.
Fix planned: Yes
---

---
ID: SEC-026
Severity: Low
Area: Logging
File: app/api/kyc/[leadId]/upload/route.ts (line 86), app/api/kyc/[leadId]/upload/route.ts (line 252), lib/storage/r2.ts (line 70)
Status: RESOLVED
Description: Server logs in the KYC upload path include lead IDs, filenames, and full error stacks. These logs increase exposure of sensitive identifiers and operational details.
Resolved: KYC upload and R2 storage logs now avoid lead IDs, filenames, and raw error stacks while retaining high-level failure signals.
Fix planned: Yes
---
