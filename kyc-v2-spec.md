# FutureX KYC v2 Implementation Spec

Date: June 27, 2026

This document turns `kyc-research.md` into a concrete implementation plan for the current codebase.

This is a product and engineering spec, not legal advice.

## 1. Goal

Upgrade the current KYC flow from a basic identity upload flow into a risk based diaspora onboarding system that can:

- verify identity and residence
- capture tax and investor profile data
- prove the specific source of funds for the actual investment
- escalate higher risk cases into enhanced due diligence
- verify the payment path before money is sent
- support human compliance review with a real checklist

The design target is not to behave like a retail banking app. The target is to behave like a credible private investment onboarding workflow.

## 2. Current state summary

The current KYC flow is implemented as:

- prompt orchestration in `lib/agent/prompts.ts:77-99`
- personal details form in `components/deal-room/kyc/KYCPersonalDetailsCard.tsx:28-58`
- document selection and upload in `lib/kyc/config.ts:1-10`, `lib/kyc/config.ts:101-133`
- submission validation in `lib/kyc/submission.ts:46-87`
- admin approval or rejection in `app/api/admin/kyc/[leadId]/route.ts:146-272`

The current flow collects only:

- full legal name
- date of birth
- nationality
- country of residence
- phone number
- one ID type
- proof of address
- one generic source of funds document

That is too shallow for diaspora investing.

## 3. Design principles

KYC v2 should follow these rules:

1. Ask only what is needed at the current step.
2. Branch by funding source instead of asking everyone for the same files.
3. Treat all remote diaspora onboarding as enhanced due diligence baseline.
4. Enforce same name funding account rules by default.
5. Separate source of funds from source of wealth.
6. Never let the AI approve KYC.
7. Keep the investor experience inside chat, but make the compliance logic explicit and structured.
8. Prefer minimal schema disruption where possible.

## 4. Recommended architecture

Use a minimal change path for v2.

### 4.1 Reuse existing tables

Keep using:

- `qualification_answers`
- `kyc_documents`
- `audit_events`
- `leads`
- `messages`

### 4.2 Add a small number of new tables

Add two new tables:

#### `kyc_reviews`

Purpose:

- store human compliance review outcome
- store risk level and reviewer notes
- make approval decisions auditable beyond generic `audit_events`

Suggested columns:

- `id TEXT PRIMARY KEY`
- `lead_id TEXT NOT NULL`
- `status TEXT NOT NULL`
  values: `pending`, `approved`, `rejected`, `needs_more_info`
- `risk_level TEXT NOT NULL`
  values: `standard`, `enhanced`, `high`
- `reviewer_email TEXT`
- `decision_notes TEXT`
- `rejection_reason TEXT`
- `approved_at INTEGER`
- `rejected_at INTEGER`
- `created_at INTEGER NOT NULL DEFAULT (unixepoch())`
- `updated_at INTEGER NOT NULL DEFAULT (unixepoch())`

#### `kyc_screenings`

Purpose:

- store PEP, sanctions, and adverse media screening results
- support a real admin checklist

Suggested columns:

- `id TEXT PRIMARY KEY`
- `lead_id TEXT NOT NULL`
- `screen_type TEXT NOT NULL`
  values: `pep`, `sanctions`, `adverse_media`
- `result TEXT NOT NULL`
  values: `clear`, `match`, `needs_review`
- `provider TEXT`
- `notes TEXT`
- `created_at INTEGER NOT NULL DEFAULT (unixepoch())`

### 4.3 Do not add a new answer table yet

For speed, continue storing structured KYC answers in `qualification_answers`.

This avoids a large migration and lets the current admin summary logic continue working with moderate expansion.

## 5. New KYC answer keys

Add these keys to the KYC flow and persist them into `qualification_answers`.

### 5.1 Identity and residence

- `full_legal_name`
- `date_of_birth`
- `nationality`
- `country_of_residence`
- `phone_number`
- `email_confirmed`

### 5.2 Investor profile

- `occupation`
- `employer_or_business_name`
- `employer_or_business_address`
- `tax_residency_country`
- `tax_identification_number`
- `investing_as`
  values: `individual`, `company`, `trust`, `family_office`

### 5.3 Payment path

- `expected_funding_method`
  values: `ngn_bank`, `usd_bank`, `crypto`
- `expected_funding_bank_country`
- `expected_funding_account_name`
- `payment_from_own_account`
  values: `yes`, `no`

### 5.4 Risk declarations

