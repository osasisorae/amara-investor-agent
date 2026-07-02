import type { Lead, LeadStage } from '@/lib/db/leads';
import { getAllLeads } from '@/lib/db/leads';
import { query } from '@/lib/db/client';

type RelevantAuditEventType =
  | 'qualification_started'
  | 'qualification_passed'
  | 'qualification_failed'
  | 'deal_room_accessed'
  | 'human_review_requested'
  | 'kyc_submitted'
  | 'kyc_approved'
  | 'kyc_rejected'
  | 'agreement_signed'
  | 'payment_instructions_sent'
  | 'payment_received';

export type AgentEfficiencyMetricKey =
  | 'progression'
  | 'qualification_pass'
  | 'sla_adherence'
  | 'kyc_turnaround'
  | 'exceptional_escalation'
  | 'kyc_rework'
  | 'cost';

export type AgentEfficiencyMetricStatus =
  | 'good'
  | 'watch'
  | 'bad'
  | 'unavailable';

export interface AgentEfficiencyMetric {
  key: AgentEfficiencyMetricKey;
  label: string;
  description: string;
  kind: 'percentage' | 'duration' | 'unavailable';
  weight: number;
  status: AgentEfficiencyMetricStatus;
  score: number | null;
  value: number | null;
  formattedValue: string;
  numerator?: number;
  denominator?: number;
  sampleSize?: number;
  note?: string;
  benchmarks: {
    good: string;
    watch: string;
    bad: string;
  };
}

export interface AgentEfficiencySlaStage {
  stage: LeadStage;
  label: string;
  totalLeads: number;
  withinSla: number;
  breached: number;
  breachRate: number | null;
  slaHours: number;
}

export interface AgentEfficiencySnapshot {
  generatedAt: number;
  cohort: {
    windowDays: number;
    startAt: number;
    endAt: number;
    totalLeadCount: number;
    engagedLeadCount: number;
    activeLeadCount: number;
    qualifiedLeadCount: number;
    kycSubmittedLeadCount: number;
    kycApprovedLeadCount: number;
    agreementSignedLeadCount: number;
    fundedLeadCount: number;
  };
  score: {
    value: number | null;
    label: string;
    availableWeight: number;
    maximumWeight: number;
    missingComponents: AgentEfficiencyMetricKey[];
    note?: string;
  };
  components: AgentEfficiencyMetric[];
  slaBreakdown: AgentEfficiencySlaStage[];
  notes: string[];
}

interface AuditEventRow {
  lead_id: string;
  event_type: RelevantAuditEventType;
  created_at: number | string;
}

interface InvestorMessageAggregateRow {
  lead_id: string;
  first_investor_message_at: number | string | null;
  investor_message_count: number | string;
}

interface EventTimeSummary {
  first: number;
  last: number;
  count: number;
}

type LeadEventSummary = Partial<Record<RelevantAuditEventType, EventTimeSummary>>;

const COMPONENT_WEIGHTS: Record<AgentEfficiencyMetricKey, number> = {
  progression: 0.3,
  qualification_pass: 0.15,
  sla_adherence: 0.15,
  kyc_turnaround: 0.1,
  exceptional_escalation: 0.1,
  kyc_rework: 0.1,
  cost: 0.1,
};

const SLA_STAGE_ORDER: LeadStage[] = [
  'qualifying',
  'deal_room',
  'kyc_intake',
  'pending_human_review',
  'agreement_pending',
  'agreement_signed',
  'payment_pending',
];

const SLA_TARGETS: Partial<Record<LeadStage, { label: string; seconds: number }>> =
  {
    qualifying: {
      label: 'Qualifying',
      seconds: 24 * 60 * 60,
    },
    deal_room: {
      label: 'Deal room review',
      seconds: 7 * 24 * 60 * 60,
    },
    kyc_intake: {
      label: 'KYC intake',
      seconds: 3 * 24 * 60 * 60,
    },
    pending_human_review: {
      label: 'Pending human review',
      seconds: 24 * 60 * 60,
    },
    agreement_pending: {
      label: 'Agreement pending',
      seconds: 3 * 24 * 60 * 60,
    },
    // This stage exists in the runtime but is not called out explicitly in the
    // plan, so we treat it as a short operational handoff into payment follow-up.
    agreement_signed: {
      label: 'Agreement handoff',
      seconds: 24 * 60 * 60,
    },
    payment_pending: {
      label: 'Payment pending',
      seconds: 7 * 24 * 60 * 60,
    },
  };

