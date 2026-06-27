import { humanizeKycDocumentType } from './requirements';

export type KycPrimaryDocumentType =
  | 'passport'
  | 'national_id'
  | 'drivers_licence';

export type KycUploadSlot =
  | 'document_front'
  | 'document_back'
  | 'proof_of_address';

export interface KycDocumentOption {
  value: KycPrimaryDocumentType;
  label: string;
}

export interface KycUploadSlotDefinition {
  key: KycUploadSlot;
  label: string;
  required: boolean;
}

export const KYC_DOCUMENT_OPTIONS: KycDocumentOption[] = [
  {
    value: 'passport',
    label: 'International Passport',
  },
  {
    value: 'national_id',
    label: 'National ID Card',
  },
  {
    value: 'drivers_licence',
    label: "Driver's Licence",
  },
];

export const KYC_PERSONAL_DETAIL_FIELDS = [
  'full_legal_name',
  'date_of_birth',
  'nationality',
  'country_of_residence',
  'phone_number',
] as const;

export type KycPersonalDetailField =
  (typeof KYC_PERSONAL_DETAIL_FIELDS)[number];

function normalizeValue(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function getKycDocumentLabel(
  documentType: KycPrimaryDocumentType
): string {
  return (
    KYC_DOCUMENT_OPTIONS.find((option) => option.value === documentType)?.label ||
    'Identity document'
  );
}

export function normalizeKycDocumentType(
  value: string
): KycPrimaryDocumentType | null {
  const normalized = normalizeValue(value);

  if (
    normalized === 'passport' ||
    normalized.includes('international passport')
  ) {
    return 'passport';
  }

  if (
    normalized === 'national id' ||
    normalized === 'national id card' ||
    normalized.includes('national id')
  ) {
    return 'national_id';
  }

  if (
    normalized === 'drivers licence' ||
    normalized === 'driver s licence' ||
    normalized === 'drivers license' ||
    normalized === 'driver s license' ||
    normalized.includes('driver')
  ) {
    return 'drivers_licence';
  }

  return null;
}

export function parseKycDocumentTypeFromMessage(
  message: string
): KycPrimaryDocumentType | null {
  return normalizeKycDocumentType(message);
}

export function getKycUploadSlots(
  documentType: KycPrimaryDocumentType
): KycUploadSlotDefinition[] {
  const slots: KycUploadSlotDefinition[] = [
    {
      key: 'document_front',
      label: 'Document front',
      required: true,
    },
  ];

  if (documentType !== 'passport') {
    slots.push({
      key: 'document_back',
      label: 'Document back',
      required: true,
    });
  }

  slots.push(
    {
      key: 'proof_of_address',
      label: 'Utility bill or bank statement (dated within 3 months)',
      required: true,
    }
  );

  return slots;
}

export function buildStoredKycDocType(
  documentType: KycPrimaryDocumentType,
  slot: KycUploadSlot
): string {
  if (slot === 'document_front') {
    return `${documentType}_front`;
  }

  if (slot === 'document_back') {
    return `${documentType}_back`;
  }

  return slot;
}

export function getRequiredStoredKycDocTypes(
  documentType: KycPrimaryDocumentType
): string[] {
  return getKycUploadSlots(documentType)
    .filter((slot) => slot.required)
    .map((slot) => buildStoredKycDocType(documentType, slot.key));
}

export function detectDocumentTypeFromStoredDocTypes(
  docTypes: string[]
): KycPrimaryDocumentType | null {
  const normalized = new Set(docTypes.map((docType) => normalizeValue(docType)));

  if ([...normalized].some((docType) => docType.startsWith('passport '))) {
    return 'passport';
  }

  if ([...normalized].some((docType) => docType.startsWith('national id '))) {
    return 'national_id';
  }

  if (
    [...normalized].some(
      (docType) =>
        docType.startsWith('drivers licence ') ||
        docType.startsWith('drivers license ')
    )
  ) {
    return 'drivers_licence';
  }

  return null;
}

export function humanizeStoredKycDocType(docType: string): string {
  const normalized = normalizeValue(docType);

  switch (normalized) {
    case 'passport front':
      return 'Passport front';
    case 'passport back':
      return 'Passport back';
    case 'national id front':
      return 'National ID front';
    case 'national id back':
      return 'National ID back';
    case 'drivers licence front':
    case 'drivers license front':
      return "Driver's licence front";
    case 'drivers licence back':
    case 'drivers license back':
      return "Driver's licence back";
    case 'proof of address':
      return 'Proof of address';
    default:
      return humanizeKycDocumentType(docType);
  }
}