- `is_pep`
  values: `yes`, `no`
- `is_pep_associate`
  values: `yes`, `no`
- `uses_third_party_funds`
  values: `yes`, `no`
- `uses_gift_funds`
  values: `yes`, `no`
- `uses_loan_funds`
  values: `yes`, `no`
- `uses_crypto_funds`
  values: `yes`, `no`

### 5.5 Funds and wealth

- `source_of_funds_type`
  values: `salary`, `business_income`, `investment_proceeds`, `property_sale`, `savings`, `inheritance`, `gift`, `loan`, `crypto_sale`, `mixed`
- `source_of_funds_summary`
- `source_of_wealth_summary`

### 5.6 Entity investor only

- `entity_name`
- `entity_jurisdiction`
- `entity_registration_number`
- `entity_control_person_name`
- `entity_beneficial_owner_summary`

## 6. New KYC document taxonomy

The current `kyc_documents.doc_type` values are too narrow. Expand them.

### 6.1 Identity

- `passport_front`
- `national_id_front`
- `national_id_back`
- `drivers_licence_front`
- `drivers_licence_back`
- `proof_of_address`

### 6.2 Salary funded investors

- `salary_payslip`
- `salary_bank_statement`
- `employment_letter`

### 6.3 Business funded investors

- `business_bank_statement`
- `business_financial_statement`
- `business_registration_document`

### 6.4 Investment proceeds

- `broker_statement`
- `investment_sale_confirmation`

### 6.5 Property sale

- `property_sale_agreement`
- `property_completion_statement`
- `property_sale_bank_statement`

### 6.6 Inheritance

- `inheritance_letter`
- `probate_document`
- `inheritance_bank_statement`

### 6.7 Gift

- `gift_letter`
- `gift_donor_id`
- `gift_transfer_proof`

### 6.8 Loan

- `loan_agreement`
- `loan_disbursement_proof`
- `lender_source_of_funds`

### 6.9 Crypto

- `crypto_exchange_statement`
- `crypto_wallet_proof`
- `crypto_offramp_bank_statement`

### 6.10 Payment account verification

- `funding_account_statement`

### 6.11 Entity investor documents

- `entity_certificate_of_incorporation`
- `entity_shareholding_register`
- `entity_board_resolution`
- `entity_authorized_signatory_id`
- `entity_bank_statement`

## 7. New chat component flow

The current KYC components in `lib/chat/components.ts` are a good foundation. Extend them instead of replacing them.

### 7.1 Keep existing components

Keep:

- `kyc_consent`
- `kyc_personal_details`
- `kyc_document_selector`
- `kyc_upload`
- `kyc_submitted`

### 7.2 Add new component types

Add these to `lib/chat/components.ts`:

- `kyc_investor_profile`
- `kyc_funding_source_selector`
- `kyc_funding_explainer`
- `kyc_additional_uploads`
- `kyc_risk_declarations`
- `kyc_payment_account`
- `kyc_review_summary`

### 7.3 Purpose of each new component

#### `kyc_investor_profile`

Collect:

- occupation
- employer or business name
- employer or business address
- tax residency
- tax identification number
- investing as

#### `kyc_funding_source_selector`

Let investor select the primary source of funds:

- salary
- business income
- investment proceeds
- property sale
- savings
- inheritance
- gift
- loan
- crypto sale
- mixed

#### `kyc_funding_explainer`

Short text area:

- explain how this exact FutureX investment will be funded
- explain how the money will move into the FutureX account

#### `kyc_additional_uploads`

Dynamic upload panel.

This replaces the idea that one generic `source_of_funds` upload is enough.

The required slots depend on `source_of_funds_type`.

#### `kyc_risk_declarations`

Collect yes or no declarations for:

- PEP
- PEP associate
- third party funding
- gift
- loan
- crypto

#### `kyc_payment_account`

Collect:

- expected funding method
- expected funding bank country
- expected funding account name
- confirmation that first payment comes from an account in the investor's name

#### `kyc_review_summary`

Terminal pre review card showing:

- investor identity complete
- profile complete
- source of funds complete
- payment path recorded
- ready for human compliance review

## 8. Investor side flow

This is the target chat flow.

### Step 1. Consent

Current component: `kyc_consent`

No change to the general structure, but update the copy to mention:

- source of funds review
- PEP and sanctions screening
- account ownership verification

### Step 2. Identity and residence

Current component: `kyc_personal_details`

Expand with:

