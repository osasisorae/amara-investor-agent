import { nanoid } from 'nanoid';
import { execute, query } from './client';

export interface Message {
  id: string;
  lead_id: string;
  role: 'agent' | 'investor';
  content: string;
  metadata?: string;
  created_at: number;
}

export async function saveMessage(data: {
  leadId: string;
  role: 'agent' | 'investor';
  content: string;
  metadata?: Record<string, unknown>;
}): Promise<Message> {
  const id = nanoid();
  const now = Math.floor(Date.now() / 1000);
  const metadataJson = data.metadata ? JSON.stringify(data.metadata) : null;

  await execute(
    `INSERT INTO messages (id, lead_id, role, content, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, data.leadId, data.role, data.content, metadataJson, now]
  );

  return {
    id,
    lead_id: data.leadId,
    role: data.role,
    content: data.content,
    metadata: metadataJson || undefined,
    created_at: now,
  };
}

export async function getMessagesByLeadId(leadId: string): Promise<Message[]> {
  return query<Message>(
    'SELECT * FROM messages WHERE lead_id = ? ORDER BY created_at ASC',
    [leadId]
  );
}

export async function getConversationHistory(
  leadId: string
): Promise<Array<{ role: 'assistant' | 'user'; content: string }>> {
  const messages = await getMessagesByLeadId(leadId);
  return messages.map((msg) => ({
    role: msg.role === 'agent' ? ('assistant' as const) : ('user' as const),
    content: msg.content,
  }));
}
