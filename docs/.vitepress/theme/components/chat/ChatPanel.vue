<script setup lang="ts">
import { ref, computed, nextTick, onMounted, watch } from 'vue';
import { marked } from 'marked';
import {
  MessageSquare,
  X,
  Send,
  Sparkles,
  Key,
  Loader2,
  ExternalLink,
  Maximize2,
  Minimize2,
  Search,
  FileText,
  FolderTree,
  Quote,
  Code,
  CheckCircle2,
  AlertCircle,
  Settings2,
  Brain,
  Zap,
  ToggleLeft,
  ToggleRight,
  Eye,
  EyeOff,
  Pencil,
  Check,
  XCircle,
  Plus,
  ChevronDown,
  Trash2,
  MessageCircle,
} from 'lucide-vue-next';
import type { ChatMessage, ToolCall, Source, UserSettings, SessionListItem } from './types';
import { DEFAULT_SETTINGS } from './types';
import { TOOL_COMPATIBLE_MODELS, DEFAULT_MODEL } from './models';
import { runAgent, generateId } from './agent';
import {
  saveSecure,
  loadSecure,
  removeSecure,
  saveSettings,
  loadSettings,
  createSession,
  getActiveSession,
  getActiveSessionId,
  setActiveSession,
  updateSessionMessages,
  renameSession,
  deleteSession,
  listSessions,
} from './storage';

// Props
const props = defineProps<{
  currentPage?: string;
  pageTitle?: string;
}>();

// Configure marked for simple rendering
marked.setOptions({
  breaks: true,
  gfm: true,
});

function renderMarkdown(content: string): string {
  try {
    return marked.parse(content) as string;
  } catch {
    return content;
  }
}

// State
const showChat = ref(false);
const isMaximized = ref(false);
const showSettings = ref(false);
const settings = ref<Omit<UserSettings, 'apiKey'>>({
  model: DEFAULT_SETTINGS.model,
  maxSteps: DEFAULT_SETTINGS.maxSteps,
  integrateSearch: DEFAULT_SETTINGS.integrateSearch,
});
const apiKey = ref('');
const messages = ref<ChatMessage[]>([]);
const inputMessage = ref('');
const isLoading = ref(false);
const isReasoning = ref(false);
const currentToolCalls = ref<ToolCall[]>([]);
const chatContainer = ref<HTMLElement | null>(null);
const errorMessage = ref('');
const currentStep = ref(0);

// API Key editing state
const isEditingKey = ref(false);
const tempApiKey = ref('');
const showApiKey = ref(false);

// Session management state
const sessions = ref<SessionListItem[]>([]);
const activeSessionId = ref<string | null>(null);
const showSessionList = ref(false);
const editingSessionId = ref<string | null>(null);
const editingSessionTitle = ref('');

// Computed
const apiKeySet = computed(() => apiKey.value.trim().length > 0);
const maskedApiKey = computed(() => {
  if (!apiKey.value) return '';
  const key = apiKey.value;
  if (key.length <= 8) return '•'.repeat(key.length);
  return key.slice(0, 4) + '•'.repeat(key.length - 8) + key.slice(-4);
});
const currentModelInfo = computed(() =>
  TOOL_COMPATIBLE_MODELS.find(m => m.id === settings.value.model)
);

// Load saved settings on mount
onMounted(() => {
  // Load API key securely
  const savedKey = loadSecure('api_key');
  if (savedKey) {
    apiKey.value = savedKey;

    // Load sessions
    loadSessions();

    // Try to restore active session, or create new one
    const activeSession = getActiveSession();
    if (activeSession) {
      activeSessionId.value = activeSession.id;
      messages.value = activeSession.messages;
    } else {
      // Create a new session with welcome message
      const welcomeMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: 'Ready to research the Catto codebase. I can search documentation, read source files, and explain how features work.',
        timestamp: Date.now(),
      };
      const newSession = createSession(welcomeMessage);
      activeSessionId.value = newSession.id;
      messages.value = newSession.messages;
      loadSessions();
    }
  }

  // Load other settings
  const savedSettings = loadSettings();
  if (savedSettings) {
    settings.value = {
      model: (savedSettings.model as string) || DEFAULT_SETTINGS.model,
      maxSteps: (savedSettings.maxSteps as number) || DEFAULT_SETTINGS.maxSteps,
      integrateSearch: (savedSettings.integrateSearch as boolean) ?? DEFAULT_SETTINGS.integrateSearch,
    };
  }
});

