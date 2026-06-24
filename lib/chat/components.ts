import type { LeadStage } from '@/lib/db/leads';
import {
  EXIT_STRATEGY,
  SPV_NAME,
  TARGET_RETURN,
} from '@/lib/agreement/template';
import {
  MINIMUM_HOLD_YEARS,
  MINIMUM_TICKET_NGN,
} from '@/lib/agent/qualification';
import {
  buildExitCardData,
  buildGuidedQuestionsData,
  buildOwnershipCardData,
  buildReturnsTableData,
  buildRevenueChartData,
  buildRiskTableData,
  buildTimelineCardData,
} from '@/lib/knowledge-base/deal-room-data';
import {
  getKycDocumentLabel,
  KYC_DOCUMENT_OPTIONS,
  type KycPrimaryDocumentType,
} from '@/lib/kyc/config';

export type AgentMessageType =
  | 'text'
  | 'deal_card'
  | 'document_list'
  | 'pipeline_status'
  | 'kyc_prompt'
  | 'kyc_consent'
  | 'kyc_personal_details'
  | 'kyc_document_selector'
  | 'kyc_upload'
  | 'kyc_submitted'
  | 'guided_questions'
  | 'returns_table'
  | 'revenue_chart'
  | 'ownership_card'
  | 'risk_table'
  | 'timeline_card'
  | 'exit_card';

export type UIComponentType = Exclude<AgentMessageType, 'text'>;

export interface DealCardComponentData {
  spvName: string;
  targetReturn: string;
  holdPeriod: string;
  minimumTicket: string;
  exitStrategy: string;
}

export interface DocumentCardData {
  label: string;
  href: string;
  description: string;
}

export interface DocumentListComponentData {
  title: string;
  description: string;
  documents: DocumentCardData[];
}

export interface PipelineStageData {
  stage: LeadStage;
  label: string;
}

export interface PipelineStatusComponentData {
  currentStage: LeadStage;
  title: string;
  description: string;
  stages: PipelineStageData[];
}

export interface KycPromptComponentData {
  title: string;
  description: string;
  requirements: Array<{
    key: 'id' | 'residence' | 'funds';
    label: string;
    optional?: boolean;
  }>;
}

export interface GuidedQuestionsComponentData {
  title: string;
  questions: string[];
}

export interface KycConsentComponentData {
  title: string;
  items: Array<{
    label: string;
    value: string;
  }>;
  proceedLabel: string;
  questionsLabel: string;
}

export interface KycPersonalDetailsComponentData {
  title: string;
  fullLegalName?: string;
  dateOfBirth?: string;
  nationality?: string;
  countryOfResidence?: string;
  phoneNumber?: string;
}

export interface KycDocumentSelectorComponentData {
  title: string;
  options: Array<{
    value: KycPrimaryDocumentType;
    label: string;
  }>;
}

export interface KycUploadComponentData {
  title: string;
  documentType: KycPrimaryDocumentType;
  documentTypeLabel: string;
}

export interface KycSubmittedComponentData {
  title: string;
  description: string;
  reviewWindowLabel: string;
}

export interface ReturnsTableComponentData {
  title: string;
  baseCaseLabel: string;
  upsideCaseLabel: string;
  rows: Array<{
    label: string;
    baseCase: string;
    upsideCase: string;
    highlight?: boolean;
  }>;
}

export interface RevenueChartComponentData {
  title: string;
  description: string;
  streams: Array<{
    name: string;
    monthly: number;
    annual: number;
  }>;
  grossRevenue: {
    monthly: string;
    annual: string;
  };
  operatingCosts: {
    monthly: string;
    annual: string;
  };
  netProfit: {
    monthly: string;
    annual: string;
  };
  splitPercentages: {
    investors: string;
    futurex: string;
  };
  splitValues: {
    investors: string;
    futurex: string;
  };
}

export interface OwnershipCardComponentData {
  title: string;
  ticketAmount: string;
  spvStakePercentage: string;
  investorSlots: string;
  totalRaise: string;
  ticketShareOfRaise: string;
  legalHoldings: string[];
  quarterlyDistributionCadence: string;
}

export interface RiskTableComponentData {
  title: string;
  rows: Array<{
    risk: string;
    mitigation: string;
  }>;
}

export interface TimelineCardComponentData {
  title: string;
  milestones: Array<{
    label: string;
    timing: string;
    description: string;
  }>;
}

export interface ExitCardComponentData {
  title: string;
  projectedAssetValue: string;
  decisionProcess: string;
  governanceNote: string;
  options: Array<{
    label: string;
    description: string;
  }>;
}

