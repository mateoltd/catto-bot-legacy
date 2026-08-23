// OpenRouter models that support tool/function calling
import type { OpenRouterModel } from './types';

export const TOOL_COMPATIBLE_MODELS: OpenRouterModel[] = [
  {
    id: 'anthropic/claude-haiku-4.5',
    name: 'Claude Haiku 4.5',
    provider: 'Anthropic',
    supportsTools: true,
    contextLength: 200000,
  },
  {
    id: 'google/gemini-3-flash-preview',
    name: 'Gemini 3 Flash',
    provider: 'Google',
    supportsTools: true,
    contextLength: 1000000,
  },
  {
    id: 'openai/gpt-5-mini',
    name: 'GPT-5 Mini',
    provider: 'OpenAI',
    supportsTools: true,
    contextLength: 128000,
  },
];

export const DEFAULT_MODEL = 'anthropic/claude-haiku-4.5';
