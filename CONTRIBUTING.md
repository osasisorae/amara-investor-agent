# Contributing

## Welcome

This project is an AI powered investor onboarding agent for FutureX. It handles investor qualification, KYC, agreement signing, payment confirmation, and related financial compliance workflows. Contributors should assume a high security bar, careful data handling requirements, and low tolerance for shortcuts around authentication, authorization, or sensitive data exposure.

## How to Contribute

1. Fork the repository.
2. Create a feature branch from `main`.
3. Make your changes and keep the scope focused.
4. Open a pull request against `main`.

Every pull request must include:

1. A clear description of the change.
2. The files affected.
3. Exact steps used to test the change.

Security related pull requests must reference the relevant `SEC-XXX` ID from [SECURITY.md](/Users/Macintosh/Downloads/qwen-hack/SECURITY.md).

## Security Contributions

This section is mandatory for any security relevant work.

1. If you are fixing a known vulnerability from [SECURITY.md](/Users/Macintosh/Downloads/qwen-hack/SECURITY.md), include the `SEC-XXX` ID in the pull request title.
2. If you are reporting a new vulnerability, do not open a public issue. Follow the disclosure policy in [SECURITY.md](/Users/Macintosh/Downloads/qwen-hack/SECURITY.md).
3. Security fixes receive priority review.

## Code Standards

1. TypeScript strict mode is required. Do not use `any` unless the reason is justified in a code comment.
2. All sensitive API routes must use `verifyAdminSession` or `verifyInvestorSession`. Do not introduce unprotected sensitive routes.
3. Environment variables must be validated at startup, not at first use.
4. Do not hardcode secrets, email addresses, or credentials.

## Running Locally

1. Copy `.env.example` to `.env.local` and fill in all required values.
2. Run `npm install`.
3. Run `npm run db:migrate`.
4. Run `npm run dev`.

Some features require live Qwen API, Resend, and Cloudflare R2 credentials.

## PR Review SLA

The maintainer will review standard pull requests within 7 days. Security related pull requests will be reviewed within 48 hours.
