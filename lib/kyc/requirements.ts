export const KYC_INVESTOR_PROFILE_FIELDS = [
  'occupation',
  'employer_or_business_name',
  'employer_or_business_address',
  'tax_residency_country',
  'tax_identification_number',
] as const;

export type KycInvestorProfileField =
  (typeof KYC_INVESTOR_PROFILE_FIELDS)[number];

export const KYC_SOURCE_OF_FUNDS_OPTIONS = [
  { value: 'salary', label: 'Salary or employment income' },
  { value: 'business_income', label: 'Business income' },
  { value: 'investment_proceeds', label: 'Investment proceeds' },
  { value: 'property_sale', label: 'Property sale' },
  { value: 'savings', label: 'Savings built over time' },
  { value: 'inheritance', label: 'Inheritance' },
  { value: 'gift', label: 'Gift' },
  { value: 'loan', label: 'Loan' },
  { value: 'crypto_sale', label: 'Crypto liquidation' },
  { value: 'mixed', label: 'Mixed sources' },
] as const;

export type KycSourceOfFundsType =
  (typeof KYC_SOURCE_OF_FUNDS_OPTIONS)[number]['value'];

export const KYC_FUNDING_SOURCE_FIELDS = [
  'source_of_funds_type',
  'source_of_funds_summary',
  'source_of_wealth_summary',
] as const;

export type KycFundingSourceField =
  (typeof KYC_FUNDING_SOURCE_FIELDS)[number];

export const KYC_MINIMUM_REQUIRED_ANSWER_FIELDS = [
  'full_legal_name',
  'date_of_birth',
  'nationality',
  'country_of_residence',
  'phone_number',
  'source_of_funds_type',
  'source_of_funds_summary',
  'is_pep',
  'is_pep_associate',
  'uses_third_party_funds',
  'uses_gift_funds',
  'uses_loan_funds',
  'uses_crypto_funds',
  'expected_funding_method',
  'expected_funding_bank_country',
  'expected_funding_account_name',
  'payment_from_own_account',
] as const;

export const KYC_REVIEWER_RECOMMENDED_ANSWER_FIELDS = [
  ...KYC_INVESTOR_PROFILE_FIELDS,
  'source_of_wealth_summary',
] as const;

export const KYC_RISK_DECLARATION_FIELDS = [
  'is_pep',
  'is_pep_associate',
  'uses_third_party_funds',
  'uses_gift_funds',
  'uses_loan_funds',
  'uses_crypto_funds',
] as const;

export type KycRiskDeclarationField =
  (typeof KYC_RISK_DECLARATION_FIELDS)[number];

export const KYC_PAYMENT_ACCOUNT_FIELDS = [
  'expected_funding_method',
  'expected_funding_bank_country',
  'expected_funding_account_name',
  'payment_from_own_account',
] as const;

export type KycPaymentAccountField =
  (typeof KYC_PAYMENT_ACCOUNT_FIELDS)[number];

export const KYC_PAYMENT_METHOD_OPTIONS = [
  { value: 'ngn_bank', label: 'Nigerian Naira bank transfer' },
  { value: 'usd_bank', label: 'US Dollar bank transfer' },
  { value: 'crypto', label: 'Crypto settlement' },
] as const;

export type KycPaymentMethod =
  (typeof KYC_PAYMENT_METHOD_OPTIONS)[number]['value'];

export const KYC_YES_NO_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
] as const;

export type KycYesNoValue = (typeof KYC_YES_NO_OPTIONS)[number]['value'];

export type KycRiskLevel = 'standard' | 'enhanced';

export interface KycRiskDeclarationDefinition {
  key: KycRiskDeclarationField;
  label: string;
  description: string;
}