const QUALIFIED_STAGES = new Set<LeadStage>([
  'deal_room',
  'kyc_intake',
  'pending_human_review',
  'kyc_rejected',
  'agreement_pending',
  'agreement_signed',
  'payment_pending',
  'closed',
]);

const KYC_SUBMITTED_STAGES = new Set<LeadStage>([
  'pending_human_review',
  'kyc_rejected',
  'agreement_pending',
  'agreement_signed',
  'payment_pending',
  'closed',
]);

const KYC_APPROVED_STAGES = new Set<LeadStage>([
  'agreement_pending',
  'agreement_signed',
  'payment_pending',
  'closed',
]);

const AGREEMENT_SIGNED_STAGES = new Set<LeadStage>([
  'agreement_signed',
  'payment_pending',
  'closed',
]);

const FUNDED_STAGES = new Set<LeadStage>(['closed']);

function toNumber(value: number | string | null | undefined): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getMedian(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middleIndex = Math.floor(sorted.length / 2);

  if (sorted.length % 2 !== 0) {
    return sorted[middleIndex] ?? null;
  }

  const left = sorted[middleIndex - 1];
  const right = sorted[middleIndex];

  if (left === undefined || right === undefined) {
    return null;
  }

  return (left + right) / 2;
}

function getMinimumDefined(values: Array<number | null | undefined>): number | null {
  const definedValues = values.filter(
    (value): value is number => typeof value === 'number' && Number.isFinite(value)
  );

  if (definedValues.length === 0) {
    return null;
  }

  return Math.min(...definedValues);
}

function getMetricStatusHigherBetter(
  value: number | null,
  badThreshold: number,
  goodThreshold: number
): AgentEfficiencyMetricStatus {
  if (value === null) {
    return 'unavailable';
  }

  if (value >= goodThreshold) {
    return 'good';
  }

  if (value < badThreshold) {
    return 'bad';
  }

  return 'watch';
}

function getMetricStatusLowerBetter(
  value: number | null,
  goodThreshold: number,
  badThreshold: number
): AgentEfficiencyMetricStatus {
  if (value === null) {
    return 'unavailable';
  }

  if (value <= goodThreshold) {
    return 'good';
  }

  if (value > badThreshold) {
    return 'bad';
  }

  return 'watch';
}

function scoreHigherBetter(
  value: number | null,
  badThreshold: number,
  goodThreshold: number
): number | null {
  if (value === null) {
    return null;
  }

  if (goodThreshold <= badThreshold) {
    return null;
  }

  return clamp(
    ((value - badThreshold) / (goodThreshold - badThreshold)) * 100,
    0,
    100
  );
}

function scoreLowerBetter(
  value: number | null,
  goodThreshold: number,
  badThreshold: number
): number | null {
  if (value === null) {
    return null;
  }

  if (badThreshold <= goodThreshold) {
    return null;
  }

  return clamp(
    ((badThreshold - value) / (badThreshold - goodThreshold)) * 100,
    0,
    100
  );
}

function formatPercentageValue(value: number | null): string {
  if (value === null) {
    return 'Not enough data yet';
  }

  return `${value.toFixed(1)}%`;
}

function formatHoursValue(value: number | null): string {
  if (value === null) {
    return 'Not enough approvals yet';
  }

  if (value < 24) {
    return `${value.toFixed(1)}h`;
  }

  return `${(value / 24).toFixed(1)}d`;
}

function createPercentageMetric(params: {
  key: Exclude<AgentEfficiencyMetricKey, 'kyc_turnaround' | 'cost'>;
  label: string;
  description: string;
  value: number | null;
  numerator: number;
  denominator: number;
  badThreshold: number;
  goodThreshold: number;
  benchmarks: AgentEfficiencyMetric['benchmarks'];
  note?: string;
}): AgentEfficiencyMetric {
  return {
    key: params.key,
    label: params.label,
    description: params.description,
    kind: 'percentage',
    weight: COMPONENT_WEIGHTS[params.key],
    status: getMetricStatusHigherBetter(
      params.value,
      params.badThreshold,
      params.goodThreshold
    ),
    score: scoreHigherBetter(
      params.value,
      params.badThreshold,
      params.goodThreshold
    ),
    value: params.value,
    formattedValue: formatPercentageValue(params.value),
    numerator: params.numerator,
    denominator: params.denominator,
    note: params.note,
    benchmarks: params.benchmarks,
  };
}

