import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { getToolDefinitions } from "@/lib/chat/tools";
import { executeTool, createToolContext } from "@/lib/chat/tool-executor";
import { buildChatSystemPrompt } from "@/lib/chat/prompts";
import type { ChatToolName, StreamEvent } from "@/lib/chat/types";
import { withRateLimit } from "@/lib/api/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const chatRequestSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string(),
    }),
  ),
  managerId: z.number().optional(),
  showThinking: z.boolean().optional(),
  apiKey: z.string().optional(),
});

/**
 * Send a Server-Sent Event
 */
function sendEvent(
  controller: ReadableStreamDefaultController,
  event: StreamEvent,
) {
  const data = JSON.stringify(event);
  controller.enqueue(new TextEncoder().encode(`data: ${data}\n\n`));
}

export async function POST(request: NextRequest) {
  // Check rate limit (10 requests per minute for Claude endpoints)
  const rateLimitResponse = await withRateLimit(request, "claude");
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  let body;
  try {
    const rawBody = await request.json();
    body = chatRequestSchema.parse(rawBody);
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Invalid request",
        code: "INVALID_REQUEST",
        details: error instanceof z.ZodError ? error.issues : undefined,
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const { messages, managerId, showThinking, apiKey: userApiKey } = body;

  // Use user-provided key or fall back to environment variable
  const apiKey = userApiKey || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({
        error:
          "No API key configured. Please add your Anthropic API key using the 'API Key' button.",
        code: "API_KEY_MISSING",
      }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  // Create streaming response
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const client = new Anthropic({ apiKey });

        // Create tool context with FPL data
        const toolContext = await createToolContext(managerId);

        // Build system prompt
        const systemPrompt = buildChatSystemPrompt(!!managerId);

        // Convert messages to Claude format
        const claudeMessages: Anthropic.MessageParam[] = messages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        // Run conversation loop with tool use
        let continueLoop = true;
        let currentMessages = claudeMessages;

        while (continueLoop) {
          // Create message with streaming
          const messageConfig: Anthropic.MessageCreateParamsStreaming = {
            model: "claude-sonnet-4-20250514",
            max_tokens: 4096,
            system: systemPrompt,
            messages: currentMessages,
            tools: getToolDefinitions() as Anthropic.Tool[],
            stream: true,
          };

          // Add thinking if requested
          if (showThinking) {
            messageConfig.thinking = {
              type: "enabled",
              budget_tokens: 5000,
            };
          }

          const stream = await client.messages.stream(messageConfig);

          let fullResponse: Anthropic.Message | null = null;

          // Process stream events
          for await (const event of stream) {
            if (event.type === "content_block_start") {
              const block = event.content_block;
              if (block.type === "tool_use") {
                sendEvent(controller, {
                  type: "tool_use_start",
                  toolCall: {
                    id: block.id,
                    name: block.name,
                  },
                });
              }
            } else if (event.type === "content_block_delta") {
              const delta = event.delta;
              if (delta.type === "text_delta") {
                sendEvent(controller, {
                  type: "text_delta",
                  content: delta.text,
                });
              } else if (delta.type === "thinking_delta") {
                sendEvent(controller, {
                  type: "thinking_delta",
                  content: delta.thinking,
                });
              }
            } else if (event.type === "message_stop") {
              fullResponse = await stream.finalMessage();
            }
          }

          if (!fullResponse) {
            throw new Error("No response received from Claude");
          }

          // Check if we need to execute tools
          const toolUseBlocks = fullResponse.content.filter(
            (block): block is Anthropic.ToolUseBlock =>
              block.type === "tool_use",
          );

          if (toolUseBlocks.length > 0) {
            // Execute tools and continue loop
            const toolResults: Anthropic.ToolResultBlockParam[] = [];

            for (const toolUse of toolUseBlocks) {
              try {
                const result = await executeTool(
                  toolUse.name as ChatToolName,
                  toolUse.input as Record<string, unknown>,
                  toolContext,
                );

                toolResults.push({
                  type: "tool_result",
                  tool_use_id: toolUse.id,
                  content: JSON.stringify(result, null, 2),
                });

                sendEvent(controller, {
                  type: "tool_use_end",
                  toolCall: {
                    id: toolUse.id,
                    name: toolUse.name,
                    input: toolUse.input as Record<string, unknown>,
                    result,
                  },
                });
              } catch (error) {
                const errorMessage =
                  error instanceof Error
                    ? error.message
                    : "Tool execution failed";

                toolResults.push({
                  type: "tool_result",
                  tool_use_id: toolUse.id,
                  content: JSON.stringify({ error: errorMessage }),
                  is_error: true,
                });

                sendEvent(controller, {
                  type: "tool_use_end",
                  toolCall: {
                    id: toolUse.id,
                    name: toolUse.name,
                    input: toolUse.input as Record<string, unknown>,
                    error: errorMessage,
                  },
                });
              }
            }

            // Add assistant message with tool use and tool results
            currentMessages = [
              ...currentMessages,
              { role: "assistant", content: fullResponse.content },
              { role: "user", content: toolResults },
            ];
          } else {
            // No more tools to execute, we're done
            continueLoop = false;
          }

          // Check stop reason
          if (
            fullResponse.stop_reason === "end_turn" ||
            fullResponse.stop_reason === "stop_sequence"
          ) {
            continueLoop = false;
          }
        }

        // Signal completion
        sendEvent(controller, { type: "done" });
        controller.close();
      } catch (error) {
        console.error("Chat API error:", error);

        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";

        sendEvent(controller, {
          type: "error",
          content: errorMessage,
        });

        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