// Save settings when changed (excluding API key)
watch(settings, (newSettings) => {
  saveSettings(newSettings);
}, { deep: true });

// Auto-save messages when they change
watch(messages, (newMessages) => {
  if (activeSessionId.value && newMessages.length > 0) {
    updateSessionMessages(activeSessionId.value, newMessages);
    loadSessions(); // Refresh session list
  }
}, { deep: true });

// Methods
function startEditingKey() {
  tempApiKey.value = apiKey.value;
  isEditingKey.value = true;
  showApiKey.value = false;
}

function saveApiKey() {
  if (tempApiKey.value.trim()) {
    apiKey.value = tempApiKey.value.trim();
    saveSecure('api_key', apiKey.value);
    isEditingKey.value = false;
    showApiKey.value = false;

    if (messages.value.length === 0) {
      messages.value = [{
        id: generateId(),
        role: 'assistant',
        content: 'Connected! Ask me anything about the Catto codebase. I can search docs, read code, and explain implementations.',
        timestamp: Date.now(),
      }];
    }
  }
}

function cancelEditingKey() {
  tempApiKey.value = '';
  isEditingKey.value = false;
  showApiKey.value = false;
}

function clearApiKey() {
  removeSecure('api_key');
  apiKey.value = '';
  tempApiKey.value = '';
  messages.value = [];
  currentToolCalls.value = [];
  errorMessage.value = '';
  currentStep.value = 0;
  isEditingKey.value = false;
}

// Session management methods
function loadSessions() {
  sessions.value = listSessions();
}

function startNewChat() {
  const welcomeMessage: ChatMessage = {
    id: generateId(),
    role: 'assistant',
    content: 'Ready to research the Catto codebase. I can search documentation, read source files, and explain how features work.',
    timestamp: Date.now(),
  };
  const newSession = createSession(welcomeMessage);
  activeSessionId.value = newSession.id;
  messages.value = [...newSession.messages];
  showSessionList.value = false;
  loadSessions();
}

function switchSession(sessionId: string) {
  if (sessionId === activeSessionId.value) {
    showSessionList.value = false;
    return;
  }

  setActiveSession(sessionId);
  const session = getActiveSession();
  if (session) {
    activeSessionId.value = session.id;
    messages.value = [...session.messages];
  }
  showSessionList.value = false;
}

function handleDeleteSession(sessionId: string, event: Event) {
  event.stopPropagation();

  const wasActive = sessionId === activeSessionId.value;
  deleteSession(sessionId);
  loadSessions();

  if (wasActive) {
    // Switch to another session or create new one
    if (sessions.value.length > 0) {
      switchSession(sessions.value[0].id);
    } else {
      startNewChat();
    }
  }
}

function startEditingSession(sessionId: string, title: string, event: Event) {
  event.stopPropagation();
  editingSessionId.value = sessionId;
  editingSessionTitle.value = title;
}

function saveSessionTitle() {
  if (editingSessionId.value && editingSessionTitle.value.trim()) {
    renameSession(editingSessionId.value, editingSessionTitle.value.trim());
    loadSessions();
  }
  editingSessionId.value = null;
  editingSessionTitle.value = '';
}

function cancelEditingSession() {
  editingSessionId.value = null;
  editingSessionTitle.value = '';
}

function formatSessionTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;

  return new Date(timestamp).toLocaleDateString();
}

function getActiveSessionTitle(): string {
  const session = sessions.value.find(s => s.id === activeSessionId.value);
  return session?.title || 'New Chat';
}

function updateModel(modelId: string) {
  settings.value.model = modelId;
}

function toggleMaximize() {
  isMaximized.value = !isMaximized.value;
}

function toggleIntegrateSearch() {
  settings.value.integrateSearch = !settings.value.integrateSearch;
}

