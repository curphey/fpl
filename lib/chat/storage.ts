/**
 * Chat history persistence in localStorage
 */

import type { ChatMessage } from "./types";

const STORAGE_KEY = "fpl-chat-history";
const MAX_MESSAGES = 100; // Limit to last 100 messages
const MAX_STORAGE_SIZE = 500 * 1024; // 500KB limit

interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string; // ISO string for JSON serialization
  thinking?: string;
  // Exclude toolCalls and isStreaming - they don't need to persist
}

interface ChatHistory {
  version: 1;
  updatedAt: string;
  messages: StoredMessage[];
}

/**
 * Convert ChatMessage to storable format
 */
function toStoredMessage(message: ChatMessage): StoredMessage {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    timestamp: message.timestamp.toISOString(),
    thinking: message.thinking,
  };
}

/**
 * Convert stored message back to ChatMessage
 */
function fromStoredMessage(stored: StoredMessage): ChatMessage {
  return {
    id: stored.id,
    role: stored.role,
    content: stored.content,
    timestamp: new Date(stored.timestamp),
    thinking: stored.thinking,
    isStreaming: false,
    toolCalls: [],
  };
}

/**
 * Check if localStorage is available
 */
function isLocalStorageAvailable(): boolean {
  try {
    const testKey = "__test__";
    localStorage.setItem(testKey, testKey);
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Estimate the size of a string in bytes
 */
function getStringByteSize(str: string): number {
  return new Blob([str]).size;
}

/**
 * Load chat history from localStorage
 */
export function loadChatHistory(): ChatMessage[] {
  if (!isLocalStorageAvailable()) {
    return [];
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return [];
    }

    const history: ChatHistory = JSON.parse(stored);

    // Validate version
    if (history.version !== 1) {
      console.warn("Chat history version mismatch, clearing");
      clearChatHistory();
      return [];
    }

    return history.messages.map(fromStoredMessage);
  } catch (error) {
    console.error("Error loading chat history:", error);
    // Clear corrupted data
    clearChatHistory();
    return [];
  }
}

/**
 * Save chat history to localStorage
 */
export function saveChatHistory(messages: ChatMessage[]): boolean {
  if (!isLocalStorageAvailable()) {
    return false;
  }

  try {
    // Filter out streaming messages and limit count
    const completedMessages = messages
      .filter((m) => !m.isStreaming)
      .slice(-MAX_MESSAGES);

    const history: ChatHistory = {
      version: 1,
      updatedAt: new Date().toISOString(),
      messages: completedMessages.map(toStoredMessage),
    };

    const serialized = JSON.stringify(history);

    // Check size before saving
    if (getStringByteSize(serialized) > MAX_STORAGE_SIZE) {
      // Trim messages to fit
      const trimmedMessages = trimMessagesToFit(
        completedMessages,
        MAX_STORAGE_SIZE,
      );
      const trimmedHistory: ChatHistory = {
        ...history,
        messages: trimmedMessages.map(toStoredMessage),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmedHistory));
    } else {
      localStorage.setItem(STORAGE_KEY, serialized);
    }

    return true;
  } catch (error) {
    // Handle quota exceeded error
    if (
      error instanceof Error &&
      (error.name === "QuotaExceededError" || error.message.includes("quota"))
    ) {
      console.warn("localStorage quota exceeded, trimming chat history");
      return trimAndSave(messages);
    }

    console.error("Error saving chat history:", error);
    return false;
  }
}

/**
 * Trim messages to fit within size limit
 */
function trimMessagesToFit(
  messages: ChatMessage[],
  maxSize: number,
): ChatMessage[] {
  let trimmed = [...messages];

  while (trimmed.length > 0) {
    const history: ChatHistory = {
      version: 1,
      updatedAt: new Date().toISOString(),
      messages: trimmed.map(toStoredMessage),
    };
    const serialized = JSON.stringify(history);

    if (getStringByteSize(serialized) <= maxSize) {
      break;
    }

    // Remove oldest messages (keep pairs if possible for context)
    trimmed = trimmed.slice(2);
  }

  return trimmed;
}

/**
 * Trim and save when quota is exceeded
 */
function trimAndSave(messages: ChatMessage[]): boolean {
  try {
    // Keep only last 20 messages
    const trimmed = messages.filter((m) => !m.isStreaming).slice(-20);

    const history: ChatHistory = {
      version: 1,
      updatedAt: new Date().toISOString(),
      messages: trimmed.map(toStoredMessage),
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    return true;
  } catch (error) {
    console.error("Error trimming chat history:", error);
    // Last resort: clear everything
    clearChatHistory();
    return false;
  }
}

/**
 * Clear chat history from localStorage
 */
export function clearChatHistory(): void {
  if (!isLocalStorageAvailable()) {
    return;
  }

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error("Error clearing chat history:", error);
  }
}

/**
 * Check if there is saved chat history
 */
export function hasChatHistory(): boolean {
  if (!isLocalStorageAvailable()) {
    return false;
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return false;
    }

    const history: ChatHistory = JSON.parse(stored);
    return history.messages.length > 0;
  } catch {
    return false;
  }
}
