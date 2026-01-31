import { ChatContainer } from "@/components/chat";

export const metadata = {
  title: "AI Assistant | FPL Insights",
  description:
    "Ask questions about your FPL team and get AI-powered advice on transfers, captain picks, and more.",
};

export default function ChatPage() {
  return (
    <div className="mx-auto h-[calc(100vh-8rem)] max-w-4xl">
      <div className="h-full overflow-hidden rounded-lg border border-fpl-border bg-fpl-card">
        <ChatContainer />
      </div>
    </div>
  );
}