async function sendMessage() {
  if (!inputMessage.value.trim() || isLoading.value) return;

  const userMessage: ChatMessage = {
    id: generateId(),
    role: 'user',
    content: inputMessage.value,
    timestamp: Date.now(),
  };

  messages.value.push(userMessage);
  inputMessage.value = '';
  isLoading.value = true;
  isReasoning.value = false;
  currentToolCalls.value = [];
  errorMessage.value = '';
  currentStep.value = 0;

  await nextTick();
  scrollToBottom();

  try {
    const result = await runAgent(
      messages.value,
      {
        model: settings.value.model,
        apiKey: apiKey.value,
        maxIterations: settings.value.maxSteps,
      },
      {
        onToolStart: (toolCall) => {
          currentStep.value++;
          currentToolCalls.value.push({ ...toolCall });
          nextTick(scrollToBottom);
        },
        onToolComplete: (toolCall) => {
          const idx = currentToolCalls.value.findIndex(t => t.id === toolCall.id);
          if (idx !== -1) {
            currentToolCalls.value[idx] = { ...toolCall };
          }
          nextTick(scrollToBottom);
        },
        onSourceAdded: () => {},
        onReasoningStart: () => {
          isReasoning.value = true;
        },
        onReasoningEnd: () => {
          isReasoning.value = false;
        },
      },
      {
        currentPage: props.currentPage,
        pageTitle: props.pageTitle,
      }
    );

    const assistantMessage: ChatMessage = {
      id: generateId(),
      role: 'assistant',
      content: result.content,
      sources: result.sources,
      toolCalls: [...currentToolCalls.value],
      timestamp: Date.now(),
    };

    messages.value.push(assistantMessage);
    currentToolCalls.value = [];
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'An error occurred';
    messages.value.push({
      id: generateId(),
      role: 'assistant',
      content: `Error: ${errorMessage.value}`,
      timestamp: Date.now(),
    });
  }

  isLoading.value = false;
  isReasoning.value = false;
  currentStep.value = 0;
  await nextTick();
  scrollToBottom();
}

