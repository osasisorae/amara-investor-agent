export type CoreDealRoomQuestionId =
  | 'returns_breakdown'
  | 'ownership'
  | 'revenue_model'
  | 'risks'
  | 'year_five'
  | 'diaspora_transfer'
  | 'timeline'
  | 'fees';

export interface DealRoomGuidanceMessage {
  role: 'agent' | 'investor';
  text: string;
}

export interface DealRoomQuestionDefinition {
  id: CoreDealRoomQuestionId;
  label: string;
}

export interface DealRoomQuestionCoverage {
  distinctQuestionIds: CoreDealRoomQuestionId[];
  distinctQuestionCount: number;
  totalQuestionCount: number;
  readyForKyc: boolean;
  remainingQuestions: DealRoomQuestionDefinition[];
  suggestedQuestions: string[];
}

export interface DealRoomComposerGuidance {
  title: string;
  helperText: string;
  questions: string[];
  coverage: DealRoomQuestionCoverage;
}

export type DealRoomKycIntent = 'soft' | 'hard';

export const DEAL_ROOM_MIN_DISTINCT_QUESTIONS = 3;
export const DEAL_ROOM_MIN_TOTAL_QUESTIONS = 4;
export const DEAL_ROOM_PROCEED_TO_KYC_PROMPT = "I'm ready to proceed to KYC.";

const CORE_GUIDED_DEAL_ROOM_QUESTIONS: DealRoomQuestionDefinition[] = [
  {
    id: 'returns_breakdown',
    label: 'Walk me through the full return breakdown',
  },
  {
    id: 'ownership',
    label: 'What does my ₦5M actually own in this SPV?',
  },
  {
    id: 'revenue_model',
    label: 'Show me the revenue model',
  },
  {
    id: 'risks',
    label: 'What are the risks and how are they mitigated?',
  },
  {
    id: 'year_five',
    label: 'What happens at Year 5?',
  },
  {
    id: 'diaspora_transfer',
    label: 'How do I move money in as a diaspora investor?',
  },
  {
    id: 'timeline',
    label: 'Show me the construction and operations timeline',
  },
  {
    id: 'fees',
    label: "What is FutureX's fee and how do they make money?",
  },
];

const NON_DILIGENCE_MESSAGES = new Set([
  'hi',
  'hello',
  'hey',
  'thanks',
  'thank you',
  'okay',
  'ok',
  'great',
  'sounds good',
]);

export function getCoreDealRoomQuestions(): DealRoomQuestionDefinition[] {
  return [...CORE_GUIDED_DEAL_ROOM_QUESTIONS];
}

export function getCoreDealRoomQuestionLabels(): string[] {
  return CORE_GUIDED_DEAL_ROOM_QUESTIONS.map((question) => question.label);
}

export function matchCoreDealRoomQuestion(
  query: string
): CoreDealRoomQuestionId | null {
  const normalized = query.toLowerCase();

  if (
    normalized.includes('return breakdown') ||
    normalized.includes('full return') ||
    normalized.includes('expected return') ||
    normalized.includes('total proceeds') ||
    normalized.includes('multiple')
  ) {
    return 'returns_breakdown';
  }

  if (
    normalized.includes('₦5m') ||
    normalized.includes('what does my 5m') ||
    normalized.includes('5m actually own') ||
    normalized.includes('what do i own') ||
    normalized.includes('what do i get') ||
    normalized.includes('own in this spv') ||
    normalized.includes('fractional economic interest')
  ) {
    return 'ownership';
  }

  if (
    normalized.includes('revenue model') ||
    normalized.includes('revenue stream') ||
    normalized.includes('rooms') ||
    normalized.includes('restaurant') ||
    normalized.includes('lounge')
  ) {
    return 'revenue_model';
  }

  if (
    normalized.includes('risks') ||
    normalized.includes('mitigated') ||
    normalized.includes('mitigation')
  ) {
    return 'risks';
  }

  if (
    normalized.includes('year 5') ||
    normalized.includes('year five') ||
    normalized.includes('what happens at the end') ||
    normalized.includes('end of the 5-year') ||
    normalized.includes('exit')
  ) {
    return 'year_five';
  }

  if (
    normalized.includes('diaspora investor') ||
    normalized.includes('move money') ||
    normalized.includes('send money') ||
    normalized.includes('wire') ||
    normalized.includes('repatriate')
  ) {
    return 'diaspora_transfer';
  }

  if (
    normalized.includes('timeline') ||
    normalized.includes('construction') ||
    normalized.includes('operations timeline') ||
    normalized.includes('month 60')
  ) {
    return 'timeline';
  }

  if (
    normalized.includes('futurex fee') ||
    normalized.includes('fees') ||
    normalized.includes('charging') ||
    normalized.includes('how do they make money') ||
    normalized.includes('management fee') ||
    normalized.includes('syndication fee')
  ) {
    return 'fees';
  }

  return null;
}

