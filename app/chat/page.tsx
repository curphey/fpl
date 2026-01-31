"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ChatContainer } from "@/components/chat";

function ChatPageContent() {
  const searchParams = useSearchParams();
  const initialMessage = searchParams.get("q") || undefined;
  const autoSubmit = searchParams.get("auto") === "1";

  return (
    <div className="mx-auto h-[calc(100vh-8rem)] max-w-4xl">
      <div className="h-full overflow-hidden rounded-lg border border-fpl-border bg-fpl-card">
        <ChatContainer
          initialMessage={initialMessage}
          autoSubmit={autoSubmit}
        />
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto h-[calc(100vh-8rem)] max-w-4xl">
          <div className="flex h-full items-center justify-center rounded-lg border border-fpl-border bg-fpl-card">
            <div className="text-fpl-muted">Loading chat...</div>
          </div>
        </div>
      }
    >
      <ChatPageContent />
    </Suspense>
  );
}