function scrollToBottom() {
  if (chatContainer.value) {
    chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

function getToolIcon(toolName: string) {
  switch (toolName) {
    case 'search_docs': return Search;
    case 'read_doc': return FileText;
    case 'list_files': return FolderTree;
    case 'read_file': return Code;
    case 'search_code': return Search;
    case 'cite_source': return Quote;
    default: return Search;
  }
}

function getToolLabel(toolName: string, args: Record<string, unknown>) {
  switch (toolName) {
    case 'search_docs':
      return `Searching docs: "${args.query}"`;
    case 'read_doc':
      return `Reading: ${args.path}`;
    case 'list_files':
      return `Listing: ${args.directory}/`;
    case 'read_file':
      return `Reading: ${args.path}`;
    case 'search_code':
      return `Searching code: "${args.query}"`;
    case 'cite_source':
      return `Citing: ${args.title}`;
    default:
      return toolName;
  }
}
</script>

<template>
  <!-- Toggle Button -->
  <button
    class="chat-toggle"
    @click="showChat = !showChat"
    :class="{ active: showChat }"
    title="Research Agent"
  >
    <MessageSquare v-if="!showChat" :size="20" />
    <X v-else :size="20" />
  </button>

  <!-- Chat Panel -->
  <Transition name="slide">
    <div
      v-if="showChat"
      class="chat-panel"
      :class="{ maximized: isMaximized }"
    >
      <!-- Header -->
      <div class="chat-header">
        <div class="chat-title">
          <Sparkles :size="16" />
          <!-- Session Switcher (when API key is set) -->
          <div v-if="apiKeySet" class="session-switcher">
            <button class="session-toggle" @click="showSessionList = !showSessionList">
              <span class="session-title">{{ getActiveSessionTitle() }}</span>
              <ChevronDown :size="14" :class="{ rotated: showSessionList }" />
            </button>
            <button class="new-chat-btn" @click="startNewChat" title="New Chat">
              <Plus :size="14" />
            </button>

            <!-- Session Dropdown -->
            <Transition name="dropdown">
              <div v-if="showSessionList" class="session-dropdown">
                <div class="session-list">
                  <div
                    v-for="session in sessions"
                    :key="session.id"
                    class="session-item"
                    :class="{ active: session.id === activeSessionId }"
                    @click="switchSession(session.id)"
                  >
                    <MessageCircle :size="14" class="session-icon" />
                    <div class="session-info">
                      <div v-if="editingSessionId === session.id" class="session-edit">
                        <input
                          v-model="editingSessionTitle"
                          @click.stop
                          @keydown.enter="saveSessionTitle"
                          @keydown.escape="cancelEditingSession"
                          @blur="saveSessionTitle"
                          class="session-title-input"
                        />
                      </div>
                      <template v-else>
                        <span class="session-name" @dblclick="startEditingSession(session.id, session.title, $event)">
                          {{ session.title }}
                        </span>
                        <span class="session-meta">
                          {{ session.messageCount }} messages · {{ formatSessionTime(session.updatedAt) }}
                        </span>
                      </template>
                    </div>
                    <button
                      v-if="sessions.length > 1"
                      class="session-delete"
                      @click="handleDeleteSession(session.id, $event)"
                      title="Delete"
                    >
                      <Trash2 :size="12" />
                    </button>
                  </div>
                </div>
              </div>
            </Transition>
          </div>
          <span v-else>Research Agent</span>
          <span v-if="isReasoning" class="reasoning-badge">
            <Brain :size="12" />
            Reasoning
          </span>
          <span v-else-if="isLoading && currentStep > 0" class="step-badge">
            <Zap :size="12" />
            Step {{ currentStep }}
          </span>
        </div>
        <div class="chat-actions">
          <button
            v-if="apiKeySet"
            @click="showSettings = !showSettings"
            class="chat-action"
            :class="{ active: showSettings }"
            title="Settings"
          >
            <Settings2 :size="14" />
          </button>
          <button
            @click="toggleMaximize"
            class="chat-action"
            :title="isMaximized ? 'Minimize' : 'Maximize'"
          >
            <Minimize2 v-if="isMaximized" :size="14" />
            <Maximize2 v-else :size="14" />
          </button>
        </div>
      </div>

      <!-- Settings Sidebar (coexists with chat) -->
      <div class="chat-body" :class="{ 'with-settings': showSettings && apiKeySet }">
        <!-- Settings Panel -->
        <Transition name="slide-left">
          <div v-if="showSettings && apiKeySet" class="settings-sidebar">
            <div class="settings-header">
              <span>Settings</span>
              <button @click="showSettings = false" class="close-settings">
                <X :size="14" />
              </button>
            </div>

            <!-- API Key Section -->
            <div class="settings-section">
              <div class="settings-label">API Key</div>
              <div v-if="!isEditingKey" class="api-key-display">
                <code class="key-value">{{ showApiKey ? apiKey : maskedApiKey }}</code>
                <div class="key-actions">
                  <button @click="showApiKey = !showApiKey" class="key-action" :title="showApiKey ? 'Hide' : 'Show'">
                    <EyeOff v-if="showApiKey" :size="14" />
                    <Eye v-else :size="14" />
                  </button>
                  <button @click="startEditingKey" class="key-action" title="Edit">
                    <Pencil :size="14" />
                  </button>
                  <button @click="clearApiKey" class="key-action danger" title="Remove">
                    <XCircle :size="14" />
                  </button>
                </div>
              </div>
              <div v-else class="api-key-edit">
                <input
                  v-model="tempApiKey"
                  :type="showApiKey ? 'text' : 'password'"
                  placeholder="sk-or-..."
                  @keydown.enter="saveApiKey"
                  @keydown.escape="cancelEditingKey"
                />
                <div class="edit-actions">
                  <button @click="showApiKey = !showApiKey" class="key-action">
                    <EyeOff v-if="showApiKey" :size="14" />
                    <Eye v-else :size="14" />
                  </button>
                  <button @click="saveApiKey" class="key-action success" :disabled="!tempApiKey.trim()">
                    <Check :size="14" />
                  </button>
                  <button @click="cancelEditingKey" class="key-action">
                    <X :size="14" />
                  </button>
                </div>
              </div>
            </div>

            <!-- Model Selection -->
            <div class="settings-section">
              <div class="settings-label">Model</div>
              <div class="model-list">
                <button
                  v-for="model in TOOL_COMPATIBLE_MODELS"
                  :key="model.id"
                  @click="updateModel(model.id)"
                  class="model-option"
                  :class="{ selected: model.id === settings.model }"
                >
                  <span class="model-name">{{ model.name }}</span>
                  <span class="model-provider">{{ model.provider }}</span>
                  <CheckCircle2 v-if="model.id === settings.model" :size="14" class="model-check" />
                </button>
              </div>
            </div>

            <!-- Max Steps -->
            <div class="settings-section">
              <div class="settings-label">
                <span>Max Research Steps</span>
                <span class="value">{{ settings.maxSteps }}</span>
              </div>
              <input
                type="range"
                v-model.number="settings.maxSteps"
                min="5"
                max="50"
                step="5"
                class="range-input"
              />
              <div class="range-labels">
                <span>5</span>
                <span>50</span>
              </div>
            </div>

            <!-- Integrate Search Toggle -->
            <div class="settings-section">
              <button class="toggle-option" @click="toggleIntegrateSearch">
                <div class="toggle-info">
                  <span class="toggle-label">Integrate Site Search</span>
                  <span class="toggle-desc">Use docs search as context</span>
                </div>
                <component
                  :is="settings.integrateSearch ? ToggleRight : ToggleLeft"
                  :size="24"
                  :class="{ 'toggle-on': settings.integrateSearch }"
                />
              </button>
            </div>
          </div>
        </Transition>

        <!-- Main Chat Area -->
        <div class="chat-main">
          <!-- API Key Setup (when not set) -->
          <div v-if="!apiKeySet" class="api-key-setup">
            <div class="setup-content">
              <div class="setup-icon">
                <Key :size="32" />
              </div>
              <h3>Connect to OpenRouter</h3>
              <p>Enter your API key to research the codebase with AI. This is a read-only agent.</p>
              <div class="setup-form">
                <input
                  v-model="tempApiKey"
                  :type="showApiKey ? 'text' : 'password'"
                  placeholder="sk-or-..."
                  @keydown.enter="saveApiKey"
                />
                <button @click="showApiKey = !showApiKey" class="toggle-visibility">
                  <EyeOff v-if="showApiKey" :size="16" />
                  <Eye v-else :size="16" />
                </button>
                <button @click="saveApiKey" class="connect-btn" :disabled="!tempApiKey.trim()">
                  Connect
                </button>
              </div>
              <a href="https://openrouter.ai/keys" target="_blank" class="key-link">
                Get an API key <ExternalLink :size="12" />
              </a>
            </div>
          </div>

          <!-- Chat Messages -->
          <div v-else class="chat-messages" ref="chatContainer">
            <div
              v-for="msg in messages"
              :key="msg.id"
              class="chat-message"
              :class="msg.role"
            >
              <!-- Tool Calls Display -->
              <div v-if="msg.toolCalls?.length" class="tool-calls">
                <div
                  v-for="tool in msg.toolCalls"
                  :key="tool.id"
                  class="tool-call"
                  :class="tool.status"
                >
                  <component :is="getToolIcon(tool.name)" :size="14" />
                  <span class="tool-label">{{ getToolLabel(tool.name, tool.arguments) }}</span>
                  <CheckCircle2 v-if="tool.status === 'completed'" :size="12" class="tool-status" />
                  <AlertCircle v-else-if="tool.status === 'error'" :size="12" class="tool-status error" />
                </div>
              </div>

              <!-- Message Content -->
              <div class="message-content" v-html="renderMarkdown(msg.content)"></div>

              <!-- Sources -->
              <div v-if="msg.sources?.length" class="message-sources">
                <span class="sources-label">Sources:</span>
                <a
                  v-for="source in msg.sources"
                  :key="source.path"
                  :href="source.path.startsWith('/') ? source.path : `/${source.path}`"
                  class="source-link"
                  :class="{ 'code-source': !source.path.startsWith('/') }"
                >
                  {{ source.title }}
                </a>
              </div>
            </div>

            <!-- Active Tool Calls -->
            <div v-if="currentToolCalls.length > 0" class="chat-message assistant">
              <div class="tool-calls active">
                <div
                  v-for="tool in currentToolCalls"
                  :key="tool.id"
                  class="tool-call"
                  :class="tool.status"
                >
                  <Loader2 v-if="tool.status === 'executing'" :size="14" class="spin" />
                  <component v-else :is="getToolIcon(tool.name)" :size="14" />
                  <span class="tool-label">{{ getToolLabel(tool.name, tool.arguments) }}</span>
                  <CheckCircle2 v-if="tool.status === 'completed'" :size="12" class="tool-status" />
                </div>
              </div>
            </div>

            <!-- Reasoning Indicator -->
            <div v-if="isReasoning && currentToolCalls.length === 0" class="chat-message assistant">
              <div class="message-content reasoning">
                <Brain :size="16" class="pulse" />
                <span>Reasoning...</span>
              </div>
            </div>

            <!-- Loading Indicator -->
            <div v-else-if="isLoading && currentToolCalls.length === 0 && !isReasoning" class="chat-message assistant">
              <div class="message-content loading">
                <Loader2 :size="16" class="spin" />
                <span>Thinking...</span>
              </div>
            </div>
          </div>

          <!-- Chat Input -->
          <div v-if="apiKeySet" class="chat-input">
            <input
              v-model="inputMessage"
              placeholder="Ask about commands, architecture, modules..."
              @keydown="handleKeydown"
              :disabled="isLoading"
            />
            <button @click="sendMessage" :disabled="isLoading || !inputMessage.trim()">
              <Send :size="16" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.chat-toggle {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  width: 50px;
  height: 50px;
  background: #fff;
  color: #000;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  z-index: 1000;
}

.chat-toggle:hover {
  transform: scale(1.05);
}

.chat-toggle.active {
  background: #222;
  color: #fff;
}

/* Chat Panel */
.chat-panel {
  position: fixed;
  bottom: 6rem;
  right: 2rem;
  width: 480px;
  height: 600px;
  background: #0a0a0a;
  border: 1px solid #222;
  display: flex;
  flex-direction: column;
  z-index: 1000;
  transition: all 0.3s ease;
}

.chat-panel.maximized {
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100%;
  height: 100%;
  border: none;
}

@media (max-width: 520px) {
  .chat-panel {
    left: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    height: 85vh;
    border-left: none;
    border-right: none;
    border-bottom: none;
  }
}

/* Header */
.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #222;
  background: #0a0a0a;
  flex-shrink: 0;
}

.chat-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #fff;
  flex: 1;
  min-width: 0;
}

