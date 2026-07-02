# Agent Efficiency Plan

Date: 2026-07-02

## Objective

Implement a practical, measurable definition of agent efficiency for Amara using the current lead, message, and audit model, then close the remaining telemetry gaps needed for a full cost-aware score.

## Metric Contract

Use `engaged leads` as the main cohort denominator.

An engaged lead is a lead with either:

- a `qualification_started` audit event, or
- at least one investor message

Measure investor progress through this milestone ladder:

1. `qualification_passed`
2. `kyc_submitted`
3. `kyc_approved`
4. `agreement_signed`
5. `payment_received`

Use these components for the overall weighted score:

- `Progression`
- `QualificationPass`
- `SLAAdherence`
- `KycTurnaround`
- `ExceptionalEscalation`
- `KycRework`
- `Cost`

## Recommended Score

```text
Amara Efficiency Score =
  0.30 * Progression +
  0.15 * QualificationPass +
  0.15 * SLAAdherence +
  0.10 * KycTurnaround +
  0.10 * ExceptionalEscalation +
  0.10 * KycRework +
  0.10 * Cost
```

Each component should be normalized to a `0-100` score against target thresholds.

## Component Metrics

### Progression Score

```text
avg(highest_milestone_reached / 5) * 100
```

Milestones:

- `1 = qualification_passed`
- `2 = kyc_submitted`
- `3 = kyc_approved`
- `4 = agreement_signed`
- `5 = payment_received`

Target bands:

- Good: `> 55`
- Watch: `35 - 55`
- Bad: `< 35`

## Qualification Pass Rate

```text
qualified_leads / engaged_leads
```

Target bands:

- Good: `> 60%`
- Watch: `40% - 60%`
- Bad: `< 40%`

## SLA Adherence

```text
active_leads_within_stage_sla / active_leads
```

Recommended stage SLAs:

- `qualifying < 24h`
- `deal_room < 7d`
- `kyc_intake < 3d`
- `pending_human_review < 24h`
- `agreement_pending < 3d`
- `payment_pending < 7d`

Target bands:

- Good: `> 85%`
- Watch: `70% - 85%`
- Bad: `< 70%`

## KYC Turnaround

```text
median(kyc_approved_ts - kyc_submitted_ts)
```

Target bands:

- Good: `< 24h`
- Watch: `24h - 72h`
- Bad: `> 72h`

## Exceptional Escalation Rate

```text
distinct_leads_with_human_review_requested_before_kyc_submitted / engaged_leads
```

This excludes the mandatory human compliance checkpoint and focuses on where Amara could not progress the flow cleanly on its own.

Target bands:

- Good: `< 10%`
- Watch: `10% - 20%`
- Bad: `> 20%`

## KYC Rework Rate

```text
kyc_rejected / kyc_submitted
```

Target bands:

- Good: `< 15%`
- Watch: `15% - 30%`
- Bad: `> 30%`

## Cost Per Milestone Point

```text
(llm_cost + email_cost + storage_cost + admin_minutes * blended_rate) / total_milestone_points
```

Target bands:

- Good: `< 30%` of the manual-process baseline
- Watch: `30% - 60%`
- Bad: `> 60%`

## Leading And Lagging Indicators

Leading indicators:

- `QualificationPass`
- `SLAAdherence`
- `ExceptionalEscalation`
- `KycRework`
- `Cost`

Lagging indicators:

- `Progression`
- `payment_received / engaged_leads`
- `median(first_investor_message_ts -> payment_received_ts)`

## What The Current Repo Can Measure Now

The current schema and services already support a useful v1:

- lead stage and lifecycle timestamps
- full message history
- qualification outcomes
- audit milestones for qualification, KYC, agreement, and payment
- stage-age inference already used in admin review summaries

That means v1 can calculate:

- progression score
- qualification pass rate
- stage SLA and stall rate
- KYC turnaround
- KYC rework rate
- payment conversion

## Telemetry Gaps

The current codebase still needs explicit telemetry for a full efficiency score:

- persist Qwen token usage
- persist model request latency
- log successful OTP verification
- log `human_review_resolved`
- optionally capture admin handling duration per review action

Important caveats:

- Qwen returns token usage today, but the current client does not persist it.
- `human_review_resolved` exists as an audit event type but is not emitted in the active codepath.
- `deal_room_accessed` currently behaves more like a transition into KYC than a literal first deal-room view event, so it should not be treated as a precise view metric without adjustment.

## Implementation Plan

1. Lock the metric contract in code and docs.
2. Ship a v1 metrics service using existing `leads`, `messages`, and `audit_events`.
3. Add missing telemetry for token usage, latency, successful OTP verification, and explicit review resolution.
4. Add a dedicated analytics layer, likely `lib/analytics/agent-efficiency.ts`.
5. Expose the score and component metrics through an admin-only endpoint and dashboard panel.
6. Add calculation tests, an admin metrics smoke check, and short operator documentation.

## Rollout Order

### Phase 1

Use existing data only:

- metrics service
- admin endpoint
- initial dashboard view

### Phase 2

Add missing telemetry:

- model usage
- model latency
- explicit review resolution
- richer auth/access events

### Phase 3

Operationalize:

- trend views
- alerts for stalled stages
- threshold-based health reporting