export interface UIComponentDataMap {
  deal_card: DealCardComponentData;
  document_list: DocumentListComponentData;
  pipeline_status: PipelineStatusComponentData;
  kyc_prompt: KycPromptComponentData;
  kyc_consent: KycConsentComponentData;
  kyc_personal_details: KycPersonalDetailsComponentData;
  kyc_document_selector: KycDocumentSelectorComponentData;
  kyc_upload: KycUploadComponentData;
  kyc_submitted: KycSubmittedComponentData;
  guided_questions: GuidedQuestionsComponentData;
  returns_table: ReturnsTableComponentData;
  revenue_chart: RevenueChartComponentData;
  ownership_card: OwnershipCardComponentData;
  risk_table: RiskTableComponentData;
  timeline_card: TimelineCardComponentData;
  exit_card: ExitCardComponentData;
}

export type UIComponentMetadata<T extends UIComponentType = UIComponentType> = {
  component: T;
  data: UIComponentDataMap[T];
};

export const PIPELINE_STAGES: PipelineStageData[] = [
  { stage: 'outreach_sent', label: 'Outreach' },
  { stage: 'qualifying', label: 'Qualify' },
  { stage: 'deal_room', label: 'Deal Room' },
  { stage: 'kyc_intake', label: 'KYC Intake' },
  { stage: 'pending_human_review', label: 'Human Review' },
  { stage: 'agreement_pending', label: 'Agreement' },
  { stage: 'payment_pending', label: 'Payment' },
  { stage: 'closed', label: 'Closed' },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isUIComponentType(value: string): value is UIComponentType {
  return (
    value === 'deal_card' ||
    value === 'document_list' ||
    value === 'pipeline_status' ||
    value === 'kyc_prompt' ||
    value === 'kyc_consent' ||
    value === 'kyc_personal_details' ||
    value === 'kyc_document_selector' ||
    value === 'kyc_upload' ||
    value === 'kyc_submitted' ||
    value === 'guided_questions' ||
    value === 'returns_table' ||
    value === 'revenue_chart' ||
    value === 'ownership_card' ||
    value === 'risk_table' ||
    value === 'timeline_card' ||
    value === 'exit_card'
  );
}

export function buildDealCardData(): DealCardComponentData {
  return {
    spvName: SPV_NAME,
    targetReturn: TARGET_RETURN,
    holdPeriod: `${MINIMUM_HOLD_YEARS} years`,
    minimumTicket: `₦${MINIMUM_TICKET_NGN.toLocaleString('en-NG')}`,
    exitStrategy: EXIT_STRATEGY,
  };
}

export function buildDocumentListData(): DocumentListComponentData {
  return {
    title: 'Investor documents',
    description:
      'These are the two core documents to review as you evaluate the opportunity.',
    documents: [
      {
        label: 'Deal Brief',
        href: '/deal-docs/akwa-ibom-deal-brief.md',
        description:
          'Opportunity snapshot, economics, returns framing, and operating assumptions.',
      },
      {
        label: 'SPV Structure Explainer',
        href: '/deal-docs/spv-structure-explainer.md',
        description:
          'How the vehicle is structured and how investor ownership is ring-fenced.',
      },
    ],
  };
}

export function buildPipelineStatusData(
  currentStage: LeadStage
): PipelineStatusComponentData {
  return {
    currentStage,
    title: 'Your progress',
    description: 'Here is where you currently sit in the 8-stage onboarding pipeline.',
    stages: PIPELINE_STAGES,
  };
}

export function buildKycPromptData(): KycPromptComponentData {
  return {
    title: 'Upload your KYC documents',
    description:
      'When you are ready, upload the core documents below right here in the conversation.',
    requirements: [
      { key: 'id', label: 'Government ID' },
      { key: 'residence', label: 'Proof of residence' },
      { key: 'funds', label: 'Proof of funds', optional: true },
    ],
  };
}

export function buildKycConsentData(): KycConsentComponentData {
  return {
    title: 'Before we proceed — your data rights',
    items: [
      {
        label: 'What is collected',
        value:
          'Full name, government ID, proof of address, and source of funds.',
      },
      {
        label: 'Why',
        value: 'ISA 2025 compliance and investor verification.',
      },
      {
        label: 'Who processes it',
        value:
          'FutureX Nexus Development Limited plus a human compliance officer. AI performs intake only — a human makes the final decision.',
      },
      {
        label: 'Cross-border transfer',
        value: 'Data may be processed outside Nigeria.',
      },
    ],
    proceedLabel: 'I consent and want to proceed',
    questionsLabel: 'I have questions first',
  };
}

export function buildKycPersonalDetailsData(
  defaults: Partial<KycPersonalDetailsComponentData> = {}
): KycPersonalDetailsComponentData {
  return {
    title: 'Tell us about yourself',
    fullLegalName: defaults.fullLegalName || '',
    dateOfBirth: defaults.dateOfBirth || '',
    nationality: defaults.nationality || '',
    countryOfResidence: defaults.countryOfResidence || '',
    phoneNumber: defaults.phoneNumber || '',
  };
}

export function buildKycDocumentSelectorData(): KycDocumentSelectorComponentData {
  return {
    title: 'Choose the ID you want to use for verification',
    options: [...KYC_DOCUMENT_OPTIONS],
  };
}

export function buildKycUploadData(
  documentType: KycPrimaryDocumentType = 'passport'
): KycUploadComponentData {
  return {
    title: 'Upload your KYC documents',
    documentType,
    documentTypeLabel: getKycDocumentLabel(documentType),
  };
}

export function buildKycSubmittedData(): KycSubmittedComponentData {
  return {
    title: 'Documents submitted',
    description:
      "A member of our compliance team will review your documents within 2 business days. You'll receive an email when your review is complete.",
    reviewWindowLabel: '2 business days',
  };
}

export function buildDefaultComponentData(
  component: UIComponentType,
  currentStage: LeadStage
): UIComponentDataMap[UIComponentType] {
  switch (component) {
    case 'deal_card':
      return buildDealCardData();
    case 'document_list':
      return buildDocumentListData();
    case 'pipeline_status':
      return buildPipelineStatusData(currentStage);
    case 'kyc_prompt':
      return buildKycPromptData();
    case 'kyc_consent':
      return buildKycConsentData();
    case 'kyc_personal_details':
      return buildKycPersonalDetailsData();
    case 'kyc_document_selector':
      return buildKycDocumentSelectorData();
    case 'kyc_upload':
      return buildKycUploadData();
    case 'kyc_submitted':
      return buildKycSubmittedData();
    case 'guided_questions':
      return buildGuidedQuestionsData();
    case 'returns_table':
      return buildReturnsTableData();
    case 'revenue_chart':
      return buildRevenueChartData();
    case 'ownership_card':
      return buildOwnershipCardData();
    case 'risk_table':
      return buildRiskTableData();
    case 'timeline_card':
      return buildTimelineCardData();
    case 'exit_card':
      return buildExitCardData();
  }
}

export function createComponentMetadata<T extends UIComponentType>(
  component: T,
  data: UIComponentDataMap[T]
): UIComponentMetadata<T> {
  return {
    component,
    data,
  };
}

export function getComponentFallbackText(
  component: UIComponentType
): string {
  switch (component) {
    case 'deal_card':
      return '[ui:deal_card] Deal room overview';
    case 'document_list':
      return '[ui:document_list] Investor documents';
    case 'pipeline_status':
      return '[ui:pipeline_status] Pipeline progress';
    case 'kyc_prompt':
      return '[ui:kyc_prompt] KYC document upload';
    case 'kyc_consent':
      return '[ui:kyc_consent] KYC consent';
    case 'kyc_personal_details':
      return '[ui:kyc_personal_details] KYC personal details';
    case 'kyc_document_selector':
      return '[ui:kyc_document_selector] KYC document selector';
    case 'kyc_upload':
      return '[ui:kyc_upload] KYC upload';
    case 'kyc_submitted':
      return '[ui:kyc_submitted] KYC submitted';
    case 'guided_questions':
      return '[ui:guided_questions] Due diligence prompts';
    case 'returns_table':
      return '[ui:returns_table] Return breakdown';
    case 'revenue_chart':
      return '[ui:revenue_chart] Revenue model';
    case 'ownership_card':
      return '[ui:ownership_card] Ownership structure';
    case 'risk_table':
      return '[ui:risk_table] Risks and mitigations';
    case 'timeline_card':
      return '[ui:timeline_card] Project timeline';
    case 'exit_card':
      return '[ui:exit_card] Year 5 exit';
  }
}

export function parseUIComponentMetadata(
  value: unknown
): UIComponentMetadata | null {
  const parsed =
    typeof value === 'string'
      ? (() => {
          try {
            return JSON.parse(value) as unknown;
          } catch {
            return null;
          }
        })()
      : value;

  if (!isRecord(parsed)) {
    return null;
  }

  const component = parsed.component;
  const data = parsed.data;

  if (typeof component !== 'string' || !isUIComponentType(component)) {
    return null;
  }

  if (!isRecord(data)) {
    return null;
  }

  return {
    component,
    data: data as unknown as UIComponentDataMap[typeof component],
  };
}
