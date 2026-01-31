"use client";

import Link from "next/link";

interface AskAiButtonProps {
  /** The question to pre-fill in the chat */
  question: string;
  /** Button label (default: "Ask AI") */
  label?: string;
  /** Variant: 'button' for full button, 'icon' for icon-only, 'link' for text link */
  variant?: "button" | "icon" | "link";
  /** Optional tooltip text */
  tooltip?: string;
  /** Additional CSS classes */
  className?: string;
  /** Auto-submit the question when chat opens */
  autoSubmit?: boolean;
}

/**
 * Button that deep-links to the chat page with a pre-filled question
 */
export function AskAiButton({
  question,
  label = "Ask AI",
  variant = "button",
  tooltip,
  className = "",
  autoSubmit = false,
}: AskAiButtonProps) {
  const searchParams = new URLSearchParams();
  searchParams.set("q", question);
  if (autoSubmit) {
    searchParams.set("auto", "1");
  }
  const href = `/chat?${searchParams.toString()}`;

  const iconSvg = (
    <svg
      className="h-4 w-4"
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
  );

  if (variant === "icon") {
    return (
      <Link
        href={href}
        className={`inline-flex items-center justify-center rounded-full p-2 text-fpl-muted transition-colors hover:bg-fpl-purple/20 hover:text-fpl-purple ${className}`}
        title={
          tooltip ||
          `Ask AI: "${question.slice(0, 50)}${question.length > 50 ? "..." : ""}"`
        }
      >
        {iconSvg}
      </Link>
    );
  }

  if (variant === "link") {
    return (
      <Link
        href={href}
        className={`inline-flex items-center gap-1.5 text-sm text-fpl-purple hover:underline ${className}`}
        title={tooltip}
      >
        {iconSvg}
        <span>{label}</span>
      </Link>
    );
  }

  // Default: button variant
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 rounded-lg bg-fpl-purple/10 px-3 py-2 text-sm font-medium text-fpl-purple transition-colors hover:bg-fpl-purple/20 ${className}`}
      title={tooltip}
    >
      {iconSvg}
      <span>{label}</span>
    </Link>
  );
}
