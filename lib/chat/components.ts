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
  buildDealBriefData,
  buildExitCardData,
  buildGuidedQuestionsData,
  buildOwnershipCardData,
  buildReturnsTableData,
  buildRevenueChartData,
  buildRiskTableData,
  buildSpvStructureData,
  buildTimelineCardData,
} from '@/lib/knowledge-base/deal-room-data';
import {
  getKycDocumentLabel,
  KYC_DOCUMENT_OPTIONS,
  type KycPrimaryDocumentType,
} from '@/lib/kyc/config';
import {
  getKycSourceOfFundsLabel,
  getRequiredAdditionalKycDocuments,
  KYC_PAYMENT_METHOD_OPTIONS,
  KYC_RISK_DECLARATION_DEFINITIONS,
  KYC_SOURCE_OF_FUNDS_OPTIONS,
  type KycAdditionalDocumentRequirement,
  type KycPaymentMethod,
  type KycRiskDeclarationField,
  type KycSourceOfFundsType,
  type KycYesNoValue,
} from '@/lib/kyc/requirements';

export type AgentMessageType =
  | 'text'
  | 'deal_card'
  | 'document_list'
  | 'payment_instructions'
  | 'payment_method_selector'
  | 'pipeline_status'
  | 'kyc_prompt'
  | 'kyc_consent'
  | 'kyc_personal_details'
  | 'kyc_investor_profile'
  | 'kyc_document_selector'
  | 'kyc_upload'
  | 'kyc_funding_source'
  | 'kyc_additional_uploads'
  | 'kyc_risk_declarations'
  | 'kyc_payment_account'
  | 'kyc_submitted'
  | 'deal_brief'
  | 'spv_structure'
  | 'guided_questions'
  | 'returns_table'
  | 'revenue_chart'
  | 'ownership_card'
  | 'risk_table'
  | 'timeline_card'
  | 'exit_card'
  | 'agreement_ready';

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
  triggerPrompt: string;
  description: string;
}

export interface DocumentListComponentData {
  title: string;
  description: string;
  documents: DocumentCardData[];
}

export interface PaymentInstructionsDetailsData {
  ngn: {
    bank: string;
    accountName: string;
    accountNumber: string;
    sortCode: string;
  };
  usd: {
    bank: string;
    accountName: string;
    accountNumber: string;
    routingNumber: string;
    swiftCode: string;
  };
  crypto: {
    usdc_eth: string;
    usdc_sol: string;
    usdc_bnb: string;
    usdt_bnb: string;
    usdt_trx: string;
  };
}

export interface PaymentInstructionsComponentData {
  paymentReference: string;
  commitmentAmountNgn: number;
  slotCount: number;
  paymentDetails: PaymentInstructionsDetailsData;
}