- email confirmation
- tax residency
- tax identification number

### Step 3. Investor profile

New component: `kyc_investor_profile`

This is where occupation and employer data should live.

### Step 4. Government ID selection

Current component: `kyc_document_selector`

No major structural change.

### Step 5. Core identity upload

Current component: `kyc_upload`

Use it for:

- identity document
- proof of address

Do not use it as the final source of funds collector anymore.

### Step 6. Funding source selection

New component: `kyc_funding_source_selector`

Investor chooses how this investment is funded.

### Step 7. Funds explanation

New component: `kyc_funding_explainer`

Investor explains the funding path in plain language.

### Step 8. Funding evidence upload

New component: `kyc_additional_uploads`

Required upload slots branch by source.

### Step 9. Risk declarations

New component: `kyc_risk_declarations`

If investor answers yes to PEP, gift, loan, crypto, or third party funding, the case is automatically marked enhanced due diligence.

### Step 10. Payment account verification

New component: `kyc_payment_account`

Investor declares the exact account and method that will fund the investment.

### Step 11. Human review summary

New component: `kyc_review_summary`

After validation, the orchestrator:

- logs `kyc_submitted`
- updates lead to `pending_human_review`
- emits `pipeline_status`
- emits `kyc_submitted`

## 9. Dynamic upload requirements by funding source

This logic belongs in a new helper file, for example `lib/kyc/requirements.ts`.

### 9.1 Salary

Require:

- `salary_payslip`
- `salary_bank_statement`
- `employment_letter`

Allow `employment_letter` to be optional if the payslips and bank statements are strong.

### 9.2 Business income

Require:

- `business_bank_statement`
- `business_financial_statement`

Optional but strongly preferred:

- `business_registration_document`

### 9.3 Investment proceeds

Require:

- `broker_statement`
- `investment_sale_confirmation`

### 9.4 Property sale

Require:

- `property_sale_agreement`
- `property_completion_statement`
- `property_sale_bank_statement`

### 9.5 Savings

Require:

- `salary_bank_statement` or other relevant personal bank statements

Minimum recommendation:

- last 6 to 12 months statements

### 9.6 Inheritance

Require:

- `inheritance_letter` or `probate_document`
- `inheritance_bank_statement`

### 9.7 Gift

Require:

- `gift_letter`
- `gift_donor_id`
- `gift_transfer_proof`

This case should always route to enhanced due diligence.

### 9.8 Loan

Require:

- `loan_agreement`
- `loan_disbursement_proof`

This case should always route to enhanced due diligence.

### 9.9 Crypto sale

Require:

- `crypto_exchange_statement`
- `crypto_wallet_proof`
- `crypto_offramp_bank_statement`

This case should always route to enhanced due diligence.

### 9.10 Mixed

Require:

- a funding breakdown in text
- at least one evidence set per declared source

## 10. Orchestrator changes

Update `lib/agent/prompts.ts` and `lib/agent/orchestrator.ts`.

### 10.1 New KYC stage prompt

Replace the current five step KYC prompt with a fuller sequence:

1. Consent
2. Identity and residence
3. Investor profile
4. Government ID selection
5. Identity upload
6. Funding source selection
7. Funding explanation
8. Funding evidence upload
9. Risk declarations
10. Payment account verification
11. Submit for human review

### 10.2 New tool behavior

The KYC stage should continue using:

- `emit_ui_component`
- `update_lead_stage`
- `log_audit_event`
- `flag_for_human_review`
- `send_email`

But the orchestration rules need to become more explicit:

- never move to `pending_human_review` unless all required branch specific uploads are present
- automatically flag for human review if any high risk answer is given
- write `kyc_requires_enhanced_review` audit event when needed

### 10.3 New helper functions

Add helpers in `lib/kyc/requirements.ts`:

- `getRequiredKycAnswerKeys()`
- `getRequiredKycDocumentTypes(sourceOfFundsType, investingAs)`
- `requiresEnhancedDueDiligence(answerMap)`
- `getKycRiskLevel(answerMap)`

## 11. API changes

### 11.1 Expand personal details route

File:

- `app/api/kyc/[leadId]/personal-details/route.ts`

Change:

- either keep this route focused on identity only
- or rename behavior conceptually to the first KYC step only

Recommended:

- keep it focused on identity and residence only

### 11.2 Add investor profile route

New route:

- `POST /api/kyc/[leadId]/investor-profile`

Stores:

- occupation
- employer or business name
- employer or business address
- tax residency
- tax identification number
- investing as

