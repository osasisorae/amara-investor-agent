import type { Message } from '@/lib/db/messages';
import {
  AgentMessageType,
  parseUIComponentMetadata,
} from './components';

export interface ChatMessage {
  id: string;
  role: 'agent' | 'investor';
  text: string;
  type: AgentMessageType;
  metadata?: Record<string, unknown>;
  createdAt: number;
}

function parseMessageMetadata(
  value: unknown
): Record<string, unknown> | undefined {
  if (!value) {
    return undefined;
  }

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

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return undefined;
  }

  return parsed as Record<string, unknown>;
}

export function toChatMessage(message: Message): ChatMessage {
  const metadata = parseMessageMetadata(message.metadata);
  const componentMetadata = metadata
    ? parseUIComponentMetadata(metadata)
    : null;

  return {
    id: message.id,
    role: message.role,
    text: message.content,
    type:
      message.role === 'agent' && componentMetadata
        ? componentMetadata.component
        : 'text',
    metadata,
    createdAt: message.created_at,
  };
}

export function toChatMessages(messages: Message[]): ChatMessage[] {
  return messages.map(toChatMessage);
}