/* Session Switcher */
.session-switcher {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  position: relative;
}

.session-toggle {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.3rem 0.5rem;
  background: transparent;
  border: 1px solid transparent;
  color: #fff;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.7rem;
  cursor: pointer;
  transition: all 0.15s ease;
  max-width: 180px;
}

.session-toggle:hover {
  border-color: #333;
  background: #111;
}

.session-title {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-transform: none;
  letter-spacing: normal;
}

.session-toggle svg {
  flex-shrink: 0;
  transition: transform 0.2s ease;
}

.session-toggle svg.rotated {
  transform: rotate(180deg);
}

.new-chat-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.3rem;
  background: transparent;
  border: 1px solid transparent;
  color: #666;
  cursor: pointer;
  transition: all 0.15s ease;
}

.new-chat-btn:hover {
  color: #fff;
  border-color: #333;
  background: #111;
}

/* Session Dropdown */
.session-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 0.25rem;
  background: #111;
  border: 1px solid #333;
  min-width: 280px;
  max-height: 320px;
  overflow-y: auto;
  z-index: 100;
}

.session-list {
  display: flex;
  flex-direction: column;
}

.session-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 0.75rem;
  cursor: pointer;
  transition: all 0.15s ease;
  border-bottom: 1px solid #1a1a1a;
}

