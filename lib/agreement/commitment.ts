import { MINIMUM_TICKET_NGN } from '@/lib/agent/qualification';

export const DEFAULT_COMMITMENT_SLOT_COUNT = 1;
export const MAX_COMMITMENT_SLOT_COUNT = 999;
export const AGREEMENT_SLOT_COUNT_QUESTION = 'agreement_slot_count';
export const AGREEMENT_COMMITMENT_AMOUNT_NGN_QUESTION =
  'agreement_commitment_amount_ngn';

export interface CommitmentSelection {
  slotCount: number;
  commitmentAmountNgn: number;
  commitmentLabel: string;
}

export function formatNairaAmount(amount: number): string {
  return `₦${amount.toLocaleString('en-NG')}`;
}

export function isValidSlotCount(value: number): boolean {
  return (
    Number.isInteger(value) &&
    value >= DEFAULT_COMMITMENT_SLOT_COUNT &&
    value <= MAX_COMMITMENT_SLOT_COUNT
  );
}

export function coerceCommitmentSlotCount(value: unknown): number | null {
  const numericValue =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value.trim())
        : NaN;

  if (!isValidSlotCount(numericValue)) {
    return null;
  }

  return numericValue;
}

export function getCommitmentAmountNgn(slotCount: number): number {
  return slotCount * MINIMUM_TICKET_NGN;
}

export function buildCommitmentSelection(slotCount: number): CommitmentSelection {
  const normalizedSlotCount =
    coerceCommitmentSlotCount(slotCount) ?? DEFAULT_COMMITMENT_SLOT_COUNT;
  const commitmentAmountNgn = getCommitmentAmountNgn(normalizedSlotCount);

  return {
    slotCount: normalizedSlotCount,
    commitmentAmountNgn,
    commitmentLabel: formatNairaAmount(commitmentAmountNgn),
  };
}

export function getSlotLabel(slotCount: number): string {
  return `${slotCount} slot${slotCount === 1 ? '' : 's'}`;
}
