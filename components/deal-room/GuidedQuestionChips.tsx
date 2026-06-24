'use client';

import type { GuidedQuestionsComponentData } from '@/lib/chat/components';

interface GuidedQuestionChipsProps {
  data?: GuidedQuestionsComponentData;
  disabled?: boolean;
  onSelect: (question: string) => void;
}

export function GuidedQuestionChips({
  data,
  disabled = false,
  onSelect,
}: GuidedQuestionChipsProps) {
  const questions = Array.isArray(data?.questions) ? data.questions : [];

  if (!questions.length) {
    return (
      <div className="rounded-2xl border border-futurex-line bg-futurex-surface2 px-4 py-3 text-sm text-futurex-muted">
        No guided questions are available yet.
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {questions.map((question) => (
        <button
          key={question}
          type="button"
          onClick={() => onSelect(question)}
          disabled={disabled}
          className="rounded-full border border-futurex-line bg-futurex-surface2 px-4 py-2 text-left text-sm text-futurex-ink transition hover:border-futurex-gold hover:text-futurex-gold disabled:cursor-not-allowed disabled:opacity-50"
        >
          {question}
        </button>
      ))}
    </div>
  );
}