### 11.3 Add funding source route

New route:

- `POST /api/kyc/[leadId]/funding-source`

Stores:

- source_of_funds_type
- source_of_funds_summary
- source_of_wealth_summary

### 11.4 Add risk declarations route

New route:

- `POST /api/kyc/[leadId]/risk-declarations`

Stores:

- is_pep
- is_pep_associate
- uses_third_party_funds
- uses_gift_funds
- uses_loan_funds
- uses_crypto_funds

### 11.5 Add payment account route

New route:

- `POST /api/kyc/[leadId]/payment-account`

Stores:

- expected_funding_method
- expected_funding_bank_country
- expected_funding_account_name
- payment_from_own_account

### 11.6 Expand upload route

File:

- `app/api/kyc/[leadId]/upload/route.ts`

Change:

- support the expanded `doc_type` taxonomy
- validate uploads against the current branch specific requirements
- continue to enforce consent and `kyc_intake`

### 11.7 Expand documents route

File:

- `app/api/kyc/[leadId]/documents/route.ts`

Change:

- return all uploaded doc types
- group them by category for the client

## 12. Submission validation changes

File:

- `lib/kyc/submission.ts`

Current validation only checks:

- five personal details
- ID choice
- core doc slots

That is not enough.

### 12.1 Replace validation logic with branch aware validation

`validateKycSubmission()` should validate:

- consent present
- identity fields complete
- investor profile fields complete
- funding source type present
- funding explanation present
- risk declarations complete
- payment account details complete
- required branch specific document types present
- entity fields present if investing as entity

### 12.2 Add risk rating output

Return:

- `riskLevel`
- `requiresEnhancedReview`
- `missingAnswers`
- `missingDocuments`

### 12.3 Submission should not auto approve clean cases

Even low risk cases still move to `pending_human_review`.

The difference is only:

- standard review queue
- enhanced review queue

## 13. Admin dashboard changes

The admin KYC review panel already exists. Expand it instead of replacing it.

Relevant files:

- `app/admin/admin-dashboard-client.tsx`
- `components/admin/KycReviewPanel`
- `app/api/admin/kyc/[leadId]/route.ts`

### 13.1 Investor summary section

Add display fields for:

- occupation
- employer or business name
- employer or business address
- tax residency
- tax identification number
- investing as
- source of funds type
- source of funds summary
- source of wealth summary
- expected funding method
- expected funding bank country
- expected funding account name
- payment from own account
- PEP status
- third party funding status
- gift status
- loan status
- crypto status

### 13.2 Documents section

Group documents by category:

- identity
- proof of address
- funds evidence
- payment account evidence
- entity evidence

### 13.3 Review decision section

Add explicit compliance actions:

- mark risk level
- record screening status
- approve
- reject
- request more information

### 13.4 New rejection mode

Keep existing `rejected` path, but add a softer path:

- `needs_more_info`

This should return the lead to `kyc_intake` with a precise note about what is missing.

### 13.5 Approval blocking rules

Do not allow approval unless:

- all required answer keys exist
- all required docs for the branch exist
- payment account verification exists
- screening results are present

## 14. Screening workflow

For now, FutureX can begin with manual screening recorded in product.

### 14.1 Manual screening fields

Admin should be able to record:

- PEP clear or match
- sanctions clear or match
- adverse media clear or needs review

Store each in `kyc_screenings`.

### 14.2 Later automation

This can later connect to a screening provider, but the data model should exist now.

## 15. Enhanced due diligence rules

KYC v2 should automatically classify the case as `enhanced` if any of these are true:

- `is_pep = yes`
- `is_pep_associate = yes`
- `uses_third_party_funds = yes`
- `uses_gift_funds = yes`
- `uses_loan_funds = yes`
- `uses_crypto_funds = yes`
- `investing_as != individual`
- `payment_from_own_account = no`
- `source_of_funds_type = mixed`
- admin manually flags inconsistency

In enhanced mode:

- source of wealth summary becomes required
- more supporting documents may be requested
- admin must record notes before approval

## 16. Stage behavior

Do not introduce new lead stages unless there is a strong reason.

The current stage model is usable:

- `kyc_intake`
- `pending_human_review`
- `agreement_pending`

Use `kyc_reviews.status` for finer detail instead of overloading `leads.stage`.

### Suggested status map

- lead in `kyc_intake`
  - KYC is still being completed
- lead in `pending_human_review`
  - KYC package submitted and waiting
