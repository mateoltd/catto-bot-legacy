// Chat types for the research agent

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolCalls?: ToolCall[];
  sources?: Source[];
  timestamp: number;
  isReasoning?: boolean;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  status: 'pending' | 'executing' | 'completed' | 'error';
  result?: string;
  error?: string;
}

export interface Source {
  title: string;
  path: string;
  snippet?: string;
  line?: number;
}

export interface OpenRouterModel {
  id: string;
  name: string;
  provider: string;
  supportsTools: boolean;
  contextLength: number;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
    }>;
    required: string[];
  };
}

export interface AgentConfig {
  model: string;
  apiKey: string;
  maxIterations: number;
}

export interface UserSettings {
  model: string;
  maxSteps: number;
  integrateSearch: boolean;
}

export const DEFAULT_SETTINGS: UserSettings = {
  model: 'anthropic/claude-haiku-4.5',
  maxSteps: 30,
  integrateSearch: false,
};

// Session management types
export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface SessionListItem {
  id: string;
  title: string;
  messageCount: number;
  updatedAt: number;
}
