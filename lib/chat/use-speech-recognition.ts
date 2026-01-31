"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";

// Web Speech API types
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onspeechstart: (() => void) | null;
  onspeechend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  }
}

export type SpeechRecognitionStatus =
  | "idle"
  | "listening"
  | "processing"
  | "error"
  | "unsupported";

export interface UseSpeechRecognitionOptions {
  /** Language for speech recognition (default: "en-GB") */
  language?: string;
  /** Whether to capture interim results while speaking */
  interimResults?: boolean;
  /** Callback when transcript changes */
  onTranscript?: (transcript: string, isFinal: boolean) => void;
  /** Callback when an error occurs */
  onError?: (error: string) => void;
}

export interface UseSpeechRecognitionReturn {
  /** Current recognition status */
  status: SpeechRecognitionStatus;
  /** Whether speech recognition is supported in this browser */
  isSupported: boolean;
  /** Whether currently listening */
  isListening: boolean;
  /** Current transcript (interim or final) */
  transcript: string;
  /** Error message if status is "error" */
  error: string | null;
  /** Start listening for speech */
  startListening: () => void;
  /** Stop listening */
  stopListening: () => void;
  /** Toggle listening state */
  toggleListening: () => void;
  /** Clear transcript and error state */
  reset: () => void;
}

// Check for browser support (safe for SSR)
function getSpeechRecognitionAPI(): (new () => SpeechRecognition) | undefined {
  if (typeof window === "undefined") return undefined;
  return window.SpeechRecognition || window.webkitSpeechRecognition;
}

export function useSpeechRecognition(
  options: UseSpeechRecognitionOptions = {},
): UseSpeechRecognitionReturn {
  const {
    language = "en-GB",
    interimResults = true,
    onTranscript,
    onError,
  } = options;

  // Check support during initial render (memoized to avoid re-checking)
  const isSupported = useMemo(() => !!getSpeechRecognitionAPI(), []);

  const [status, setStatus] = useState<SpeechRecognitionStatus>(() =>
    isSupported ? "idle" : "unsupported",
  );
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const isListeningRef = useRef(false);

  // Store callbacks in refs to avoid re-creating recognition on callback changes
  const onTranscriptRef = useRef(onTranscript);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
    onErrorRef.current = onError;
  }, [onTranscript, onError]);

  // Initialize recognition instance
  useEffect(() => {
    const SpeechRecognitionAPI = getSpeechRecognitionAPI();

    if (!SpeechRecognitionAPI) return;

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = interimResults;
    recognition.lang = language;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      isListeningRef.current = true;
      setStatus("listening");
      setError(null);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = "";
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      const currentTranscript = finalTranscript || interimTranscript;
      setTranscript((prev) =>
        finalTranscript ? prev + finalTranscript : prev + interimTranscript,
      );

      if (currentTranscript) {
        onTranscriptRef.current?.(currentTranscript, !!finalTranscript);
      }

      // Update status to show we're processing speech
      if (interimTranscript) {
        setStatus("processing");
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      isListeningRef.current = false;

      // Handle specific error types
      let errorMessage: string;
      switch (event.error) {
        case "not-allowed":
          errorMessage = "Microphone access denied. Please enable permissions.";
          break;
        case "no-speech":
          errorMessage = "No speech detected. Please try again.";
          break;
        case "audio-capture":
          errorMessage = "No microphone found. Please check your device.";
          break;
        case "network":
          errorMessage = "Network error. Please check your connection.";
          break;
        case "aborted":
          // User aborted, not an error
          setStatus("idle");
          return;
        default:
          errorMessage = `Speech recognition error: ${event.error}`;
      }

      setError(errorMessage);
      setStatus("error");
      onErrorRef.current?.(errorMessage);
    };

    recognition.onend = () => {
      isListeningRef.current = false;
      // Only set to idle if not in error state
      setStatus((prev) => (prev === "error" ? "error" : "idle"));
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.abort();
      recognitionRef.current = null;
    };
  }, [language, interimResults]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current || isListeningRef.current) return;

    setTranscript("");
    setError(null);

    try {
      recognitionRef.current.start();
    } catch (err) {
      // Handle case where recognition is already started
      console.error("Failed to start speech recognition:", err);
    }
  }, []);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current || !isListeningRef.current) return;

    try {
      recognitionRef.current.stop();
    } catch (err) {
      console.error("Failed to stop speech recognition:", err);
    }
  }, []);

  const toggleListening = useCallback(() => {
    if (isListeningRef.current) {
      stopListening();
    } else {
      startListening();
    }
  }, [startListening, stopListening]);

  const reset = useCallback(() => {
    stopListening();
    setTranscript("");
    setError(null);
    setStatus("idle");
  }, [stopListening]);

  return {
    status,
    isSupported,
    isListening: status === "listening" || status === "processing",
    transcript,
    error,
    startListening,
    stopListening,
    toggleListening,
    reset,
  };
}