.session-item:last-child {
  border-bottom: none;
}

.session-item:hover {
  background: #1a1a1a;
}

.session-item.active {
  background: #1a1a1a;
  border-left: 2px solid #fff;
}

.session-icon {
  color: #555;
  flex-shrink: 0;
}

.session-item.active .session-icon {
  color: #888;
}

.session-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.session-name {
  font-size: 0.75rem;
  color: #ccc;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-transform: none;
  letter-spacing: normal;
}

.session-item.active .session-name {
  color: #fff;
}

.session-meta {
  font-size: 0.6rem;
  color: #555;
  text-transform: none;
  letter-spacing: normal;
}

.session-edit {
  flex: 1;
}

.session-title-input {
  width: 100%;
  padding: 0.2rem 0.3rem;
  background: #0a0a0a;
  border: 1px solid #444;
  color: #fff;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.7rem;
}

.session-delete {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.25rem;
  background: transparent;
  border: none;
  color: #444;
  cursor: pointer;
  opacity: 0;
  transition: all 0.15s ease;
}

.session-item:hover .session-delete {
  opacity: 1;
}

.session-delete:hover {
  color: #ff6b6b;
}

/* Dropdown animation */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.15s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.reasoning-badge,
.step-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.2rem 0.5rem;
  background: #1a1a1a;
  border: 1px solid #333;
  font-size: 0.65rem;
  color: #888;
  margin-left: 0.5rem;
}

.reasoning-badge {
  border-color: #444;
  color: #aaa;
}

.chat-actions {
  display: flex;
  gap: 0.25rem;
}

.chat-action {
  padding: 0.4rem;
  background: transparent;
  border: 1px solid transparent;
  color: #666;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.chat-action:hover {
  color: #fff;
  border-color: #333;
}

.chat-action.active {
  color: #fff;
  background: #222;
}

