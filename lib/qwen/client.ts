if (!process.env.QWEN_API_KEY) {
  throw new Error('QWEN_API_KEY environment variable is required');
}

if (!process.env.QWEN_API_BASE_URL) {
  throw new Error('QWEN_API_BASE_URL environment variable is required');
}

const QWEN_API_KEY = process.env.QWEN_API_KEY;
const QWEN_API_BASE_URL = process.env.QWEN_API_BASE_URL;
const QWEN_MODEL = process.env.QWEN_MODEL || 'qwen-plus';

export interface QwenMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface QwenToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface QwenToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export type QwenConversationMessage =
  | {
      role: 'system' | 'user';
      content: string;
    }
  | {
      role: 'assistant';
      content: string | null;
      tool_calls?: QwenToolCall[];
    }
  | {
      role: 'tool';
      content: string;
      tool_call_id: string;
      name: string;
    };

export type QwenToolChoice =
  | 'auto'
  | 'required'
  | {
      type: 'function';
      function: {
        name: string;
      };
    };

export interface QwenAssistantMessage {
  role: 'assistant';
  content: string | null;
  tool_calls?: QwenToolCall[];
}

interface QwenResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: QwenAssistantMessage;
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

async function requestQwenCompletion(body: Record<string, unknown>) {
  const response = await fetch(`${QWEN_API_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${QWEN_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: QWEN_MODEL,
      ...body,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Qwen API error: ${response.status} - ${errorText}`);
  }

  const data: QwenResponse = await response.json();

  if (!data.choices || data.choices.length === 0) {
    throw new Error('No response from Qwen API');
  }

  return data.choices[0].message;
}

export async function createQwenChatCompletion(params: {
  messages: QwenConversationMessage[];
  tools?: QwenToolDefinition[];
  toolChoice?: QwenToolChoice;
  temperature?: number;
  maxTokens?: number;
}): Promise<QwenAssistantMessage> {
  try {
    return await requestQwenCompletion({
      messages: params.messages,
      tools: params.tools,
      tool_choice: params.toolChoice,
      temperature: params.temperature ?? 0.4,
      max_tokens: params.maxTokens ?? 1500,
    });
  } catch (error) {
    console.error('Qwen API call failed:', error);
    throw error;
  }
}

export async function callQwen(
  messages: QwenMessage[],
  options?: {
    temperature?: number;
    max_tokens?: number;
  }
): Promise<string> {
  const assistantMessage = await createQwenChatCompletion({
    messages,
    temperature: options?.temperature ?? 0.7,
    maxTokens: options?.max_tokens ?? 1500,
  });

  if (!assistantMessage.content) {
    throw new Error('Qwen returned an empty assistant message');
  }

  return assistantMessage.content;
}

export async function callQwenWithSystemPrompt(
  systemPrompt: string,
  userMessage: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []
): Promise<string> {
  const messages: QwenMessage[] = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    })),
    { role: 'user', content: userMessage },
  ];

  return callQwen(messages);
}