export interface PaymentMethodSelectorComponentData {
  paymentReference: string;
  commitmentAmountNgn: number;
  slotCount: number;
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

export interface KycInvestorProfileComponentData {
  title: string;
  occupation?: string;
  employerOrBusinessName?: string;
  employerOrBusinessAddress?: string;
  taxResidencyCountry?: string;
  taxIdentificationNumber?: string;
}

export interface KycUploadComponentData {
  title: string;
  documentType: KycPrimaryDocumentType;
  documentTypeLabel: string;
}

export interface KycFundingSourceComponentData {
  title: string;
  options: Array<{
    value: KycSourceOfFundsType;
    label: string;
  }>;
  sourceOfFundsType?: KycSourceOfFundsType;
  sourceOfFundsSummary?: string;
  sourceOfWealthSummary?: string;
}

export interface KycAdditionalUploadsComponentData {
  title: string;
  sourceOfFundsType: KycSourceOfFundsType;
  sourceOfFundsLabel: string;
  requiredDocuments: KycAdditionalDocumentRequirement[];
}

export interface KycRiskDeclarationsComponentData {
  title: string;
  declarations: Array<{
    key: KycRiskDeclarationField;
    label: string;
    description: string;
  }>;
}

export interface KycPaymentAccountComponentData {
  title: string;
  fundingMethods: Array<{
    value: KycPaymentMethod;
    label: string;
  }>;
  expectedFundingMethod?: KycPaymentMethod;
  expectedFundingBankCountry?: string;
  expectedFundingAccountName?: string;
  paymentFromOwnAccount?: KycYesNoValue;
}

export interface KycSubmittedComponentData {
  title: string;
  description: string;
  reviewWindowLabel: string;
}

export interface DealBriefCardComponentData {
  title: string;
  snapshot: Array<{
    label: string;
    value: string;
  }>;
  whatSpvOwns: string;
  returnsSummary: {
    originalTicket: string;
    baseCaseTotalProceeds: string;
    baseCaseMultiple: string;
    upsideCaseTotalProceeds: string;
    upsideCaseMultiple: string;
  };
  revenueStreams: Array<{
    label: string;
    monthly: string;
    note?: string;
  }>;
  totalGrossMonthly: string;
  capitalUse: Array<{
    label: string;
    amount: string;
  }>;
}

export interface SpvStructureCardComponentData {
  title: string;
  whySpv: string;
  investorGroupLabel: string;
  spvLabel: string;
  assetSummary: string;
  revenueRecipientLabel: string;
  revenueSplit: {
    investors: string;
    futurex: string;
  };
  diligenceQuestions: string[];
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

export interface AgreementReadyComponentData {
  agreementUrl: string;
  spvName: string;
}

export interface UIComponentDataMap {
  deal_card: DealCardComponentData;
  document_list: DocumentListComponentData;
  payment_instructions: PaymentInstructionsComponentData;
  payment_method_selector: PaymentMethodSelectorComponentData;
  pipeline_status: PipelineStatusComponentData;
  kyc_prompt: KycPromptComponentData;
  kyc_consent: KycConsentComponentData;
  kyc_personal_details: KycPersonalDetailsComponentData;
  kyc_investor_profile: KycInvestorProfileComponentData;
  kyc_document_selector: KycDocumentSelectorComponentData;
  kyc_upload: KycUploadComponentData;
  kyc_funding_source: KycFundingSourceComponentData;
  kyc_additional_uploads: KycAdditionalUploadsComponentData;
  kyc_risk_declarations: KycRiskDeclarationsComponentData;
  kyc_payment_account: KycPaymentAccountComponentData;
  kyc_submitted: KycSubmittedComponentData;
  deal_brief: DealBriefCardComponentData;
  spv_structure: SpvStructureCardComponentData;
  guided_questions: GuidedQuestionsComponentData;
  returns_table: ReturnsTableComponentData;
  revenue_chart: RevenueChartComponentData;
  ownership_card: OwnershipCardComponentData;
  risk_table: RiskTableComponentData;
  timeline_card: TimelineCardComponentData;
  exit_card: ExitCardComponentData;
  agreement_ready: AgreementReadyComponentData;
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
    value === 'payment_instructions' ||
    value === 'payment_method_selector' ||
    value === 'pipeline_status' ||
    value === 'kyc_prompt' ||
    value === 'kyc_consent' ||
    value === 'kyc_personal_details' ||
    value === 'kyc_investor_profile' ||
    value === 'kyc_document_selector' ||
    value === 'kyc_upload' ||
    value === 'kyc_funding_source' ||
    value === 'kyc_additional_uploads' ||
    value === 'kyc_risk_declarations' ||
    value === 'kyc_payment_account' ||
    value === 'kyc_submitted' ||
    value === 'deal_brief' ||
    value === 'spv_structure' ||
    value === 'guided_questions' ||
    value === 'returns_table' ||
    value === 'revenue_chart' ||
    value === 'ownership_card' ||
    value === 'risk_table' ||
    value === 'timeline_card' ||
    value === 'exit_card' ||
    value === 'agreement_ready'
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
        triggerPrompt: 'Show me the deal brief',
        description:
          'Opportunity snapshot, economics, returns framing, and operating assumptions.',
      },
      {
        label: 'SPV Structure Explainer',
        triggerPrompt: 'Show me the SPV structure explainer',
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
      'When you are ready, share the core identity details below right here in the conversation. Supporting source of funds evidence can be added now or clarified during human review.',
    requirements: [
      { key: 'id', label: 'Government ID' },
      { key: 'residence', label: 'Proof of residence' },
      { key: 'funds', label: 'Supporting source of funds evidence', optional: true },
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
          'Identity details, any investor profile or tax details you choose to share, proof of address, your source of funds explanation, any supporting evidence you upload, risk declarations, and the account expected to send your investment.',
      },
      {
        label: 'Why',
        value:
          'ISA 2025 compliance, investor verification, sanctions and PEP screening, and account ownership verification.',
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

export function buildKycInvestorProfileData(
  defaults: Partial<KycInvestorProfileComponentData> = {}
): KycInvestorProfileComponentData {
  return {
    title: 'Add your investor profile details',
    occupation: defaults.occupation || '',
    employerOrBusinessName: defaults.employerOrBusinessName || '',
    employerOrBusinessAddress: defaults.employerOrBusinessAddress || '',
    taxResidencyCountry: defaults.taxResidencyCountry || '',
    taxIdentificationNumber: defaults.taxIdentificationNumber || '',
  };
}

export function buildKycUploadData(
  documentType: KycPrimaryDocumentType = 'passport'
): KycUploadComponentData {
  return {
    title: 'Upload your identity documents',
    documentType,
    documentTypeLabel: getKycDocumentLabel(documentType),
  };
}

export function buildKycFundingSourceData(
  defaults: Partial<KycFundingSourceComponentData> = {}
): KycFundingSourceComponentData {
  return {
    title: 'How will you fund this investment',
    options: [...KYC_SOURCE_OF_FUNDS_OPTIONS],
    sourceOfFundsType: defaults.sourceOfFundsType,
    sourceOfFundsSummary: defaults.sourceOfFundsSummary || '',
    sourceOfWealthSummary: defaults.sourceOfWealthSummary || '',
  };
}

export function buildKycAdditionalUploadsData(
  sourceOfFundsType: KycSourceOfFundsType = 'salary'
): KycAdditionalUploadsComponentData {
  return {
    title: 'Upload any source of funds evidence you already have',
    sourceOfFundsType,
    sourceOfFundsLabel: getKycSourceOfFundsLabel(sourceOfFundsType),
    requiredDocuments: getRequiredAdditionalKycDocuments(sourceOfFundsType),
  };
}

export function buildKycRiskDeclarationsData(): KycRiskDeclarationsComponentData {
  return {
    title: 'Confirm the risk declarations below',
    declarations: [...KYC_RISK_DECLARATION_DEFINITIONS],
  };
}

export function buildKycPaymentAccountData(
  defaults: Partial<KycPaymentAccountComponentData> = {}
): KycPaymentAccountComponentData {
  return {
    title: 'Confirm the account that will send your funds',
    fundingMethods: [...KYC_PAYMENT_METHOD_OPTIONS],
    expectedFundingMethod: defaults.expectedFundingMethod,
    expectedFundingBankCountry: defaults.expectedFundingBankCountry || '',
    expectedFundingAccountName: defaults.expectedFundingAccountName || '',
    paymentFromOwnAccount: defaults.paymentFromOwnAccount,
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

export function buildDealBriefComponentData(): DealBriefCardComponentData {
  return buildDealBriefData();
}

export function buildSpvStructureComponentData(): SpvStructureCardComponentData {
  return buildSpvStructureData();
}

export function buildAgreementReadyData(): AgreementReadyComponentData {
  return {
    agreementUrl: '',
    spvName: SPV_NAME,
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
    case 'payment_instructions':
      return {
        paymentReference: '',
        commitmentAmountNgn: 0,
        slotCount: 1,
        paymentDetails: {
          ngn: {
            bank: 'Zenith Bank',
            accountName: 'FutureX Nexus Development Limited',
            accountNumber: '',
            sortCode: '',
          },
          usd: {
            bank: 'Grey Finance',
            accountName: 'FutureX Nexus Development Limited',
            accountNumber: '',
            routingNumber: '',
            swiftCode: '',
          },
          crypto: {
            usdc_eth: '',
            usdc_sol: '',
            usdc_bnb: '',
            usdt_bnb: '',
            usdt_trx: '',
          },
        },
      };
    case 'payment_method_selector':
      return {
        paymentReference: '',
        commitmentAmountNgn: 0,
        slotCount: 1,
      };
    case 'pipeline_status':
      return buildPipelineStatusData(currentStage);
    case 'kyc_prompt':
      return buildKycPromptData();
    case 'kyc_consent':
      return buildKycConsentData();
    case 'kyc_personal_details':
      return buildKycPersonalDetailsData();
    case 'kyc_investor_profile':
      return buildKycInvestorProfileData();
    case 'kyc_document_selector':
      return buildKycDocumentSelectorData();
    case 'kyc_upload':
      return buildKycUploadData();
    case 'kyc_funding_source':
      return buildKycFundingSourceData();
    case 'kyc_additional_uploads':
      return buildKycAdditionalUploadsData();
    case 'kyc_risk_declarations':
      return buildKycRiskDeclarationsData();
    case 'kyc_payment_account':
      return buildKycPaymentAccountData();
    case 'kyc_submitted':
      return buildKycSubmittedData();
    case 'deal_brief':
      return buildDealBriefComponentData();
    case 'spv_structure':
      return buildSpvStructureComponentData();
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
    case 'agreement_ready':
      return buildAgreementReadyData();
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
    case 'payment_instructions':
      return '[ui:payment_instructions] Manual wire instructions';
    case 'payment_method_selector':
      return '[ui:payment_method_selector] Choose a payment method';
    case 'pipeline_status':
      return '[ui:pipeline_status] Pipeline progress';
    case 'kyc_prompt':
      return '[ui:kyc_prompt] KYC document upload';
    case 'kyc_consent':
      return '[ui:kyc_consent] KYC consent';
    case 'kyc_personal_details':
      return '[ui:kyc_personal_details] KYC personal details';
    case 'kyc_investor_profile':
      return '[ui:kyc_investor_profile] KYC investor profile';
    case 'kyc_document_selector':
      return '[ui:kyc_document_selector] KYC document selector';
    case 'kyc_upload':
      return '[ui:kyc_upload] KYC upload';
    case 'kyc_funding_source':
      return '[ui:kyc_funding_source] KYC funding source';
    case 'kyc_additional_uploads':
      return '[ui:kyc_additional_uploads] Source of funds uploads';
    case 'kyc_risk_declarations':
      return '[ui:kyc_risk_declarations] Risk declarations';
    case 'kyc_payment_account':
      return '[ui:kyc_payment_account] Payment account verification';
    case 'kyc_submitted':
      return '[ui:kyc_submitted] KYC submitted';
    case 'deal_brief':
      return '[ui:deal_brief] Deal brief';
    case 'spv_structure':
      return '[ui:spv_structure] SPV structure';
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
    case 'agreement_ready':
      return '[ui:agreement_ready] Agreement ready';
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