- `kyc_reviews.status = pending`
  - awaiting review
- `kyc_reviews.status = needs_more_info`
  - investor must resubmit missing items
- `kyc_reviews.status = approved`
  - move lead to `agreement_pending`
- `kyc_reviews.status = rejected`
  - only for genuinely failed or unacceptable cases

## 17. File by file implementation plan

### 17.1 Core config

- `lib/kyc/config.ts`
  - expand answer keys
  - expand doc types
  - add helper maps for labels

- `lib/kyc/requirements.ts`
  - new file
  - source specific requirements
  - EDD trigger logic

- `lib/kyc/submission.ts`
  - branch aware validation
  - risk level output

### 17.2 Chat component types

- `lib/chat/components.ts`
  - register new KYC component types
  - add builders and metadata types

### 17.3 Investor UI

- `components/deal-room/kyc/KYCPersonalDetailsCard.tsx`
  - expand identity fields or keep limited depending on split

- new:
  - `components/deal-room/kyc/KYCInvestorProfileCard.tsx`
  - `components/deal-room/kyc/KYCFundingSourceSelectorCard.tsx`
  - `components/deal-room/kyc/KYCFundingExplainerCard.tsx`
  - `components/deal-room/kyc/KYCAdditionalUploadsCard.tsx`
  - `components/deal-room/kyc/KYCRiskDeclarationsCard.tsx`
  - `components/deal-room/kyc/KYCPaymentAccountCard.tsx`
  - `components/deal-room/kyc/KYCReviewSummaryCard.tsx`

- `app/chat/[leadId]/page.tsx`
  - render all new component types

### 17.4 API routes

- `app/api/kyc/[leadId]/personal-details/route.ts`
  - identity and residence only

- new:
  - `app/api/kyc/[leadId]/investor-profile/route.ts`
  - `app/api/kyc/[leadId]/funding-source/route.ts`
  - `app/api/kyc/[leadId]/risk-declarations/route.ts`
  - `app/api/kyc/[leadId]/payment-account/route.ts`

- `app/api/kyc/[leadId]/upload/route.ts`
  - expanded doc taxonomy

### 17.5 Orchestrator

- `lib/agent/prompts.ts`
  - replace current KYC sequence

- `lib/agent/orchestrator.ts`
  - new component emission order
  - enhanced review flags

### 17.6 Admin

- `app/api/admin/kyc/[leadId]/route.ts`
  - add screening and review data
  - block approval until complete

- `app/admin/admin-dashboard-client.tsx`
  - show richer KYC detail

- `components/admin/KycReviewPanel.tsx`
  - expand summary and screening controls

### 17.7 Database

- new migration:
  - add `kyc_reviews`
  - add `kyc_screenings`

## 18. Implementation phases

### Phase 1. High impact minimum viable compliance

Build first:

1. investor profile step
2. funding source selector
3. dynamic funding uploads
4. risk declarations
5. payment account verification
6. branch aware submission validation
7. richer admin summary

This is the smallest meaningful upgrade.

### Phase 2. Review and screening maturity

Build next:

1. `kyc_reviews` table
2. `kyc_screenings` table
3. `needs_more_info` admin flow
4. explicit risk levels

### Phase 3. Entity investors

Build later:

1. company or trust investor branch
2. beneficial owner collection
3. authorized signatory handling

## 19. Acceptance criteria

KYC v2 should be considered complete only if:

1. The investor cannot submit KYC with only identity docs and one generic funds file.
2. The investor must declare the exact source of the investment money.
3. The required upload slots change based on the funding source selected.
4. PEP, gift, loan, crypto, third party funding, and entity investing all trigger enhanced review.
5. The investor must declare the account and method that will actually fund the investment.
6. The admin reviewer sees a structured summary of identity, tax, profile, funding, and payment path.
7. The admin cannot approve an incomplete case.
8. All final decisions remain human.

## 20. Recommended next build order

If we start implementation now, this is the order I would use:

1. expand `lib/kyc/config.ts`
2. add `lib/kyc/requirements.ts`
3. add new KYC answer saving routes
4. build new KYC component cards
5. wire them into `app/chat/[leadId]/page.tsx`
6. update KYC prompt and orchestrator flow
7. replace `validateKycSubmission()` with branch aware validation
8. expand admin KYC review panel
9. add `kyc_reviews` and `kyc_screenings` migration

That path gives the strongest compliance lift without tearing up the existing app architecture.