function createLowerBetterPercentageMetric(params: {
  key: Extract<
    AgentEfficiencyMetricKey,
    'exceptional_escalation' | 'kyc_rework'
  >;
  label: string;
  description: string;
  value: number | null;
  numerator: number;
  denominator: number;
  goodThreshold: number;
  badThreshold: number;
  benchmarks: AgentEfficiencyMetric['benchmarks'];
  note?: string;
}): AgentEfficiencyMetric {
  return {
    key: params.key,
    label: params.label,
    description: params.description,
    kind: 'percentage',
    weight: COMPONENT_WEIGHTS[params.key],
    status: getMetricStatusLowerBetter(
      params.value,
      params.goodThreshold,
      params.badThreshold
    ),
    score: scoreLowerBetter(
      params.value,
      params.goodThreshold,
      params.badThreshold
    ),
    value: params.value,
    formattedValue: formatPercentageValue(params.value),
    numerator: params.numerator,
    denominator: params.denominator,
    note: params.note,
    benchmarks: params.benchmarks,
  };
}

function createDurationMetric(params: {
  valueHours: number | null;
  sampleSize: number;
}): AgentEfficiencyMetric {
  return {
    key: 'kyc_turnaround',
    label: 'KYC turnaround',
    description: 'Median time from the latest KYC submission to approval.',
    kind: 'duration',
    weight: COMPONENT_WEIGHTS.kyc_turnaround,
    status: getMetricStatusLowerBetter(params.valueHours, 24, 72),
    score: scoreLowerBetter(params.valueHours, 24, 72),
    value: params.valueHours,
    formattedValue: formatHoursValue(params.valueHours),
    sampleSize: params.sampleSize,
    note:
      params.valueHours === null
        ? 'This appears once the cohort includes approved KYC decisions.'
        : undefined,
    benchmarks: {
      good: '< 24h',
      watch: '24h - 72h',
      bad: '> 72h',
    },
  };
}

function createUnavailableMetric(): AgentEfficiencyMetric {
  return {
    key: 'cost',
    label: 'Cost efficiency',
    description:
      'Cost per milestone point after model usage and operator-time telemetry are instrumented.',
    kind: 'unavailable',
    weight: COMPONENT_WEIGHTS.cost,
    status: 'unavailable',
    score: null,
    value: null,
    formattedValue: 'Telemetry not instrumented',
    note:
      'Phase 1 does not yet persist Qwen token usage, request latency, or admin handling time.',
    benchmarks: {
      good: '< 30% of manual baseline',
      watch: '30% - 60%',
      bad: '> 60%',
    },
  };
}

function getFirstEventTime(
  summary: LeadEventSummary | undefined,
  ...eventTypes: RelevantAuditEventType[]
): number | null {
  return getMinimumDefined(
    eventTypes.map((eventType) => summary?.[eventType]?.first ?? null)
  );
}

function getLastEventTime(
  summary: LeadEventSummary | undefined,
  ...eventTypes: RelevantAuditEventType[]
): number | null {
  const definedValues = eventTypes
    .map((eventType) => summary?.[eventType]?.last ?? null)
    .filter((value): value is number => typeof value === 'number');

  if (definedValues.length === 0) {
    return null;
  }

  return Math.max(...definedValues);
}

function hasQualified(lead: Lead, summary: LeadEventSummary | undefined): boolean {
  return Boolean(
    getFirstEventTime(summary, 'qualification_passed') ||
      lead.qualified_at ||
      QUALIFIED_STAGES.has(lead.stage)
  );
}

function hasSubmittedKyc(
  lead: Lead,
  summary: LeadEventSummary | undefined
): boolean {
  return Boolean(
    getFirstEventTime(summary, 'kyc_submitted') ||
      lead.kyc_submitted_at ||
      KYC_SUBMITTED_STAGES.has(lead.stage)
  );
}