/* Chat Body - contains settings sidebar and main chat */
.chat-body {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.chat-body.with-settings .chat-main {
  border-left: 1px solid #222;
}

/* Settings Sidebar */
.settings-sidebar {
  width: 220px;
  flex-shrink: 0;
  background: #111;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem;
  border-bottom: 1px solid #222;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #888;
}

.close-settings {
  padding: 0.25rem;
  background: transparent;
  border: none;
  color: #666;
  cursor: pointer;
  display: flex;
}

.close-settings:hover {
  color: #fff;
}

.settings-section {
  padding: 0.75rem;
  border-bottom: 1px solid #1a1a1a;
}

.settings-label {
  display: flex;
  justify-content: space-between;
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #555;
  margin-bottom: 0.5rem;
}

.settings-label .value {
  color: #888;
}

/* API Key Display */
.api-key-display {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.key-value {
  flex: 1;
  font-size: 0.7rem;
  color: #666;
  background: #0a0a0a;
  padding: 0.4rem 0.5rem;
  border: 1px solid #1a1a1a;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.key-actions,
.edit-actions {
  display: flex;
  gap: 2px;
}

.key-action {
  padding: 0.35rem;
  background: #0a0a0a;
  border: 1px solid #222;
  color: #666;
  cursor: pointer;
  display: flex;
  transition: all 0.15s ease;
}

.key-action:hover {
  color: #fff;
  border-color: #444;
}

.key-action.danger:hover {
  color: #ff6b6b;
  border-color: #442222;
}

.key-action.success {
  color: #6bff6b;
}

.key-action.success:disabled {
  color: #333;
  cursor: not-allowed;
}

/* API Key Edit */
.api-key-edit {
  display: flex;
  gap: 0.5rem;
}

.api-key-edit input {
  flex: 1;
  min-width: 0;
  padding: 0.4rem 0.5rem;
  background: #0a0a0a;
  border: 1px solid #333;
  color: #fff;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.7rem;
}

/* Model List */
.model-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.model-option {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.5rem;
  background: #0a0a0a;
  border: 1px solid #1a1a1a;
  color: #888;
  font-size: 0.75rem;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;
}

.model-option:hover {
  border-color: #333;
  color: #fff;
}

.model-option.selected {
  border-color: #444;
  background: #1a1a1a;
  color: #fff;
}

.model-name {
  flex: 1;
  font-size: 0.7rem;
}

.model-provider {
  font-size: 0.6rem;
  color: #555;
  text-transform: uppercase;
}

.model-check {
  color: #fff;
  flex-shrink: 0;
}

/* Range Input */
.range-input {
  width: 100%;
  height: 4px;
  background: #222;
  border-radius: 0;
  outline: none;
  -webkit-appearance: none;
  appearance: none;
}

.range-input::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 12px;
  height: 12px;
  background: #fff;
  cursor: pointer;
}

.range-labels {
  display: flex;
  justify-content: space-between;
  font-size: 0.6rem;
  color: #444;
  margin-top: 0.25rem;
}

/* Toggle Option */
.toggle-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0.5rem;
  background: #0a0a0a;
  border: 1px solid #1a1a1a;
  color: #888;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;
}

.toggle-option:hover {
  border-color: #333;
}

.toggle-info {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.toggle-label {
  font-size: 0.75rem;
  color: #ccc;
}

.toggle-desc {
  font-size: 0.65rem;
  color: #555;
}

.toggle-on {
  color: #fff;
}

/* Chat Main Area */
.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}

/* API Key Setup Screen */
.api-key-setup {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.setup-content {
  text-align: center;
  max-width: 280px;
}

.setup-icon {
  color: #444;
  margin-bottom: 1rem;
}

.setup-content h3 {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.9rem;
  font-weight: 600;
  color: #fff;
  margin: 0 0 0.5rem;
}

.setup-content p {
  font-size: 0.8rem;
  color: #555;
  line-height: 1.5;
  margin: 0 0 1.25rem;
}

.setup-form {
  display: flex;
  gap: 0.5rem;
}

.setup-form input {
  flex: 1;
  min-width: 0;
  padding: 0.75rem;
  background: #111;
  border: 1px solid #222;
  color: #fff;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.8rem;
}

.setup-form input::placeholder {
  color: #444;
}

.toggle-visibility {
  padding: 0.75rem;
  background: #111;
  border: 1px solid #222;
  color: #666;
  cursor: pointer;
  display: flex;
  align-items: center;
  transition: all 0.15s ease;
}

.toggle-visibility:hover {
  color: #fff;
  border-color: #444;
}

.connect-btn {
  padding: 0.75rem 1rem;
  background: #fff;
  color: #000;
  border: none;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 0.15s ease;
}

.connect-btn:hover:not(:disabled) {
  background: #e5e5e5;
}

.connect-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.key-link {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  margin-top: 1rem;
  font-size: 0.75rem;
  color: #555;
  text-decoration: none;
  transition: color 0.15s ease;
}

.key-link:hover {
  color: #fff;
}

/* Chat Messages */
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.chat-message {
  max-width: 95%;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.chat-message.user {
  align-self: flex-end;
}

.chat-message.assistant {
  align-self: flex-start;
}

/* Tool Calls Display */
.tool-calls {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.tool-calls.active {
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

.tool-call {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0.6rem;
  background: #111;
  border: 1px solid #222;
  font-size: 0.7rem;
  color: #888;
  font-family: 'JetBrains Mono', monospace;
}

.tool-call.executing {
  border-color: #333;
  color: #aaa;
}

.tool-call.completed {
  border-color: #2a2a2a;
  color: #666;
}

.tool-call.error {
  border-color: #442222;
  color: #aa6666;
}

.tool-label {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 280px;
}

.tool-status {
  flex-shrink: 0;
  color: #555;
}

.tool-status.error {
  color: #aa6666;
}

/* Message Content */
.message-content {
  padding: 0.75rem 1rem;
  font-size: 0.85rem;
  line-height: 1.6;
  word-break: break-word;
}

.chat-message.user .message-content {
  background: #fff;
  color: #000;
}

.chat-message.assistant .message-content {
  background: #111;
  border: 1px solid #222;
  color: #ccc;
}

/* Markdown rendered content */
.message-content :deep(p) {
  margin: 0 0 0.75em;
}

.message-content :deep(p:last-child) {
  margin-bottom: 0;
}

.message-content :deep(code) {
  background: #1a1a1a;
  padding: 0.15em 0.35em;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.85em;
  border: 1px solid #2a2a2a;
}

.chat-message.user .message-content :deep(code) {
  background: #f0f0f0;
  border-color: #ddd;
}

.message-content :deep(pre) {
  background: #0a0a0a;
  border: 1px solid #222;
  padding: 0.75rem;
  margin: 0.75em 0;
  overflow-x: auto;
}

.message-content :deep(pre code) {
  background: none;
  border: none;
  padding: 0;
  font-size: 0.8em;
}

.message-content :deep(ul),
.message-content :deep(ol) {
  margin: 0.5em 0;
  padding-left: 1.5em;
}

.message-content :deep(li) {
  margin: 0.25em 0;
}

.message-content :deep(strong) {
  font-weight: 600;
  color: #fff;
}

.chat-message.user .message-content :deep(strong) {
  color: #000;
}

.message-content :deep(a) {
  color: #888;
  text-decoration: underline;
}

.message-content :deep(a:hover) {
  color: #fff;
}

.message-content :deep(blockquote) {
  margin: 0.75em 0;
  padding-left: 1em;
  border-left: 2px solid #333;
  color: #888;
}

.message-content :deep(h1),
.message-content :deep(h2),
.message-content :deep(h3),
.message-content :deep(h4) {
  margin: 1em 0 0.5em;
  font-weight: 600;
  color: #fff;
}

.message-content :deep(h1) { font-size: 1.1em; }
.message-content :deep(h2) { font-size: 1em; }
.message-content :deep(h3) { font-size: 0.95em; }

.message-content.loading,
.message-content.reasoning {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #555;
}

.message-content.reasoning {
  color: #888;
}

/* Sources */
.message-sources {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: #0a0a0a;
  border: 1px solid #1a1a1a;
  font-size: 0.7rem;
}

.sources-label {
  color: #555;
  font-family: 'JetBrains Mono', monospace;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.source-link {
  color: #888;
  text-decoration: none;
  padding: 0.15rem 0.4rem;
  background: #111;
  border: 1px solid #222;
  transition: all 0.15s ease;
}

.source-link:hover {
  color: #fff;
  border-color: #444;
}

.source-link.code-source {
  border-color: #2a2a2a;
  color: #777;
}

/* Chat Input */
.chat-input {
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem;
  border-top: 1px solid #222;
  background: #0a0a0a;
  flex-shrink: 0;
}

.chat-input input {
  flex: 1;
  padding: 0.75rem;
  background: #111;
  border: 1px solid #222;
  color: #fff;
  font-size: 0.85rem;
}

.chat-input input::placeholder {
  color: #444;
}

.chat-input input:disabled {
  opacity: 0.5;
}

.chat-input button {
  padding: 0.75rem;
  background: #222;
  color: #fff;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.chat-input button:hover:not(:disabled) {
  background: #333;
}

.chat-input button:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

/* Animations */
.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.pulse {
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}

.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  transform: translateY(20px);
}

.slide-left-enter-active,
.slide-left-leave-active {
  transition: all 0.2s ease;
}

.slide-left-enter-from,
.slide-left-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}
</style>