export const KYC_RISK_DECLARATION_DEFINITIONS: KycRiskDeclarationDefinition[] = [
  {
    key: 'is_pep',
    label: 'Are you a politically exposed person',
    description:
      'This includes current or former senior public officials and similar positions.',
  },
  {
    key: 'is_pep_associate',
    label: 'Are you a family member or close associate of a politically exposed person',
    description:
      'This helps FutureX determine whether enhanced due diligence is required.',
  },
  {
    key: 'uses_third_party_funds',
    label: 'Will any third party send funds on your behalf',
    description:
      'FutureX expects the first payment to come from an account in the investor name unless approved otherwise.',
  },
  {
    key: 'uses_gift_funds',
    label: 'Is any part of this investment funded by a gift',
    description:
      'Gift funded investments require extra evidence about the original donor and transfer path.',
  },
  {
    key: 'uses_loan_funds',
    label: 'Is any part of this investment funded by a loan',
    description:
      'Loan funded investments require documentation on the lender and the loan agreement.',
  },
  {
    key: 'uses_crypto_funds',
    label: 'Is any part of this investment funded through crypto',
    description:
      'Crypto funded investments require wallet, exchange, and off ramp evidence before approval.',
  },
] as const;

export const KYC_ADDITIONAL_DOCUMENT_TYPES = [
  'salary_payslip',
  'salary_bank_statement',
  'employment_letter',
  'business_bank_statement',
  'business_financial_statement',
  'business_registration_document',
  'broker_statement',
  'investment_sale_confirmation',
  'property_sale_agreement',
  'property_completion_statement',
  'property_sale_bank_statement',
  'inheritance_letter',
  'probate_document',
  'inheritance_bank_statement',
  'gift_letter',
  'gift_donor_id',
  'gift_transfer_proof',
  'loan_agreement',
  'loan_disbursement_proof',
  'lender_source_of_funds',
  'crypto_exchange_statement',
  'crypto_wallet_proof',
  'crypto_offramp_bank_statement',
  'funding_account_statement',
] as const;

export type KycAdditionalDocumentType =
  (typeof KYC_ADDITIONAL_DOCUMENT_TYPES)[number];

export interface KycAdditionalDocumentRequirement {
  docType: KycAdditionalDocumentType;
  label: string;
  description: string;
  required: boolean;
}

const KYC_ADDITIONAL_DOCUMENT_LIBRARY: Record<
  KycAdditionalDocumentType,
  Omit<KycAdditionalDocumentRequirement, 'docType' | 'required'>
> = {
  salary_payslip: {
    label: 'Recent payslip',
    description: 'Upload a recent payslip tied to the income funding this investment.',
  },
  salary_bank_statement: {
    label: 'Salary bank statement',
    description:
      'Upload a bank statement showing salary credits landing in your account.',
  },
  employment_letter: {
    label: 'Employment letter or contract',
    description:
      'Upload an employment letter or signed contract if available.',
  },
  business_bank_statement: {
    label: 'Business bank statement',
    description:
      'Upload a recent business bank statement showing the business income source.',
  },
  business_financial_statement: {
    label: 'Business financial statement',
    description:
      'Upload recent management accounts or another financial statement for the business.',
  },
  business_registration_document: {
    label: 'Business registration document',
    description:
      'Upload a company registration or incorporation document if relevant.',
  },
  broker_statement: {
    label: 'Broker statement',
    description:
      'Upload a brokerage or investment statement showing the liquidated asset.',
  },
  investment_sale_confirmation: {
    label: 'Investment sale confirmation',
    description:
      'Upload a trade confirmation or sale confirmation for the proceeds used here.',
  },
  property_sale_agreement: {
    label: 'Property sale agreement',
    description:
      'Upload the agreement tied to the property sale that generated the investment funds.',
  },
  property_completion_statement: {
    label: 'Property completion statement',
    description:
      'Upload the completion statement or closing summary for the property sale.',
  },
  property_sale_bank_statement: {
    label: 'Property sale bank statement',
    description:
      'Upload a bank statement showing the sale proceeds entering your account.',
  },
  inheritance_letter: {
    label: 'Inheritance letter',
    description:
      'Upload the inheritance letter or distribution notice tied to these funds.',
  },
  probate_document: {
    label: 'Probate or estate document',
    description:
      'Upload probate or another estate document if available.',
  },
  inheritance_bank_statement: {
    label: 'Inheritance bank statement',
    description:
      'Upload a bank statement showing the inherited funds received.',
  },
  gift_letter: {
    label: 'Gift letter',
    description:
      'Upload a signed gift letter showing the donor, amount, and relationship.',
  },
  gift_donor_id: {
    label: 'Donor ID',
    description:
      'Upload identity evidence for the donor funding the gift.',
  },
  gift_transfer_proof: {
    label: 'Gift transfer proof',
    description:
      'Upload transfer proof showing how the gifted funds moved to you.',
  },
  loan_agreement: {
    label: 'Loan agreement',
    description:
      'Upload the signed loan agreement funding this investment amount.',
  },
  loan_disbursement_proof: {
    label: 'Loan disbursement proof',
    description:
      'Upload proof that the lender disbursed the loan into your account.',
  },
  lender_source_of_funds: {
    label: 'Lender source of funds evidence',
    description:
      'Upload supporting evidence for the lender if the funds come from a private lender.',
  },
  crypto_exchange_statement: {
    label: 'Crypto exchange statement',
    description:
      'Upload an exchange statement showing the crypto liquidation tied to this investment.',
  },
  crypto_wallet_proof: {
    label: 'Wallet or transaction proof',
    description:
      'Upload wallet screenshots or transaction references linking the asset to you.',
  },
  crypto_offramp_bank_statement: {
    label: 'Off ramp bank statement',
    description:
      'Upload a bank statement showing the crypto proceeds arriving in your named account.',
  },
  funding_account_statement: {
    label: 'Funding account statement',
    description:
      'Upload a statement from the account that will send funds to FutureX.',
  },
};

