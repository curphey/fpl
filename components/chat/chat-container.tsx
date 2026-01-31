"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useManagerContext } from "@/lib/fpl/manager-context";
import { ChatInput } from "./chat-input";
import { MessageList } from "./message-list";
import { SuggestedQuestions } from "./suggested-questions";
import { ApiKeyInput } from "./api-key-input";
import type { ChatMessage, StreamEvent, ToolCall } from "@/lib/chat/types";
import {
  loadChatHistory,
  saveChatHistory,
  clearChatHistory,
} from "@/lib/chat/storage";

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export function ChatContainer() {
  const { managerId } = useManagerContext();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showThinking, setShowThinking] = useState(false);
  const [userApiKey, setUserApiKey] = useState<string | null>(null);
  const [isHistoryLoaded, setIsHistoryLoaded] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load chat history from localStorage on mount
  useEffect(() => {
    const savedMessages = loadChatHistory();
    if (savedMessages.length > 0) {
      setMessages(savedMessages);
    }
    setIsHistoryLoaded(true);
  }, []);

  // Save messages to localStorage when they change (after initial load)
  useEffect(() => {
    if (isHistoryLoaded && messages.length > 0) {
      // Only save when not streaming
      const hasStreamingMessage = messages.some((m) => m.isStreaming);
      if (!hasStreamingMessage) {
        saveChatHistory(messages);
      }
    }
  }, [messages, isHistoryLoaded]);

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
            apiKey: userApiKey || undefined,
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
    [isLoading, managerId, messages, showThinking, userApiKey],
  );

  const handleSuggestedQuestion = useCallback(
    (question: string) => {
      sendMessage(question);
    },
    [sendMessage],
  );

  const startNewChat = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setMessages([]);
    clearChatHistory();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-fpl-border px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-fpl-purple">
            <svg
              className="h-4 w-4 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-fpl-text">
              FPL Assistant
            </h2>
            <p className="text-xs text-fpl-muted">
              {managerId
                ? "Connected to your team"
                : "Connect your team for personalized advice"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* API Key config */}
          <ApiKeyInput onKeyChange={setUserApiKey} />

          {/* Thinking toggle */}
          <button
            onClick={() => setShowThinking(!showThinking)}
            className={`rounded px-2 py-1 text-xs transition-colors ${
              showThinking
                ? "bg-fpl-purple text-white"
                : "bg-fpl-card-alt text-fpl-muted hover:text-fpl-text"
            }`}
            title="Toggle extended thinking"
          >
            Thinking
          </button>

          {/* New Chat */}
          {messages.length > 0 && (
            <button
              onClick={startNewChat}
              className="rounded px-2 py-1 text-xs text-fpl-muted transition-colors hover:bg-fpl-card-alt hover:text-fpl-text"
              title="Start a new conversation"
            >
              New Chat
            </button>
          )}
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center p-6">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-fpl-purple/20">
              <svg
                className="h-8 w-8 text-fpl-purple"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
            </div>
            <h3 className="mb-2 text-lg font-semibold text-fpl-text">
              Ask me anything about FPL
            </h3>
            <p className="mb-6 max-w-md text-center text-sm text-fpl-muted">
              I can help with captain picks, transfer advice, fixture analysis,
              chip strategy, and more.
            </p>
            <SuggestedQuestions onSelect={handleSuggestedQuestion} />
          </div>
        ) : (
          <MessageList messages={messages} />
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-fpl-border p-4">
        <ChatInput onSend={sendMessage} isLoading={isLoading} />
      </div>
    </div>
  );
}
