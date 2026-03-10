const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-latest';

type AnthropicTextBlock = {
  type: 'text';
  text: string;
};

type AnthropicToolUseBlock = {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
};

type AnthropicContentBlock = AnthropicTextBlock | AnthropicToolUseBlock;

type AnthropicResponse = {
  id: string;
  type: 'message';
  role: 'assistant';
  content: AnthropicContentBlock[];
  stop_reason: 'end_turn' | 'max_tokens' | 'tool_use' | 'stop_sequence' | null;
};

export type ClaudeMessage = {
  role: 'user' | 'assistant';
  content:
    | string
    | Array<
        | { type: 'text'; text: string }
        | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean }
        | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
      >;
};

export type ClaudeToolDefinition = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
};

export type ClaudeRequest = {
  system: string;
  messages: ClaudeMessage[];
  tools?: ClaudeToolDefinition[];
  max_tokens?: number;
  temperature?: number;
};

function getApiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }
  return key;
}

export async function createClaudeMessage(request: ClaudeRequest): Promise<AnthropicResponse> {
  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': getApiKey(),
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      max_tokens: request.max_tokens ?? 1200,
      temperature: request.temperature ?? 0.2,
      system: request.system,
      messages: request.messages,
      tools: request.tools,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic API error (${response.status}): ${errorText}`);
  }

  return (await response.json()) as AnthropicResponse;
}
