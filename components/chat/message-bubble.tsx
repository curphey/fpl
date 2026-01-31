"use client";

import { useState } from "react";
import type { ChatMessage, ToolCall } from "@/lib/chat/types";
import { ThinkingIndicator } from "./thinking-indicator";
import ReactMarkdown from "react-markdown";

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-lg px-4 py-3 ${
          isUser ? "bg-fpl-purple text-white" : "bg-fpl-card-alt text-fpl-text"
        }`}
      >
        {/* Thinking display */}
        {message.thinking && <ThinkingDisplay thinking={message.thinking} />}

        {/* Tool calls */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mb-3 space-y-2">
            {message.toolCalls.map((toolCall) => (
              <ToolCallBadge key={toolCall.id} toolCall={toolCall} />
            ))}
          </div>
        )}

        {/* Message content */}
        {message.content ? (
          <div className="prose prose-sm prose-invert max-w-none">
            <ReactMarkdown
              components={{
                // Style code blocks
                code: ({ className, children, ...props }) => {
                  const match = /language-(\w+)/.exec(className || "");
                  const isInline = !match;
                  return isInline ? (
                    <code
                      className="rounded bg-black/20 px-1 py-0.5 text-xs"
                      {...props}
                    >
                      {children}
                    </code>
                  ) : (
                    <code
                      className="block overflow-x-auto rounded bg-black/20 p-2 text-xs"
                      {...props}
                    >
                      {children}
                    </code>
                  );
                },
                // Style tables
                table: ({ children }) => (
                  <div className="my-2 overflow-x-auto">
                    <table className="min-w-full text-xs">{children}</table>
                  </div>
                ),
                th: ({ children }) => (
                  <th className="border-b border-fpl-border px-2 py-1 text-left font-medium">
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className="border-b border-fpl-border/50 px-2 py-1">
                    {children}
                  </td>
                ),
                // Style lists
                ul: ({ children }) => (
                  <ul className="my-2 list-inside list-disc space-y-1">
                    {children}
                  </ul>
                ),
                ol: ({ children }) => (
                  <ol className="my-2 list-inside list-decimal space-y-1">
                    {children}
                  </ol>
                ),
                // Style links
                a: ({ href, children }) => (
                  <a
                    href={href}
                    className="text-fpl-green underline hover:no-underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {children}
                  </a>
                ),
                // Style headings
                h1: ({ children }) => (
                  <h1 className="mb-2 mt-4 text-lg font-bold">{children}</h1>
                ),
                h2: ({ children }) => (
                  <h2 className="mb-2 mt-3 text-base font-bold">{children}</h2>
                ),
                h3: ({ children }) => (
                  <h3 className="mb-1 mt-2 text-sm font-bold">{children}</h3>
                ),
                // Style paragraphs
                p: ({ children }) => (
                  <p className="mb-2 last:mb-0">{children}</p>
                ),
                // Style blockquotes
                blockquote: ({ children }) => (
                  <blockquote className="border-l-2 border-fpl-purple pl-3 italic">
                    {children}
                  </blockquote>
                ),
                // Style horizontal rules
                hr: () => <hr className="my-4 border-fpl-border" />,
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        ) : message.isStreaming ? (
          <ThinkingIndicator />
        ) : null}
      </div>
    </div>
  );
}

function ThinkingDisplay({ thinking }: { thinking: string }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const previewLength = 150;
  const isLong = thinking.length > previewLength;
  const preview = isLong ? thinking.slice(0, previewLength) + "..." : thinking;

  return (
    <div className="mb-3 rounded border border-fpl-border/50 bg-black/10 p-2">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center gap-2 text-left"
      >
        <svg
          className="h-3 w-3 text-fpl-muted"
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
        <span className="text-xs font-medium text-fpl-muted">Thinking</span>
        <svg
          className={`ml-auto h-3 w-3 text-fpl-muted transition-transform ${
            isExpanded ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
      <pre className="mt-2 whitespace-pre-wrap font-sans text-xs text-fpl-muted">
        {isExpanded ? thinking : preview}
      </pre>
      {isLong && !isExpanded && (
        <button
          onClick={() => setIsExpanded(true)}
          className="mt-1 text-xs text-fpl-green hover:underline"
        >
          Show more
        </button>
      )}
    </div>
  );
}

function ToolCallBadge({ toolCall }: { toolCall: ToolCall }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const statusColors = {
    pending: "bg-gray-500",
    running: "bg-yellow-500 animate-pulse",
    completed: "bg-green-500",
    error: "bg-red-500",
  };

  const toolLabels: Record<string, string> = {
    get_my_squad: "Squad",
    search_players: "Search",
    get_player_details: "Player",
    compare_players: "Compare",
    get_fixtures: "Fixtures",
    get_captain_recommendations: "Captain",
    get_transfer_recommendations: "Transfers",
    get_price_changes: "Prices",
    get_chip_advice: "Chips",
    get_gameweek_info: "Gameweek",
  };

  return (
    <div className="rounded border border-fpl-border/30 bg-black/5">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center gap-2 px-2 py-1"
      >
        <span
          className={`h-2 w-2 rounded-full ${statusColors[toolCall.status]}`}
        />
        <span className="text-xs font-medium">
          {toolLabels[toolCall.name] || toolCall.name}
        </span>
        {toolCall.status === "running" && (
          <span className="text-xs text-fpl-muted">Loading...</span>
        )}
        {(toolCall.result || toolCall.error) && (
          <svg
            className={`ml-auto h-3 w-3 text-fpl-muted transition-transform ${
              isExpanded ? "rotate-180" : ""
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        )}
      </button>

      {isExpanded && (toolCall.result || toolCall.error) && (
        <div className="border-t border-fpl-border/30 p-2">
          {toolCall.error ? (
            <p className="text-xs text-red-400">{toolCall.error}</p>
          ) : (
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap text-xs text-fpl-muted">
              {JSON.stringify(toolCall.result, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
