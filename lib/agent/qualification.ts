export type QualificationQuestion =
  | 'investor_profile'
  | 'investment_horizon'
  | 'ticket_size'
  | 'kyc_willingness';

export interface QualificationAssessment {
  question: QualificationQuestion;
  matched: boolean;
  passed: boolean;
  summary: string;
  reason?: string;
  location?: string;
}

export const QUALIFICATION_SEQUENCE: QualificationQuestion[] = [
  'investor_profile',
  'investment_horizon',
  'ticket_size',
  'kyc_willingness',
];

const DIASPORA_LOCATION_KEYWORDS = [
  'london',
  'uk',
  'united kingdom',
  'england',
  'manchester',
  'birmingham',
  'scotland',
  'wales',
  'ireland',
  'usa',
  'us',
  'united states',
  'canada',
  'toronto',
  'vancouver',
  'calgary',
  'dubai',
  'abu dhabi',
  'uae',
  'germany',
  'france',
  'italy',
  'netherlands',
  'europe',
  'abroad',
  'outside nigeria',
];

const NIGERIA_LOCATION_KEYWORDS = [
  'nigeria',
  'lagos',
  'abuja',
  'port harcourt',
  'ibadan',
  'lekki',
  'enugu',
  'kano',
];

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function includesAny(value: string, terms: string[]): boolean {
  return terms.some((term) => value.includes(term));
}

function detectBinaryIntent(value: string): 'yes' | 'no' | null {
  if (
    /\b(no|nope|nah|not really|not comfortable|not willing|can\'t|cannot|won\'t)\b/i.test(
      value
    )
  ) {
    return 'no';
  }

  if (
    /\b(yes|yeah|yep|yup|yh|sure|okay|ok|comfortable|fine|absolutely|definitely|happy to|willing)\b/i.test(
      value
    )
  ) {
    return 'yes';
  }

  return null;
}