function hasApprovedKyc(
  lead: Lead,
  summary: LeadEventSummary | undefined
): boolean {
  return Boolean(
    getFirstEventTime(summary, 'kyc_approved') ||
      lead.kyc_approved === 1 ||
      KYC_APPROVED_STAGES.has(lead.stage)
  );
}

function hasSignedAgreement(
  lead: Lead,
  summary: LeadEventSummary | undefined
): boolean {
  return Boolean(
    getFirstEventTime(summary, 'agreement_signed') ||
      lead.agreement_signed_at ||
      AGREEMENT_SIGNED_STAGES.has(lead.stage)
  );
}

function hasReceivedPayment(
  lead: Lead,
  summary: LeadEventSummary | undefined
): boolean {
  return Boolean(
    getFirstEventTime(summary, 'payment_received') || FUNDED_STAGES.has(lead.stage)
  );
}

function getHighestMilestone(
  lead: Lead,
  summary: LeadEventSummary | undefined
): number {
  if (hasReceivedPayment(lead, summary)) {
    return 5;
  }

  if (hasSignedAgreement(lead, summary)) {
    return 4;
  }

  if (hasApprovedKyc(lead, summary)) {
    return 3;
  }

  if (hasSubmittedKyc(lead, summary)) {
    return 2;
  }

  if (hasQualified(lead, summary)) {
    return 1;
  }

  return 0;
}

function getLeadEngagementAt(params: {
  lead: Lead;
  eventSummary: LeadEventSummary | undefined;
  firstInvestorMessageAt: number | null;
}): number | null {
  const { lead, eventSummary, firstInvestorMessageAt } = params;

  const primaryEngagementAt = getMinimumDefined([
    getFirstEventTime(eventSummary, 'qualification_started'),
    firstInvestorMessageAt,
  ]);

  if (primaryEngagementAt !== null) {
    return primaryEngagementAt;
  }

  return getMinimumDefined([
    getFirstEventTime(
      eventSummary,
      'qualification_passed',
      'qualification_failed',
      'deal_room_accessed',
      'kyc_submitted',
      'kyc_approved',
      'agreement_signed',
      'payment_received'
    ),
    lead.qualified_at || null,
    lead.kyc_submitted_at || null,
    lead.agreement_signed_at || null,
    QUALIFIED_STAGES.has(lead.stage) ? lead.updated_at : null,
  ]);
}

function getStageEnteredAt(params: {
  lead: Lead;
  eventSummary: LeadEventSummary | undefined;
  firstInvestorMessageAt: number | null;
}): number | null {
  const { lead, eventSummary, firstInvestorMessageAt } = params;

  switch (lead.stage) {
    case 'outreach_sent':
      return lead.added_at || lead.created_at;
    case 'qualifying':
      return (
        getLastEventTime(eventSummary, 'qualification_started') ||
        firstInvestorMessageAt ||
        lead.updated_at ||
        lead.added_at
      );
    case 'deal_room':
      return (
        lead.qualified_at ||
        getLastEventTime(eventSummary, 'qualification_passed') ||
        lead.updated_at
      );
    case 'kyc_intake':
      return (
        getLastEventTime(eventSummary, 'deal_room_accessed') || lead.updated_at
      );
    case 'pending_human_review':
      return (
        getLastEventTime(eventSummary, 'human_review_requested', 'kyc_submitted') ||
        lead.kyc_submitted_at ||
        lead.updated_at
      );
    case 'kyc_rejected':
      return (
        getLastEventTime(eventSummary, 'kyc_rejected') ||
        lead.kyc_reviewed_at ||
        lead.updated_at
      );
    case 'agreement_pending':
      return (
        getLastEventTime(eventSummary, 'kyc_approved') ||
        lead.kyc_reviewed_at ||
        lead.updated_at
      );
    case 'agreement_signed':
      return (
        getLastEventTime(eventSummary, 'agreement_signed') ||
        lead.agreement_signed_at ||
        lead.updated_at
      );
    case 'payment_pending':
      return (
        getLastEventTime(
          eventSummary,
          'payment_instructions_sent',
          'agreement_signed'
        ) ||
        lead.agreement_signed_at ||
        lead.updated_at
      );
    case 'closed':
      return (
        getLastEventTime(eventSummary, 'payment_received') || lead.updated_at
      );
    case 'disqualified':
      return (
        getLastEventTime(eventSummary, 'qualification_failed') || lead.updated_at
      );
  }
}