export function detectDealRoomKycIntent(
  query: string
): DealRoomKycIntent | null {
  const normalized = query.toLowerCase().replace(/[’]/g, "'");

  if (
    normalized.includes('proceed to kyc now') ||
    normalized.includes('move me to kyc now') ||
    normalized.includes('skip to kyc') ||
    normalized.includes('skip ahead to kyc') ||
    normalized.includes('i understand everything') ||
    normalized.includes('i understand enough') ||
    normalized.includes('i have enough information') ||
    normalized.includes('no more questions') ||
    normalized.includes("i don't have more questions") ||
    normalized.includes('i do not have more questions') ||
    normalized.includes('proceed anyway') ||
    normalized.includes('move ahead anyway')
  ) {
    return 'hard';
  }

  if (
    normalized.includes('ready for kyc') ||
    normalized.includes('proceed to kyc') ||
    normalized.includes('move to kyc') ||
    normalized.includes('start kyc') ||
    normalized.includes('ready to move forward') ||
    normalized.includes('ready to proceed') ||
    normalized.includes('let us proceed') ||
    normalized.includes("let's proceed") ||
    normalized.includes('what is the next step') ||
    normalized.includes("what's the next step") ||
    normalized.includes('continue to kyc')
  ) {
    return 'soft';
  }

  return null;
}

export function isLikelyCustomDealRoomQuestion(query: string): boolean {
  const normalized = query.toLowerCase().trim();

  if (!normalized || NON_DILIGENCE_MESSAGES.has(normalized)) {
    return false;
  }

  if (detectDealRoomKycIntent(normalized)) {
    return false;
  }

  const hasDealRoomTopic = [
    'return',
    'revenue',
    'risk',
    'downside',
    'timeline',
    'exit',
    'spv',
    'ownership',
    'ticket',
    'distribution',
    'cash flow',
    'cashflow',
    'reporting',
    'report',
    'governance',
    'vote',
    'voting',
    'operator',
    'contractor',
    'construction',
    'operations',
    'diaspora',
    'move money',
    'repatriate',
    'fee',
    'yield',
    'document',
    'structure',
  ].some((term) => normalized.includes(term));
  const hasQuestionLeadIn = [
    'what',
    'how',
    'why',
    'when',
    'can you',
    'could you',
    'tell me',
    'walk me through',
    'show me',
    'explain',
    'talk me through',
  ].some((term) => normalized.includes(term));

  if (normalized.includes('?')) {
    return hasDealRoomTopic;
  }

  return hasDealRoomTopic && hasQuestionLeadIn;
}

export function deriveDealRoomQuestionCoverage(
  messages: DealRoomGuidanceMessage[]
): DealRoomQuestionCoverage {
  const distinctQuestionIds: CoreDealRoomQuestionId[] = [];
  let totalQuestionCount = 0;

  for (const message of messages) {
    if (message.role !== 'investor') {
      continue;
    }

    const matchedQuestionId = matchCoreDealRoomQuestion(message.text);

    if (matchedQuestionId) {
      totalQuestionCount += 1;

      if (!distinctQuestionIds.includes(matchedQuestionId)) {
        distinctQuestionIds.push(matchedQuestionId);
      }

      continue;
    }

    if (isLikelyCustomDealRoomQuestion(message.text)) {
      totalQuestionCount += 1;
    }
  }

  const readyForKyc =
    distinctQuestionIds.length >= DEAL_ROOM_MIN_DISTINCT_QUESTIONS ||
    totalQuestionCount >= DEAL_ROOM_MIN_TOTAL_QUESTIONS;
  const remainingQuestions = CORE_GUIDED_DEAL_ROOM_QUESTIONS.filter(
    (question) => !distinctQuestionIds.includes(question.id)
  );
  const suggestedQuestions = readyForKyc
    ? [
        DEAL_ROOM_PROCEED_TO_KYC_PROMPT,
        ...remainingQuestions.slice(0, 3).map((question) => question.label),
      ]
    : remainingQuestions.slice(0, 4).map((question) => question.label);

  return {
    distinctQuestionIds,
    distinctQuestionCount: distinctQuestionIds.length,
    totalQuestionCount,
    readyForKyc,
    remainingQuestions,
    suggestedQuestions,
  };
}

export function buildDealRoomComposerGuidance(
  messages: DealRoomGuidanceMessage[]
): DealRoomComposerGuidance {
  const coverage = deriveDealRoomQuestionCoverage(messages);

  if (coverage.readyForKyc) {
    return {
      title: 'Next step',
      helperText:
        'You have covered the core diligence areas. You can keep asking questions, or move straight into KYC when you are comfortable.',
      questions: coverage.suggestedQuestions,
      coverage,
    };
  }

  return {
    title: 'Suggested questions',
    helperText:
      'Pressure-test the deal before KYC. These are the next best questions to ask.',
    questions: coverage.suggestedQuestions,
    coverage,
  };
}
