// Chat module exports
export { default as ChatPanel } from './ChatPanel.vue';
export type { ChatMessage, ToolCall, Source, OpenRouterModel, ToolDefinition, AgentConfig, UserSettings } from './types';
export { DEFAULT_SETTINGS } from './types';
export { TOOL_COMPATIBLE_MODELS, DEFAULT_MODEL } from './models';
export { TOOL_DEFINITIONS, getOpenRouterTools, executeTool, AGENT_SYSTEM_PROMPT, CODEBASE_MAP, getAugmentationContext } from './tools';
export { runAgent, generateId } from './agent';
export { saveSecure, loadSecure, removeSecure, saveSettings, loadSettings } from './storage';