export async function getAgentEfficiencySnapshot(params?: {
  windowDays?: number;
}): Promise<AgentEfficiencySnapshot> {
  const now = Math.floor(Date.now() / 1000);
  const windowDays = clamp(Math.floor(params?.windowDays ?? 30), 1, 365);
  const windowStartAt = now - windowDays * 24 * 60 * 60;

  const [leads, auditEvents, investorMessageAggregates] = await Promise.all([
    getAllLeads(),
    query<AuditEventRow>(
      `SELECT lead_id, event_type, created_at
       FROM audit_events
       WHERE event_type IN (
         'qualification_started',
         'qualification_passed',
         'qualification_failed',
         'deal_room_accessed',
         'human_review_requested',
         'kyc_submitted',
         'kyc_approved',
         'kyc_rejected',
         'agreement_signed',
         'payment_instructions_sent',
         'payment_received'
       )
       ORDER BY created_at ASC`
    ),
    query<InvestorMessageAggregateRow>(
      `SELECT lead_id,
              MIN(created_at) AS first_investor_message_at,
              COUNT(*) AS investor_message_count
       FROM messages
       WHERE role = 'investor'
       GROUP BY lead_id`
    ),
  ]);

  const eventSummaryByLead = new Map<string, LeadEventSummary>();
  for (const event of auditEvents) {
    const createdAt = toNumber(event.created_at);
    if (createdAt === null) {
      continue;
    }

    let leadSummary = eventSummaryByLead.get(event.lead_id);
    if (!leadSummary) {
      leadSummary = {};
      eventSummaryByLead.set(event.lead_id, leadSummary);
    }

    const currentSummary = leadSummary[event.event_type];

    if (!currentSummary) {
      leadSummary[event.event_type] = {
        first: createdAt,
        last: createdAt,
        count: 1,
      };
      continue;
    }

    currentSummary.last = createdAt;
    currentSummary.count += 1;
  }

  const investorMessageSummaryByLead = new Map<
    string,
    {
      firstInvestorMessageAt: number | null;
      investorMessageCount: number;
    }
  >();
  for (const row of investorMessageAggregates) {
    investorMessageSummaryByLead.set(row.lead_id, {
      firstInvestorMessageAt: toNumber(row.first_investor_message_at),
      investorMessageCount: toNumber(row.investor_message_count) ?? 0,
    });
  }

  const slaCounters = new Map<
    LeadStage,
    {
      totalLeads: number;
      withinSla: number;
      breached: number;
    }
  >();
  for (const stage of SLA_STAGE_ORDER) {
    slaCounters.set(stage, {
      totalLeads: 0,
      withinSla: 0,
      breached: 0,
    });
  }

  let engagedLeadCount = 0;
  let activeLeadCount = 0;
  let qualifiedLeadCount = 0;
  let kycSubmittedLeadCount = 0;
  let kycApprovedLeadCount = 0;
  let agreementSignedLeadCount = 0;
  let fundedLeadCount = 0;
  let totalMilestonePoints = 0;
  let exceptionalEscalationCount = 0;
  let kycReworkCount = 0;
  const kycTurnaroundDurationsSeconds: number[] = [];

  for (const lead of leads) {
    const eventSummary = eventSummaryByLead.get(lead.id);
    const firstInvestorMessageAt =
      investorMessageSummaryByLead.get(lead.id)?.firstInvestorMessageAt ?? null;
    const engagementAt = getLeadEngagementAt({
      lead,
      eventSummary,
      firstInvestorMessageAt,
    });

    if (
      engagementAt === null ||
      engagementAt < windowStartAt ||
      engagementAt > now
    ) {
      continue;
    }

    engagedLeadCount += 1;

    const highestMilestone = getHighestMilestone(lead, eventSummary);
    totalMilestonePoints += highestMilestone;

    if (highestMilestone >= 1) {
      qualifiedLeadCount += 1;
    }

    if (highestMilestone >= 2) {
      kycSubmittedLeadCount += 1;
    }

    if (highestMilestone >= 3) {
      kycApprovedLeadCount += 1;
    }

    if (highestMilestone >= 4) {
      agreementSignedLeadCount += 1;
    }

    if (highestMilestone >= 5) {
      fundedLeadCount += 1;
    }

    const firstHumanReviewRequestedAt = getFirstEventTime(
      eventSummary,
      'human_review_requested'
    );
    const firstSubmittedKycAt =
      getFirstEventTime(eventSummary, 'kyc_submitted') ||
      lead.kyc_submitted_at ||
      null;

    if (
      firstHumanReviewRequestedAt !== null &&
      (firstSubmittedKycAt === null ||
        firstHumanReviewRequestedAt < firstSubmittedKycAt)
    ) {
      exceptionalEscalationCount += 1;
    }

    if (
      highestMilestone >= 2 &&
      (eventSummary?.kyc_rejected?.count ?? 0) > 0
    ) {
      kycReworkCount += 1;
    }

    const approvedKycAt =
      getFirstEventTime(eventSummary, 'kyc_approved') ||
      (lead.kyc_approved === 1 ? lead.kyc_reviewed_at || null : null);

    if (approvedKycAt !== null) {
      const submittedKycAt =
        eventSummary?.kyc_submitted?.last || lead.kyc_submitted_at || null;

      if (submittedKycAt !== null && approvedKycAt >= submittedKycAt) {
        kycTurnaroundDurationsSeconds.push(approvedKycAt - submittedKycAt);
      }
    }

    const slaTarget = SLA_TARGETS[lead.stage];
    if (!slaTarget) {
      continue;
    }

    const enteredStageAt = getStageEnteredAt({
      lead,
      eventSummary,
      firstInvestorMessageAt,
    });
    const stageCounter = slaCounters.get(lead.stage);

    if (!stageCounter || enteredStageAt === null) {
      continue;
    }

    activeLeadCount += 1;
    stageCounter.totalLeads += 1;

    if (now - enteredStageAt <= slaTarget.seconds) {
      stageCounter.withinSla += 1;
    } else {
      stageCounter.breached += 1;
    }
  }

  const withinSlaLeadCount = Array.from(slaCounters.values()).reduce(
    (total, counter) => total + counter.withinSla,
    0
  );
  const breachedSlaLeadCount = Array.from(slaCounters.values()).reduce(
    (total, counter) => total + counter.breached,
    0
  );

  const progressionPercentage =
    engagedLeadCount > 0
      ? (totalMilestonePoints / (engagedLeadCount * 5)) * 100
      : null;
  const qualificationPassPercentage =
    engagedLeadCount > 0
      ? (qualifiedLeadCount / engagedLeadCount) * 100
      : null;
  const slaAdherencePercentage =
    activeLeadCount > 0 ? (withinSlaLeadCount / activeLeadCount) * 100 : null;
  const kycTurnaroundMedianSeconds = getMedian(kycTurnaroundDurationsSeconds);
  const kycTurnaroundMedianHours =
    kycTurnaroundMedianSeconds === null
      ? null
      : kycTurnaroundMedianSeconds / (60 * 60);
  const exceptionalEscalationPercentage =
    engagedLeadCount > 0
      ? (exceptionalEscalationCount / engagedLeadCount) * 100
      : null;
  const kycReworkPercentage =
    kycSubmittedLeadCount > 0
      ? (kycReworkCount / kycSubmittedLeadCount) * 100
      : null;

  const components: AgentEfficiencyMetric[] = [
    createPercentageMetric({
      key: 'progression',
      label: 'Progression',
      description:
        'Average milestone progress across the engaged lead cohort.',
      value: progressionPercentage,
      numerator: totalMilestonePoints,
      denominator: engagedLeadCount * 5,
      badThreshold: 35,
      goodThreshold: 55,
      benchmarks: {
        good: '> 55',
        watch: '35 - 55',
        bad: '< 35',
      },
    }),
    createPercentageMetric({
      key: 'qualification_pass',
      label: 'Qualification pass',
      description: 'Share of engaged leads that reached the deal-room gate.',
      value: qualificationPassPercentage,
      numerator: qualifiedLeadCount,
      denominator: engagedLeadCount,
      badThreshold: 40,
      goodThreshold: 60,
      benchmarks: {
        good: '> 60%',
        watch: '40% - 60%',
        bad: '< 40%',
      },
    }),
    createPercentageMetric({
      key: 'sla_adherence',
      label: 'SLA adherence',
      description:
        'Share of active cohort leads still within their current stage SLA.',
      value: slaAdherencePercentage,
      numerator: withinSlaLeadCount,
      denominator: activeLeadCount,
      badThreshold: 70,
      goodThreshold: 85,
      benchmarks: {
        good: '> 85%',
        watch: '70% - 85%',
        bad: '< 70%',
      },
      note:
        activeLeadCount === 0
          ? 'There are no active cohort leads in SLA-tracked stages right now.'
          : undefined,
    }),
    createDurationMetric({
      valueHours: kycTurnaroundMedianHours,
      sampleSize: kycTurnaroundDurationsSeconds.length,
    }),
    createLowerBetterPercentageMetric({
      key: 'exceptional_escalation',
      label: 'Exceptional escalation',
      description:
        'Share of engaged leads Amara escalated for human help before KYC submission.',
      value: exceptionalEscalationPercentage,
      numerator: exceptionalEscalationCount,
      denominator: engagedLeadCount,
      goodThreshold: 10,
      badThreshold: 20,
      benchmarks: {
        good: '< 10%',
        watch: '10% - 20%',
        bad: '> 20%',
      },
    }),
    createLowerBetterPercentageMetric({
      key: 'kyc_rework',
      label: 'KYC rework',
      description:
        'Share of KYC-submitted leads that were sent back for correction.',
      value: kycReworkPercentage,
      numerator: kycReworkCount,
      denominator: kycSubmittedLeadCount,
      goodThreshold: 15,
      badThreshold: 30,
      benchmarks: {
        good: '< 15%',
        watch: '15% - 30%',
        bad: '> 30%',
      },
      note:
        kycSubmittedLeadCount === 0
          ? 'This appears once the cohort includes KYC submissions.'
          : undefined,
    }),
    createUnavailableMetric(),
  ];

  const availableComponents = components.filter(
    (component) => component.score !== null
  );
  const availableWeight = availableComponents.reduce(
    (total, component) => total + component.weight,
    0
  );
  const weightedScoreValue =
    availableWeight > 0
      ? availableComponents.reduce((total, component) => {
          return total + ((component.score || 0) * component.weight) / availableWeight;
        }, 0)
      : null;

  const missingComponents = components
    .filter((component) => component.score === null)
    .map((component) => component.key);

  const slaBreakdown: AgentEfficiencySlaStage[] = SLA_STAGE_ORDER.map((stage) => {
    const target = SLA_TARGETS[stage]!;
    const counter = slaCounters.get(stage)!;
    const breachRate =
      counter.totalLeads > 0
        ? (counter.breached / counter.totalLeads) * 100
        : null;

    return {
      stage,
      label: target.label,
      totalLeads: counter.totalLeads,
      withinSla: counter.withinSla,
      breached: counter.breached,
      breachRate,
      slaHours: target.seconds / (60 * 60),
    };
  });

  const notes: string[] = [];
  if (missingComponents.includes('cost')) {
    notes.push(
      'Cost efficiency is excluded in Phase 1 until Qwen usage, latency, and operator-time telemetry are stored.'
    );
  }

  if (activeLeadCount > 0 && breachedSlaLeadCount > 0) {
    notes.push(
      `${breachedSlaLeadCount} active lead${breachedSlaLeadCount === 1 ? '' : 's'} are currently outside the configured stage SLA.`
    );
  }

  return {
    generatedAt: now,
    cohort: {
      windowDays,
      startAt: windowStartAt,
      endAt: now,
      totalLeadCount: leads.length,
      engagedLeadCount,
      activeLeadCount,
      qualifiedLeadCount,
      kycSubmittedLeadCount,
      kycApprovedLeadCount,
      agreementSignedLeadCount,
      fundedLeadCount,
    },
    score: {
      value: weightedScoreValue,
      label:
        missingComponents.length > 0 ? 'Phase 1 partial score' : 'Efficiency score',
      availableWeight,
      maximumWeight: 1,
      missingComponents,
      note:
        missingComponents.length > 0
          ? 'The score is normalized across the metrics that are already instrumented.'
          : undefined,
    },
    components,
    slaBreakdown,
    notes,
  };
}
