"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { ChatMessage, StreamEvent, ToolCall } from "./types";

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

interface UseChatOptions {
  managerId?: number;
  showThinking?: boolean;
}

interface UseChatReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  sendMessage: (content: string) => Promise<void>;
  clearMessages: () => void;
}

/**
 * Hook for managing chat state and streaming
 */
export function useChat(options: UseChatOptions = {}): UseChatReturn {
  const { managerId, showThinking = false } = options;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading) return;

      // Cancel any ongoing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      // Add user message
      const userMessage: ChatMessage = {
        id: generateId(),
        role: "user",
        content: content.trim(),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      // Create placeholder for assistant message
      const assistantMessage: ChatMessage = {
        id: generateId(),
        role: "assistant",
        content: "",
        timestamp: new Date(),
        isStreaming: true,
        toolCalls: [],
      };

      setMessages((prev) => [...prev, assistantMessage]);

      try {
        // Build message history for API
        const messageHistory = [...messages, userMessage].map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: messageHistory,
            managerId: managerId || undefined,
            showThinking,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Process complete events from buffer
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;

            try {
              const event: StreamEvent = JSON.parse(line.slice(6));

              setMessages((prev) => {
                const lastIdx = prev.length - 1;
                const lastMessage = prev[lastIdx];
                if (lastMessage.role !== "assistant") return prev;

                const updated = { ...lastMessage };

                switch (event.type) {
                  case "text_delta":
                    updated.content += event.content || "";
                    break;

                  case "thinking_delta":
                    updated.thinking =
                      (updated.thinking || "") + (event.content || "");
                    break;

                  case "tool_use_start":
                    if (event.toolCall) {
                      const toolCall: ToolCall = {
                        id: event.toolCall.id,
                        name: event.toolCall.name,
                        input: {},
                        status: "running",
                      };
                      updated.toolCalls = [
                        ...(updated.toolCalls || []),
                        toolCall,
                      ];
                    }
                    break;

                  case "tool_use_end":
                    if (event.toolCall) {
                      updated.toolCalls = (updated.toolCalls || []).map((tc) =>
                        tc.id === event.toolCall!.id
                          ? {
                              ...tc,
                              input: event.toolCall!.input || {},
                              result: event.toolCall!.result,
                              error: event.toolCall!.error,
                              status: event.toolCall!.error
                                ? "error"
                                : "completed",
                            }
                          : tc,
                      );
                    }
                    break;

                  case "error":
                    updated.content = `Error: ${event.content}`;
                    updated.isStreaming = false;
                    break;

                  case "done":
                    updated.isStreaming = false;
                    break;
                }

                return [...prev.slice(0, lastIdx), updated];
              });
            } catch {
              // Ignore parse errors for incomplete events
            }
          }
        }
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          // Request was cancelled, remove the placeholder message
          setMessages((prev) =>
            prev.filter((m) => m.id !== assistantMessage.id),
          );
        } else {
          console.error("Chat error:", error);
          setMessages((prev) => {
            const lastIdx = prev.length - 1;
            const lastMessage = prev[lastIdx];
            if (lastMessage.id !== assistantMessage.id) return prev;

            return [
              ...prev.slice(0, lastIdx),
              {
                ...lastMessage,
                content: `Sorry, something went wrong. ${error instanceof Error ? error.message : "Please try again."}`,
                isStreaming: false,
              },
            ];
          });
        }
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, managerId, messages, showThinking],
  );

  const clearMessages = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setMessages([]);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    messages,
    isLoading,
    sendMessage,
    clearMessages,
  };
}
