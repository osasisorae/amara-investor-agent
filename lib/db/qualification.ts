import { nanoid } from 'nanoid';
import { execute, query } from './client';

export interface QualificationAnswer {
  id: string;
  lead_id: string;
  question: string;
  answer: string;
  passed: number;
  created_at: number;
}

export async function saveQualificationAnswer(data: {
  leadId: string;
  question: string;
  answer: string;
  passed: boolean;
}): Promise<void> {
  const id = nanoid();
  const now = Math.floor(Date.now() / 1000);

  await execute(
    `INSERT INTO qualification_answers (id, lead_id, question, answer, passed, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, data.leadId, data.question, data.answer, data.passed ? 1 : 0, now]
  );
}

export async function getQualificationAnswers(
  leadId: string
): Promise<QualificationAnswer[]> {
  return query<QualificationAnswer>(
    'SELECT * FROM qualification_answers WHERE lead_id = ? ORDER BY created_at ASC',
    [leadId]
  );
}

export async function hasPassedQualification(leadId: string): Promise<boolean> {
  const answers = await getQualificationAnswers(leadId);
  
  // Must have at least 4 answers (one for each qualification criterion)
  if (answers.length < 4) {
    return false;
  }

  // All answers must pass
  return answers.every((answer) => answer.passed === 1);
}
