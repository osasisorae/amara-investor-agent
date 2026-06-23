import type { Message } from '@/lib/db/messages';
import {
  AgentMessageType,
  parseUIComponentMetadata,
  type UIComponentMetadata,
} from './components';

export interface ChatMessage {
  id: string;
  role: 'agent' | 'investor';
  text: string;
  type: AgentMessageType;
  metadata?: UIComponentMetadata;
  createdAt: number;
}

export function toChatMessage(message: Message): ChatMessage {
  const metadata = parseUIComponentMetadata(message.metadata);

  return {
    id: message.id,
    role: message.role,
    text: message.content,
    type: message.role === 'agent' && metadata ? metadata.component : 'text',
    metadata: metadata || undefined,
    createdAt: message.created_at,
  };
}

export function toChatMessages(messages: Message[]): ChatMessage[] {
  return messages.map(toChatMessage);
}
