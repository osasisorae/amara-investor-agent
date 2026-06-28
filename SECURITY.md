# Security

## Summary

| ID | Severity | Area | Status |
| --- | --- | --- | --- |
| SEC-001 | Critical | Authentication | OPEN |
| SEC-002 | Critical | Data Exposure | OPEN |
| SEC-003 | High | Authorization | OPEN |
| SEC-004 | High | Authentication | OPEN |
| SEC-005 | High | OTP Security | OPEN |
| SEC-006 | High | OTP Security | OPEN |
| SEC-007 | High | Agent / Prompt Injection | OPEN |
| SEC-008 | High | Agent / Prompt Injection | OPEN |
| SEC-009 | High | Data Retention | OPEN |
| SEC-010 | Medium | Authentication | OPEN |
| SEC-011 | Medium | Authentication | OPEN |
| SEC-012 | Medium | Input Validation | OPEN |
| SEC-013 | Medium | Authorization | OPEN |
| SEC-014 | Medium | JWT Hardening | OPEN |
| SEC-015 | Medium | Secrets & Environment | OPEN |
| SEC-016 | Medium | Secrets & Environment | OPEN |
| SEC-017 | Medium | Data Exposure | OPEN |
| SEC-018 | Medium | Email & External API | OPEN |
| SEC-019 | Medium | Email & External API | OPEN |
| SEC-020 | Medium | Data Exposure | OPEN |
| SEC-021 | Medium | Data Exposure | OPEN |
| SEC-022 | Low | Authentication | OPEN |
| SEC-023 | Low | OTP Security | OPEN |
| SEC-024 | Low | JWT Hardening | OPEN |
| SEC-025 | Low | Secrets & Environment | OPEN |
| SEC-026 | Low | Logging | OPEN |

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
Status: OPEN
Description: The chat route GET and POST handlers do not verify the investor session before loading or mutating a conversation. Any caller with a valid leadId can fetch the chat and receive a fresh investor session cookie.
Fix planned: Yes
---

---
ID: SEC-002
Severity: Critical
Area: Data Exposure
File: app/api/chat/[leadId]/route.ts (line 178)
Status: OPEN
Description: The public chat GET route returns the full lead row and complete message history. This exposes investor data and conversation history to any caller who knows a valid leadId.
Fix planned: Yes
---

---
ID: SEC-003
Severity: High
Area: Authorization
File: app/agreement/[leadId]/page.tsx (line 23)
Status: OPEN
Description: The agreement page is not bound to an investor session. Any holder of a KYC approved leadId can load the agreement page and view the investor agreement details.
Fix planned: Yes
---

---
ID: SEC-004
Severity: High
Area: Authentication
File: app/api/agreement/[leadId]/otp/route.ts (line 13), app/api/agreement/[leadId]/sign/route.ts (line 28)
Status: OPEN
Description: Agreement OTP issuance and agreement signing are handled by public routes with no investor session verification. Sensitive signing actions are therefore authorized only by leadId and OTP.
Fix planned: Yes
---

---
ID: SEC-005
Severity: High
Area: OTP Security
File: app/api/chat/access/route.ts (line 35), app/api/agreement/[leadId]/otp/route.ts (line 13), app/api/agreement/[leadId]/sign/route.ts (line 28)
Status: OPEN
Description: OTP generation and verification flows have no rate limiting, cooldown, or brute force protection. Attackers can repeatedly request or guess codes without any server side throttling.
Fix planned: Yes
---

---
ID: SEC-006
Severity: High
Area: OTP Security
File: lib/db/otp.ts (line 35)
Status: OPEN
Description: OTP codes are stored in plaintext in the database. A database read exposes active verification codes directly.
Fix planned: Yes
---

---
ID: SEC-007
Severity: High
Area: Agent / Prompt Injection
File: lib/agent/orchestrator.ts (line 1296)
Status: OPEN
Description: Investor message text is passed directly into the Qwen conversation with no sanitization or policy boundary beyond the prompt. A malicious user can attempt prompt injection against the agent workflow.
Fix planned: Yes
---

---
ID: SEC-008
Severity: High
Area: Agent / Prompt Injection
File: lib/agent/orchestrator.ts (line 1363), lib/agent/orchestrator.ts (line 1457)
Status: OPEN
Description: The server executes model returned tool calls, including update_lead_stage, without a strict server side transition policy. A successful prompt injection could drive unauthorized stage changes.
Fix planned: Yes
---