const KYC_SOURCE_REQUIREMENT_MAP: Record<
  KycSourceOfFundsType,
  KycAdditionalDocumentType[]
> = {
  salary: [
    'salary_payslip',
    'salary_bank_statement',
    'employment_letter',
    'funding_account_statement',
  ],
  business_income: [
    'business_bank_statement',
    'business_financial_statement',
    'business_registration_document',
    'funding_account_statement',
  ],
  investment_proceeds: [
    'broker_statement',
    'investment_sale_confirmation',
    'funding_account_statement',
  ],
  property_sale: [
    'property_sale_agreement',
    'property_completion_statement',
    'property_sale_bank_statement',
    'funding_account_statement',
  ],
  savings: ['salary_bank_statement', 'funding_account_statement'],
  inheritance: [
    'inheritance_letter',
    'inheritance_bank_statement',
    'funding_account_statement',
  ],
  gift: [
    'gift_letter',
    'gift_donor_id',
    'gift_transfer_proof',
    'funding_account_statement',
  ],
  loan: [
    'loan_agreement',
    'loan_disbursement_proof',
    'funding_account_statement',
  ],
  crypto_sale: [
    'crypto_exchange_statement',
    'crypto_wallet_proof',
    'crypto_offramp_bank_statement',
    'funding_account_statement',
  ],
  mixed: ['funding_account_statement'],
};

export function isKycSourceOfFundsType(
  value: string
): value is KycSourceOfFundsType {
  return KYC_SOURCE_OF_FUNDS_OPTIONS.some((option) => option.value === value);
}

export function isKycPaymentMethod(value: string): value is KycPaymentMethod {
  return KYC_PAYMENT_METHOD_OPTIONS.some((option) => option.value === value);
}

export function isKycYesNoValue(value: string): value is KycYesNoValue {
  return KYC_YES_NO_OPTIONS.some((option) => option.value === value);
}

export function isKycAdditionalDocumentType(
  value: string
): value is KycAdditionalDocumentType {
  return (KYC_ADDITIONAL_DOCUMENT_TYPES as readonly string[]).includes(value);
}

export function getKycSourceOfFundsLabel(
  value: KycSourceOfFundsType
): string {
  return (
    KYC_SOURCE_OF_FUNDS_OPTIONS.find((option) => option.value === value)?.label ||
    value.replace(/_/g, ' ')
  );
}

export function getKycPaymentMethodLabel(value: KycPaymentMethod): string {
  return (
    KYC_PAYMENT_METHOD_OPTIONS.find((option) => option.value === value)?.label ||
    value.replace(/_/g, ' ')
  );
}

export function getAdditionalKycDocumentRequirement(
  docType: KycAdditionalDocumentType
): KycAdditionalDocumentRequirement {
  return {
    docType,
    required: false,
    ...KYC_ADDITIONAL_DOCUMENT_LIBRARY[docType],
  };
}

