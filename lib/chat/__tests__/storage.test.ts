import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  loadChatHistory,
  saveChatHistory,
  clearChatHistory,
  hasChatHistory,
} from "../storage";
import type { ChatMessage } from "../types";

// Mock localStorage with actual storage behavior
const createLocalStorageMock = () => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] || null,
    // Helper to get the raw store for testing
    _getStore: () => store,
  };
};

let localStorageMock = createLocalStorageMock();

Object.defineProperty(global, "localStorage", {
  get: () => localStorageMock,
  configurable: true,
});

describe("Chat Storage", () => {
  beforeEach(() => {
    // Reset localStorage mock before each test
    localStorageMock = createLocalStorageMock();
  });

  const createMessage = (
    role: "user" | "assistant",
    content: string,
    id?: string,
  ): ChatMessage => ({
    id: id || `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    role,
    content,
    timestamp: new Date("2024-01-15T12:00:00Z"),
    isStreaming: false,
    toolCalls: [],
  });

  describe("saveChatHistory", () => {
    it("saves messages to localStorage", () => {
      const messages: ChatMessage[] = [
        createMessage("user", "Hello"),
        createMessage("assistant", "Hi there!"),
      ];

      const result = saveChatHistory(messages);

      expect(result).toBe(true);

      const stored = localStorageMock.getItem("fpl-chat-history");
      expect(stored).not.toBeNull();

      const saved = JSON.parse(stored!);
      expect(saved.version).toBe(1);
      expect(saved.messages).toHaveLength(2);
      expect(saved.messages[0].content).toBe("Hello");
      expect(saved.messages[1].content).toBe("Hi there!");
    });

    it("filters out streaming messages", () => {
      const messages: ChatMessage[] = [
        createMessage("user", "Hello"),
        {
          ...createMessage("assistant", "Partial response"),
          isStreaming: true,
        },
      ];

      saveChatHistory(messages);

      const stored = localStorageMock.getItem("fpl-chat-history");
      const saved = JSON.parse(stored!);
      expect(saved.messages).toHaveLength(1);
      expect(saved.messages[0].content).toBe("Hello");
    });

    it("limits messages to MAX_MESSAGES", () => {
      const messages: ChatMessage[] = [];
      for (let i = 0; i < 150; i++) {
        messages.push(createMessage("user", `Message ${i}`, `msg-${i}`));
      }

      saveChatHistory(messages);

      const stored = localStorageMock.getItem("fpl-chat-history");
      const saved = JSON.parse(stored!);
      expect(saved.messages.length).toBeLessThanOrEqual(100);
    });

    it("preserves thinking content", () => {
      const messages: ChatMessage[] = [
        {
          ...createMessage("assistant", "Here's my answer"),
          thinking: "Let me think about this...",
        },
      ];

      saveChatHistory(messages);

      const stored = localStorageMock.getItem("fpl-chat-history");
      const saved = JSON.parse(stored!);
      expect(saved.messages[0].thinking).toBe("Let me think about this...");
    });
  });

  describe("loadChatHistory", () => {
    it("loads messages from localStorage", () => {
      const history = {
        version: 1,
        updatedAt: new Date().toISOString(),
        messages: [
          {
            id: "1",
            role: "user",
            content: "Hello",
            timestamp: "2024-01-15T12:00:00.000Z",
          },
          {
            id: "2",
            role: "assistant",
            content: "Hi there!",
            timestamp: "2024-01-15T12:00:01.000Z",
          },
        ],
      };

      localStorageMock.setItem("fpl-chat-history", JSON.stringify(history));

      const messages = loadChatHistory();

      expect(messages).toHaveLength(2);
      expect(messages[0].role).toBe("user");
      expect(messages[0].content).toBe("Hello");
      expect(messages[0].timestamp).toBeInstanceOf(Date);
      expect(messages[1].role).toBe("assistant");
      expect(messages[1].content).toBe("Hi there!");
    });

    it("returns empty array when no history exists", () => {
      const messages = loadChatHistory();

      expect(messages).toEqual([]);
    });

    it("returns empty array and clears on version mismatch", () => {
      const history = {
        version: 999,
        updatedAt: new Date().toISOString(),
        messages: [],
      };

      localStorageMock.setItem("fpl-chat-history", JSON.stringify(history));

      const messages = loadChatHistory();

      expect(messages).toEqual([]);
      expect(localStorageMock.getItem("fpl-chat-history")).toBeNull();
    });

    it("returns empty array and clears on corrupted data", () => {
      localStorageMock.setItem("fpl-chat-history", "invalid json{");

      const messages = loadChatHistory();

      expect(messages).toEqual([]);
      expect(localStorageMock.getItem("fpl-chat-history")).toBeNull();
    });

    it("sets isStreaming to false and toolCalls to empty array", () => {
      const history = {
        version: 1,
        updatedAt: new Date().toISOString(),
        messages: [
          {
            id: "1",
            role: "assistant",
            content: "Response",
            timestamp: "2024-01-15T12:00:00.000Z",
          },
        ],
      };

      localStorageMock.setItem("fpl-chat-history", JSON.stringify(history));

      const messages = loadChatHistory();

      expect(messages[0].isStreaming).toBe(false);
      expect(messages[0].toolCalls).toEqual([]);
    });
  });

  describe("clearChatHistory", () => {
    it("removes chat history from localStorage", () => {
      const history = {
        version: 1,
        updatedAt: new Date().toISOString(),
        messages: [
          {
            id: "1",
            role: "user",
            content: "Hello",
            timestamp: "2024-01-15T12:00:00.000Z",
          },
        ],
      };
      localStorageMock.setItem("fpl-chat-history", JSON.stringify(history));

      clearChatHistory();

      expect(localStorageMock.getItem("fpl-chat-history")).toBeNull();
    });
  });

  describe("hasChatHistory", () => {
    it("returns true when history exists with messages", () => {
      const history = {
        version: 1,
        updatedAt: new Date().toISOString(),
        messages: [
          {
            id: "1",
            role: "user",
            content: "Hello",
            timestamp: "2024-01-15T12:00:00.000Z",
          },
        ],
      };

      localStorageMock.setItem("fpl-chat-history", JSON.stringify(history));

      expect(hasChatHistory()).toBe(true);
    });

    it("returns false when no history exists", () => {
      expect(hasChatHistory()).toBe(false);
    });

    it("returns false when history is empty", () => {
      const history = {
        version: 1,
        updatedAt: new Date().toISOString(),
        messages: [],
      };

      localStorageMock.setItem("fpl-chat-history", JSON.stringify(history));

      expect(hasChatHistory()).toBe(false);
    });

    it("returns false on invalid JSON", () => {
      localStorageMock.setItem("fpl-chat-history", "invalid");

      expect(hasChatHistory()).toBe(false);
    });
  });

  describe("quota handling", () => {
    it("handles quota exceeded error by trimming", () => {
      // Create a custom localStorage that throws on first setItem for the history key
      let callCount = 0;
      const quotaExceededMock = {
        ...createLocalStorageMock(),
        setItem: (key: string, value: string) => {
          if (key === "fpl-chat-history") {
            callCount++;
            if (callCount === 1) {
              const error = new Error("QuotaExceededError");
              error.name = "QuotaExceededError";
              throw error;
            }
          }
          // Store on subsequent calls
          quotaExceededMock._store[key] = value;
        },
        _store: {} as Record<string, string>,
        getItem: (key: string) => quotaExceededMock._store[key] || null,
      };

      localStorageMock = quotaExceededMock as typeof localStorageMock;

      const messages: ChatMessage[] = [];
      for (let i = 0; i < 50; i++) {
        messages.push(createMessage("user", `Message ${i}`, `msg-${i}`));
      }

      const result = saveChatHistory(messages);

      expect(result).toBe(true);
      expect(callCount).toBe(2); // First call failed, second succeeded
    });
  });
});