---
ID: SEC-009
Severity: High
Area: Data Retention
File: lib/db/leads.ts (line 90), app/api/admin/kyc/[leadId]/route.ts (line 363), app/api/kyc/[leadId]/documents/route.ts (line 120)
Status: OPEN
Description: KYC files are not reliably deleted from R2 when a lead is deleted, when KYC is rejected, or when document removal fails. Sensitive files can remain in object storage after the database record is gone.
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
Status: OPEN
Description: Admin login has no rate limiting, lockout, or login attempt controls. Repeated credential guessing is not throttled.
Fix planned: Yes
---

---
ID: SEC-012
Severity: Medium
Area: Input Validation
File: app/api/kyc/[leadId]/upload/route.ts (line 192)
Status: OPEN
Description: KYC upload validation relies on file extension and MIME type only. There is no magic byte or file signature inspection to confirm the uploaded content is actually an allowed document type.
Fix planned: Yes
---

---
ID: SEC-013
Severity: Medium
Area: Authorization
File: app/api/agreement/[leadId]/otp/route.ts (line 49)
Status: OPEN
Description: Agreement OTP issuance persists slot count before any session verification. A caller who knows a leadId can tamper with the stored commitment selection and disrupt the signing flow.
Fix planned: Yes
---

---
ID: SEC-014
Severity: Medium
Area: JWT Hardening
File: lib/investor-auth.ts (line 15)
Status: OPEN
Description: Investor JWT signing falls back to the admin JWT secret when INVESTOR_JWT_SECRET is not set. This collapses the admin and investor trust domains onto one shared secret.
Fix planned: Yes
---

---
ID: SEC-015
Severity: Medium
Area: Secrets & Environment
File: lib/admin-auth.ts (line 14), lib/investor-auth.ts (line 15)
Status: OPEN
Description: JWT secrets are not validated at startup. Missing values only fail at first use, which increases the risk of misconfigured deployments reaching runtime.
Fix planned: Yes
---

---
ID: SEC-016
Severity: Medium
Area: Secrets & Environment
File: lib/agent/orchestrator.ts (line 83), lib/kyc/submission.ts (line 27)
Status: OPEN
Description: Sensitive operational email notifications fall back to a hardcoded personal address if the admin alert env var is missing. That creates a risk of misrouted investor or compliance communications.
Fix planned: Yes
---

---
ID: SEC-017
Severity: Medium
Area: Data Exposure
File: app/api/kyc/[leadId]/upload/route.ts (line 93), app/api/kyc/[leadId]/upload/route.ts (line 256)
Status: OPEN
Description: Upload error responses expose internal failure details to investors, including missing R2 environment keys and raw error messages. This leaks operational configuration information.
Fix planned: Yes
---

---
ID: SEC-018
Severity: Medium
Area: Email & External API
File: app/api/chat/access/route.ts (line 35), app/api/agreement/[leadId]/otp/route.ts (line 13)
Status: OPEN
Description: Public OTP endpoints can trigger repeated emails to known leads with no throttling. This creates an email abuse and nuisance risk.
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
Status: OPEN
Description: Admin authentication compares supplied credentials directly against configured values with no throttling. This is a weaker form of the broader login hardening issue.
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
Status: OPEN
Description: JWT secret strength is not validated at startup. Short or weak secrets would still be accepted if provided in the environment.
Fix planned: Yes
---

---
ID: SEC-025
Severity: Low
Area: Secrets & Environment
File: lib/grey/rates.ts (line 79)
Status: OPEN
Description: Grey rates integration fails open by returning null when the API key is missing. The application degrades gracefully, but the missing secret can go unnoticed until runtime.
Fix planned: Yes
---

---
ID: SEC-026
Severity: Low
Area: Logging
File: app/api/kyc/[leadId]/upload/route.ts (line 86), app/api/kyc/[leadId]/upload/route.ts (line 252), lib/storage/r2.ts (line 70)
Status: OPEN
Description: Server logs in the KYC upload path include lead IDs, filenames, and full error stacks. These logs increase exposure of sensitive identifiers and operational details.
Fix planned: Yes
---