export function getRequiredAdditionalKycDocuments(
  sourceType: KycSourceOfFundsType
): KycAdditionalDocumentRequirement[] {
  return KYC_SOURCE_REQUIREMENT_MAP[sourceType].map(
    getAdditionalKycDocumentRequirement
  );
}

export function getRequiredAdditionalKycDocTypes(
  sourceType: KycSourceOfFundsType
): KycAdditionalDocumentType[] {
  return [...KYC_SOURCE_REQUIREMENT_MAP[sourceType]];
}

export function humanizeKycAnswerField(field: string): string {
  switch (field) {
    case 'full_legal_name':
      return 'full legal name';
    case 'date_of_birth':
      return 'date of birth';
    case 'nationality':
      return 'nationality';
    case 'country_of_residence':
      return 'country of residence';
    case 'phone_number':
      return 'phone number';
    case 'occupation':
      return 'occupation';
    case 'employer_or_business_name':
      return 'employer or business name';
    case 'employer_or_business_address':
      return 'employer or business address';
    case 'tax_residency_country':
      return 'tax residency country';
    case 'tax_identification_number':
      return 'tax identification number';
    case 'source_of_funds_type':
      return 'source of funds type';
    case 'source_of_funds_summary':
      return 'source of funds summary';
    case 'source_of_wealth_summary':
      return 'source of wealth summary';
    case 'is_pep':
      return 'PEP declaration';
    case 'is_pep_associate':
      return 'PEP associate declaration';
    case 'uses_third_party_funds':
      return 'third party funding declaration';
    case 'uses_gift_funds':
      return 'gift funding declaration';
    case 'uses_loan_funds':
      return 'loan funding declaration';
    case 'uses_crypto_funds':
      return 'crypto funding declaration';
    case 'expected_funding_method':
      return 'expected funding method';
    case 'expected_funding_bank_country':
      return 'expected funding bank country';
    case 'expected_funding_account_name':
      return 'expected funding account name';
    case 'payment_from_own_account':
      return 'same name funding account declaration';
    default:
      return field.replace(/_/g, ' ');
  }
}

export function humanizeKycDocumentType(docType: string): string {
  if (isKycAdditionalDocumentType(docType)) {
    return KYC_ADDITIONAL_DOCUMENT_LIBRARY[docType].label;
  }

  return docType.replace(/_/g, ' ');
}

export function getEnhancedDueDiligenceFlags(
  latestAnswers: Record<string, { answer?: string | null }>
): string[] {
  const flags: string[] = [];

  const yes = (field: KycRiskDeclarationField | 'payment_from_own_account') =>
    (latestAnswers[field]?.answer || '').trim().toLowerCase() === 'yes';
  const no = (field: 'payment_from_own_account') =>
    (latestAnswers[field]?.answer || '').trim().toLowerCase() === 'no';

  if (yes('is_pep')) {
    flags.push('politically exposed person');
  }
  if (yes('is_pep_associate')) {
    flags.push('PEP family member or close associate');
  }
  if (yes('uses_third_party_funds')) {
    flags.push('third party funding');
  }
  if (yes('uses_gift_funds')) {
    flags.push('gift funding');
  }
  if (yes('uses_loan_funds')) {
    flags.push('loan funding');
  }
  if (yes('uses_crypto_funds')) {
    flags.push('crypto funding');
  }
  if (no('payment_from_own_account')) {
    flags.push('payment not coming from investor named account');
  }

  const sourceType = (latestAnswers.source_of_funds_type?.answer || '').trim();
  if (sourceType === 'mixed') {
    flags.push('mixed funding sources');
  }

  return flags;
}

export function requiresEnhancedDueDiligence(
  latestAnswers: Record<string, { answer?: string | null }>
): boolean {
  return getEnhancedDueDiligenceFlags(latestAnswers).length > 0;
}

export function getKycRiskLevel(
  latestAnswers: Record<string, { answer?: string | null }>
): KycRiskLevel {
  return requiresEnhancedDueDiligence(latestAnswers)
    ? 'enhanced'
    : 'standard';
}
