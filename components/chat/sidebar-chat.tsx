"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useManagerContext } from "@/lib/fpl/manager-context";
import type { ChatMessage, StreamEvent, ToolCall } from "@/lib/chat/types";

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export function SidebarChat() {
  const { managerId } = useManagerContext();
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [input, setInput] = useState("");
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (isExpanded && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isExpanded]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading) return;

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      const userMessage: ChatMessage = {
        id: generateId(),
        role: "user",
        content: content.trim(),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);
      setInput("");

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
            showThinking: false,
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
                content: `Sorry, something went wrong. Please try again.`,
                isStreaming: false,
              },
            ];
          });
        }
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, managerId, messages],
  );

  const handleSubmit = () => {
    if (!input.trim() || isLoading) return;
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const clearChat = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setMessages([]);
  }, []);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return (
    <div className="mt-auto border-t border-fpl-border">
      {/* Header - always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-sm font-medium text-fpl-muted transition-colors hover:bg-fpl-purple-light/50 hover:text-foreground"
      >
        <div className="flex items-center gap-2">
          <svg
            className="h-4 w-4 text-fpl-purple"
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
          <span>AI Chat</span>
          {messages.length > 0 && (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-fpl-purple text-[10px] text-white">
              {messages.length}
            </span>
          )}
        </div>
        <svg
          className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 15l7-7 7 7"
          />
        </svg>
      </button>

      {/* Expanded chat panel */}
      {isExpanded && (
        <div className="flex h-80 flex-col border-t border-fpl-border bg-fpl-card-alt">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-2">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <p className="mb-2 text-xs text-fpl-muted">
                  Ask about your team
                </p>
                <div className="flex flex-wrap justify-center gap-1">
                  {["Who to captain?", "Transfer tips?"].map((q) => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
                      className="rounded-full bg-fpl-purple/20 px-2 py-1 text-[10px] text-fpl-text transition-colors hover:bg-fpl-purple/30"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`rounded-lg px-2 py-1.5 text-xs ${
                      msg.role === "user"
                        ? "ml-4 bg-fpl-purple text-white"
                        : "mr-4 bg-fpl-card text-fpl-text"
                    }`}
                  >
                    {msg.isStreaming && !msg.content ? (
                      <span className="inline-flex items-center gap-1">
                        <span className="h-1 w-1 animate-pulse rounded-full bg-current" />
                        <span
                          className="h-1 w-1 animate-pulse rounded-full bg-current"
                          style={{ animationDelay: "0.2s" }}
                        />
                        <span
                          className="h-1 w-1 animate-pulse rounded-full bg-current"
                          style={{ animationDelay: "0.4s" }}
                        />
                      </span>
                    ) : (
                      <span className="whitespace-pre-wrap break-words">
                        {msg.content}
                      </span>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-fpl-border p-2">
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything..."
                disabled={isLoading}
                className="flex-1 rounded-lg border border-fpl-border bg-fpl-card px-2 py-1.5 text-xs text-fpl-text placeholder-fpl-muted focus:border-fpl-purple focus:outline-none disabled:opacity-50"
              />
              <button
                onClick={handleSubmit}
                disabled={!input.trim() || isLoading}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-fpl-purple text-white transition-colors hover:bg-fpl-purple-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoading ? (
                  <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                ) : (
                  <svg
                    className="h-3 w-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                    />
                  </svg>
                )}
              </button>
              {messages.length > 0 && (
                <button
                  onClick={clearChat}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-fpl-muted transition-colors hover:bg-fpl-card hover:text-fpl-text"
                  title="Clear chat"
                >
                  <svg
                    className="h-3 w-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
