"use client";

import { useState, useRef, useEffect, KeyboardEvent, useCallback } from "react";
import {
  useSpeechRecognition,
  type SpeechRecognitionStatus,
} from "@/lib/chat/use-speech-recognition";

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading: boolean;
  /** Pre-fill the input with this value (only used on initial render) */
  initialValue?: string;
}

// Microphone icon component
function MicrophoneIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
      />
    </svg>
  );
}

// Stop icon for recording state
function StopIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

// Visual indicator for voice status
function VoiceStatusIndicator({ status }: { status: SpeechRecognitionStatus }) {
  if (status === "idle" || status === "unsupported") return null;

  return (
    <div
      className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-fpl-card-alt px-2 py-1 text-xs"
      role="status"
      aria-live="polite"
    >
      {status === "listening" && (
        <span className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
          </span>
          Listening...
        </span>
      )}
      {status === "processing" && (
        <span className="text-fpl-green">Processing speech...</span>
      )}
      {status === "error" && (
        <span className="text-red-400">Error - try again</span>
      )}
    </div>
  );
}

export function ChatInput({ onSend, isLoading, initialValue }: ChatInputProps) {
  // Initialize with prop value; changes to initialValue after mount are ignored
  // (component should be remounted via key prop if reset is needed)
  const [input, setInput] = useState(initialValue || "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Handle transcript from speech recognition via callback
  // Using functional update to access current input value
  const handleTranscript = useCallback((text: string, isFinal: boolean) => {
    if (text && isFinal) {
      setInput((currentInput) => {
        const separator =
          currentInput && !currentInput.endsWith(" ") ? " " : "";
        return currentInput + separator + text;
      });
    }
  }, []);

  // Speech recognition hook
  const {
    status: voiceStatus,
    isSupported: voiceSupported,
    isListening,
    error: voiceError,
    toggleListening,
  } = useSpeechRecognition({
    language: "en-GB",
    interimResults: true,
    onTranscript: handleTranscript,
    onError: (error) => {
      console.error("Voice input error:", error);
    },
  });

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [input]);

  const handleSubmit = useCallback(() => {
    if (!input.trim() || isLoading) return;
    onSend(input);
    setInput("");
    // Reset height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [input, isLoading, onSend]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Enter (without Shift)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
      return;
    }

    // Toggle voice input with Ctrl+Shift+M
    if (e.key === "m" && e.ctrlKey && e.shiftKey && voiceSupported) {
      e.preventDefault();
      toggleListening();
    }
  };

  // Handle global keyboard shortcut for voice toggle
  useEffect(() => {
    const handleGlobalKeyDown = (e: globalThis.KeyboardEvent) => {
      // Ctrl+Shift+M to toggle voice input
      if (e.key === "m" && e.ctrlKey && e.shiftKey && voiceSupported) {
        e.preventDefault();
        toggleListening();
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [voiceSupported, toggleListening]);

  return (
    <div className="flex items-end gap-2">
      <div className="relative flex-1">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about captain picks, transfers, fixtures..."
          disabled={isLoading}
          rows={1}
          className="w-full resize-none rounded-lg border border-fpl-border bg-fpl-card px-4 py-3 pr-12 text-sm text-fpl-text placeholder-fpl-muted focus:border-fpl-purple focus:outline-none focus:ring-1 focus:ring-fpl-purple disabled:opacity-50"
          aria-label="Chat message input"
        />
        <span className="pointer-events-none absolute bottom-3 right-3 text-xs text-fpl-muted">
          {input.length > 0 && "⏎ to send"}
        </span>
      </div>

      {/* Voice input button */}
      {voiceSupported && (
        <div className="relative">
          <VoiceStatusIndicator status={voiceStatus} />
          <button
            onClick={toggleListening}
            disabled={isLoading}
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition-all ${
              isListening
                ? "animate-pulse bg-red-500 text-white ring-2 ring-red-300"
                : "bg-fpl-card-alt text-fpl-muted hover:bg-fpl-card-hover hover:text-fpl-text"
            } disabled:cursor-not-allowed disabled:opacity-50`}
            title={
              isListening
                ? "Stop recording (Ctrl+Shift+M)"
                : "Voice input (Ctrl+Shift+M)"
            }
            aria-label={
              isListening ? "Stop voice recording" : "Start voice input"
            }
            aria-pressed={isListening}
          >
            {isListening ? (
              <StopIcon className="h-5 w-5" />
            ) : (
              <MicrophoneIcon className="h-5 w-5" />
            )}
          </button>

          {/* Error tooltip */}
          {voiceError && voiceStatus === "error" && (
            <div
              className="absolute -top-16 left-1/2 w-48 -translate-x-1/2 rounded-md bg-red-500/90 p-2 text-center text-xs text-white shadow-lg"
              role="alert"
            >
              {voiceError}
            </div>
          )}
        </div>
      )}

      {/* Send button */}
      <button
        onClick={handleSubmit}
        disabled={!input.trim() || isLoading}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-fpl-purple text-white transition-colors hover:bg-fpl-purple-dark disabled:cursor-not-allowed disabled:opacity-50"
        aria-label="Send message"
      >
        {isLoading ? (
          <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
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
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : (
          <svg
            className="h-5 w-5"
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

      {/* Screen reader announcement for voice status */}
      <div className="sr-only" role="status" aria-live="polite">
        {voiceStatus === "listening" && "Voice recording started"}
        {voiceStatus === "processing" && "Processing your speech"}
        {voiceStatus === "idle" && "Ready for voice input"}
        {voiceError && `Voice input error: ${voiceError}`}
      </div>
    </div>
  );
}