function titleCaseWords(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function extractLocation(value: string): string | undefined {
  const match = value.match(
    /\b(?:based in|live in|located in|resident in|from)\s+([a-z ,'-]{2,40})/i
  );

  if (!match) {
    return undefined;
  }

  const cleaned = match[1]
    .split(/[.!?]/)[0]
    .replace(/\b(and|but|so)\b.*$/i, '')
    .trim();

  if (!cleaned) {
    return undefined;
  }

  return titleCaseWords(cleaned);
}

function parseDurationInYears(value: string): number | null {
  const numericMatch = value.match(/(\d+(?:\.\d+)?)\s*(?:years?|yrs?)/i);
  if (numericMatch) {
    return Number(numericMatch[1]);
  }

  if (/\bthree years?\b/i.test(value)) {
    return 3;
  }

  if (/\btwo years?\b/i.test(value)) {
    return 2;
  }

  if (/\bone year\b/i.test(value)) {
    return 1;
  }

  return null;
}

function parseMoneyValue(value: string): { amount: number; currency: 'NGN' | 'USD' } | null {
  const normalized = normalizeText(value);

  const nairaMatch = normalized.match(
    /(?:₦|ngn|naira)?\s*(\d+(?:\.\d+)?)\s*(m|million|k|thousand)?/
  );

  if (nairaMatch && /(?:₦|ngn|naira|million|m|thousand|k)/.test(normalized)) {
    let amount = Number(nairaMatch[1]);
    const unit = nairaMatch[2];

    if (unit === 'm' || unit === 'million') {
      amount *= 1_000_000;
    } else if (unit === 'k' || unit === 'thousand') {
      amount *= 1_000;
    }

    return { amount, currency: 'NGN' };
  }

  const usdMatch = normalized.match(/(?:\$|usd)\s*(\d+(?:,\d{3})*(?:\.\d+)?)/);
  if (usdMatch) {
    return {
      amount: Number(usdMatch[1].replace(/,/g, '')),
      currency: 'USD',
    };
  }

  return null;
}

export function getNextQualificationQuestion(
  answeredQuestions: string[]
): QualificationQuestion | null {
  for (const question of QUALIFICATION_SEQUENCE) {
    if (!answeredQuestions.includes(question)) {
      return question;
    }
  }

  return null;
}

export function getDisqualificationReason(question: QualificationQuestion): string {
  switch (question) {
    case 'investor_profile':
      return 'Does not meet the diaspora or verified local HNI requirement.';
    case 'investment_horizon':
      return 'Not comfortable with the minimum 5-year investment horizon.';
    case 'ticket_size':
      return 'Below the minimum ticket size of NGN 5M (or USD equivalent).';
    case 'kyc_willingness':
      return 'Not willing to complete KYC compliance.';
  }
}

export function assessQualificationResponse(
  question: QualificationQuestion,
  message: string
): QualificationAssessment | null {
  const normalized = normalizeText(message);
  const binaryIntent = detectBinaryIntent(message);

  switch (question) {
    case 'investor_profile': {
      const location = extractLocation(message);
      const isDiaspora =
        normalized.includes('diaspora') ||
        includesAny(normalized, DIASPORA_LOCATION_KEYWORDS);
      const isNigeriaBased = includesAny(normalized, NIGERIA_LOCATION_KEYWORDS);
      const isHni =
        normalized.includes('hni') || normalized.includes('high net worth');

      if (isDiaspora) {
        return {
          question,
          matched: true,
          passed: true,
          location,
          summary: location
            ? `Diaspora investor based in ${location}.`
            : 'Diaspora investor confirmed.',
        };
      }

      if (isNigeriaBased && isHni) {
        return {
          question,
          matched: true,
          passed: true,
          location: location || 'Nigeria',
          summary: 'Verified local HNI profile confirmed.',
        };
      }

      if (
        normalized.includes('not diaspora') ||
        normalized.includes('not hni') ||
        normalized.includes('not a hni')
      ) {
        return {
          question,
          matched: true,
          passed: false,
          reason: getDisqualificationReason(question),
          summary: 'Investor profile does not meet eligibility requirements.',
        };
      }

      return null;
    }

    case 'investment_horizon': {
      const years = parseDurationInYears(message);

      if (binaryIntent === 'no' || (years !== null && years < 5)) {
        return {
          question,
          matched: true,
          passed: false,
          reason: getDisqualificationReason(question),
          summary: 'Investor is not comfortable with the minimum 5-year horizon.',
        };
      }

      if (
        binaryIntent === 'yes' ||
        normalized.includes('long term') ||
        (years !== null && years >= 5)
      ) {
        return {
          question,
          matched: true,
          passed: true,
          summary: 'Investor is comfortable with a 5-year or longer horizon.',
        };
      }

      return null;
    }

    case 'ticket_size': {
      const money = parseMoneyValue(message);

      if (binaryIntent === 'no') {
        return {
          question,
          matched: true,
          passed: false,
          reason: getDisqualificationReason(question),
          summary: 'Investor is not comfortable with the minimum ticket size.',
        };
      }

      if (money) {
        const passes =
          (money.currency === 'NGN' && money.amount >= 5_000_000) ||
          (money.currency === 'USD' && money.amount >= 3_300);

        return {
          question,
          matched: true,
          passed: passes,
          reason: passes ? undefined : getDisqualificationReason(question),
          summary: passes
            ? 'Investor can meet the minimum ticket size.'
            : 'Investor cannot meet the minimum ticket size.',
        };
      }

      if (binaryIntent === 'yes') {
        return {
          question,
          matched: true,
          passed: true,
          summary: 'Investor confirmed willingness to meet the minimum ticket size.',
        };
      }

      return null;
    }

    case 'kyc_willingness': {
      if (binaryIntent === 'no') {
        return {
          question,
          matched: true,
          passed: false,
          reason: getDisqualificationReason(question),
          summary: 'Investor is not willing to complete KYC.',
        };
      }

      if (
        binaryIntent === 'yes' ||
        normalized.includes('kyc') ||
        normalized.includes('documents') ||
        normalized.includes('compliance')
      ) {
        return {
          question,
          matched: true,
          passed: true,
          summary: 'Investor is willing to proceed with KYC compliance.',
        };
      }

      return null;
    }
  }
}

export function detectFutureInterestRequest(message: string): boolean {
  const normalized = normalizeText(message);

  return [
    'note my interest',
    'notify me',
    'keep me posted',
    'reach out',
    'let me know',
    'future opportunit',
    'shorter horizon',
    'more flexible',
    'something aligned',
    'when something else',
  ].some((term) => normalized.includes(term));
}

export function buildFutureInterestNote(
  message: string,
  failedQuestion?: QualificationQuestion
): string {
  const normalized = normalizeText(message);

  if (
    failedQuestion === 'investment_horizon' ||
    normalized.includes('shorter') ||
    normalized.includes('more flexible')
  ) {
    return 'Requested to be notified about future opportunities with shorter or more flexible holding periods.';
  }

  return 'Requested to be notified about future opportunities that may be a better fit.';
}

export function summarizeQualificationAnswer(
  question: string,
  answer: string,
  passed: number
): string | null {
  if (!QUALIFICATION_SEQUENCE.includes(question as QualificationQuestion)) {
    return null;
  }

  const assessment = assessQualificationResponse(
    question as QualificationQuestion,
    answer
  );

  if (assessment) {
    return assessment.summary;
  }

  if (question === 'investment_horizon' && passed === 0) {
    return 'Investor is not comfortable with the minimum 5-year horizon.';
  }

  if (question === 'ticket_size' && passed === 0) {
    return 'Investor cannot meet the minimum ticket size.';
  }

  if (question === 'kyc_willingness' && passed === 0) {
    return 'Investor is not willing to complete KYC.';
  }

  return answer;
}
