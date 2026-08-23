// Local storage utilities for the research agent
// NOTE: API keys are stored in the user's browser localStorage. This is the user's
// own API key for their OpenRouter account - it never leaves their browser except
// to make direct calls to OpenRouter's API. We use base64 encoding only to prevent
// the key from being visible in plain text in browser dev tools during casual inspection.

import type { ChatSession, ChatMessage, SessionListItem } from './types';

const STORAGE_PREFIX = 'catto_';
const MAX_SESSIONS = 20;
const SESSIONS_KEY = 'chat_sessions';
const ACTIVE_SESSION_KEY = 'active_session_id';
const STORAGE_VERSION = 1;

// Base64 encode to prevent plain text visibility in dev tools
// This is NOT encryption - just visual obfuscation for casual inspection
function encode(text: string): string {
  if (!text) return '';
  try {
    return btoa(encodeURIComponent(text));
  } catch {
    return btoa(text);
  }
}

function decode(encoded: string): string {
  if (!encoded) return '';
  try {
    return decodeURIComponent(atob(encoded));
  } catch {
    try {
      return atob(encoded);
    } catch {
      return '';
    }
  }
}

// Save a value with base64 encoding (for API keys)
export function saveEncoded(key: string, value: string): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_PREFIX + key, encode(value));
}

// Load a base64-encoded value
export function loadEncoded(key: string): string {
  if (typeof localStorage === 'undefined') return '';
  const stored = localStorage.getItem(STORAGE_PREFIX + key);
  if (!stored) return '';
  return decode(stored);
}

// Remove a stored value
export function removeStored(key: string): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(STORAGE_PREFIX + key);
}

// Legacy aliases for backward compatibility with existing stored data
export const saveSecure = saveEncoded;
export const loadSecure = loadEncoded;
export const removeSecure = removeStored;

export function saveSettings(settings: Record<string, unknown>): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_PREFIX + 'settings', JSON.stringify(settings));
}

export function loadSettings(): Record<string, unknown> | null {
  if (typeof localStorage === 'undefined') return null;
  const stored = localStorage.getItem(STORAGE_PREFIX + 'settings');
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

// =============================================================================
// SESSION MANAGEMENT
// =============================================================================

interface StoredSessions {
  version: number;
  sessions: ChatSession[];
  activeSessionId: string | null;
}

function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function loadSessionsData(): StoredSessions {
  if (typeof localStorage === 'undefined') {
    return { version: STORAGE_VERSION, sessions: [], activeSessionId: null };
  }

  const stored = localStorage.getItem(STORAGE_PREFIX + SESSIONS_KEY);
  if (!stored) {
    return { version: STORAGE_VERSION, sessions: [], activeSessionId: null };
  }

  try {
    const data = JSON.parse(stored) as StoredSessions;
    // Handle version migrations here if needed in the future
    if (!data.version) {
      data.version = STORAGE_VERSION;
    }
    return data;
  } catch {
    return { version: STORAGE_VERSION, sessions: [], activeSessionId: null };
  }
}

function saveSessionsData(data: StoredSessions): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_PREFIX + SESSIONS_KEY, JSON.stringify(data));
}

export function createSession(initialMessage?: ChatMessage): ChatSession {
  const data = loadSessionsData();
  const now = Date.now();

  const newSession: ChatSession = {
    id: generateSessionId(),
    title: 'New Chat',
    messages: initialMessage ? [initialMessage] : [],
    createdAt: now,
    updatedAt: now,
  };

  // Add to beginning (most recent first)
  data.sessions.unshift(newSession);

  // Enforce max sessions limit
  if (data.sessions.length > MAX_SESSIONS) {
    data.sessions = data.sessions.slice(0, MAX_SESSIONS);
  }

  data.activeSessionId = newSession.id;
  saveSessionsData(data);

  return newSession;
}

export function getSession(sessionId: string): ChatSession | null {
  const data = loadSessionsData();
  return data.sessions.find(s => s.id === sessionId) || null;
}

export function getActiveSession(): ChatSession | null {
  const data = loadSessionsData();
  if (!data.activeSessionId) return null;
  return data.sessions.find(s => s.id === data.activeSessionId) || null;
}

export function getActiveSessionId(): string | null {
  const data = loadSessionsData();
  return data.activeSessionId;
}

export function setActiveSession(sessionId: string): boolean {
  const data = loadSessionsData();
  const session = data.sessions.find(s => s.id === sessionId);
  if (!session) return false;

  data.activeSessionId = sessionId;
  saveSessionsData(data);
  return true;
}

export function updateSessionMessages(sessionId: string, messages: ChatMessage[]): boolean {
  const data = loadSessionsData();
  const session = data.sessions.find(s => s.id === sessionId);
  if (!session) return false;

  session.messages = messages;
  session.updatedAt = Date.now();

  // Auto-title from first user message if still "New Chat"
  if (session.title === 'New Chat') {
    const firstUserMessage = messages.find(m => m.role === 'user');
    if (firstUserMessage) {
      const content = firstUserMessage.content.trim();
      session.title = content.length > 40 ? content.slice(0, 40) + '...' : content;
    }
  }

  // Move to top of list (most recently updated)
  const index = data.sessions.indexOf(session);
  if (index > 0) {
    data.sessions.splice(index, 1);
    data.sessions.unshift(session);
  }

  saveSessionsData(data);
  return true;
}

export function renameSession(sessionId: string, newTitle: string): boolean {
  const data = loadSessionsData();
  const session = data.sessions.find(s => s.id === sessionId);
  if (!session) return false;

  session.title = newTitle.trim() || 'Untitled';
  session.updatedAt = Date.now();
  saveSessionsData(data);
  return true;
}

export function deleteSession(sessionId: string): boolean {
  const data = loadSessionsData();
  const index = data.sessions.findIndex(s => s.id === sessionId);
  if (index === -1) return false;

  data.sessions.splice(index, 1);

  // If we deleted the active session, switch to the first available
  if (data.activeSessionId === sessionId) {
    data.activeSessionId = data.sessions.length > 0 ? data.sessions[0].id : null;
  }

  saveSessionsData(data);
  return true;
}

export function listSessions(): SessionListItem[] {
  const data = loadSessionsData();
  return data.sessions.map(s => ({
    id: s.id,
    title: s.title,
    messageCount: s.messages.length,
    updatedAt: s.updatedAt,
  }));
}

export function getAllSessions(): ChatSession[] {
  const data = loadSessionsData();
  return data.sessions;
}
