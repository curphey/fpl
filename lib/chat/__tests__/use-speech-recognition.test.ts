import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSpeechRecognition } from "../use-speech-recognition";

// Mock SpeechRecognition instance interface
interface MockRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onresult: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  abort: ReturnType<typeof vi.fn>;
  simulateResult: (transcript: string, isFinal?: boolean) => void;
  simulateError: (error: string) => void;
}

// Store reference to mock instance for test access
let mockRecognitionInstance: MockRecognitionInstance | null = null;

// Factory function to create mock SpeechRecognition instances
function createMockRecognition(): MockRecognitionInstance {
  const instance: MockRecognitionInstance = {
    continuous: false,
    interimResults: false,
    lang: "",
    maxAlternatives: 1,
    onresult: null,
    onerror: null,
    onstart: null,
    onend: null,
    start: vi.fn(() => {
      instance.onstart?.();
    }),
    stop: vi.fn(() => {
      instance.onend?.();
    }),
    abort: vi.fn(),
    simulateResult(transcript: string, isFinal = true) {
      instance.onresult?.({
        resultIndex: 0,
        results: {
          length: 1,
          item: () => ({
            length: 1,
            item: () => ({ transcript, confidence: 0.9 }),
            0: { transcript, confidence: 0.9 },
            isFinal,
          }),
          0: {
            length: 1,
            item: () => ({ transcript, confidence: 0.9 }),
            0: { transcript, confidence: 0.9 },
            isFinal,
          },
        },
      });
    },
    simulateError(error: string) {
      instance.onerror?.({ error });
    },
  };

  mockRecognitionInstance = instance;
  return instance;
}

// Mock constructor class
class MockSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onresult: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onspeechstart: (() => void) | null;
  onspeechend: (() => void) | null;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  abort: ReturnType<typeof vi.fn>;

  constructor() {
    const mock = createMockRecognition();
    this.continuous = mock.continuous;
    this.interimResults = mock.interimResults;
    this.lang = mock.lang;
    this.maxAlternatives = mock.maxAlternatives;
    this.onresult = mock.onresult;
    this.onerror = mock.onerror;
    this.onstart = mock.onstart;
    this.onend = mock.onend;
    this.onspeechstart = null;
    this.onspeechend = null;
    this.start = mock.start;
    this.stop = mock.stop;
    this.abort = mock.abort;

    // Sync instance properties with mock
    Object.defineProperty(mock, "continuous", {
      get: () => this.continuous,
      set: (v) => {
        this.continuous = v;
      },
    });
    Object.defineProperty(mock, "interimResults", {
      get: () => this.interimResults,
      set: (v) => {
        this.interimResults = v;
      },
    });
    Object.defineProperty(mock, "lang", {
      get: () => this.lang,
      set: (v) => {
        this.lang = v;
      },
    });
    Object.defineProperty(mock, "onstart", {
      get: () => this.onstart,
      set: (v) => {
        this.onstart = v;
      },
    });
    Object.defineProperty(mock, "onend", {
      get: () => this.onend,
      set: (v) => {
        this.onend = v;
      },
    });
    Object.defineProperty(mock, "onresult", {
      get: () => this.onresult,
      set: (v) => {
        this.onresult = v;
      },
    });
    Object.defineProperty(mock, "onerror", {
      get: () => this.onerror,
      set: (v) => {
        this.onerror = v;
      },
    });
  }
}

describe("useSpeechRecognition", () => {
  beforeEach(() => {
    mockRecognitionInstance = null;
    // @ts-expect-error - mocking browser API
    window.SpeechRecognition = MockSpeechRecognition;
    // @ts-expect-error - mocking browser API
    window.webkitSpeechRecognition = MockSpeechRecognition;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    mockRecognitionInstance = null;
    // @ts-expect-error - cleanup
    delete window.SpeechRecognition;
    // @ts-expect-error - cleanup
    delete window.webkitSpeechRecognition;
  });

  describe("browser support", () => {
    it("reports supported when SpeechRecognition is available", () => {
      const { result } = renderHook(() => useSpeechRecognition());

      expect(result.current.isSupported).toBe(true);
      expect(result.current.status).toBe("idle");
    });

    it("reports unsupported when SpeechRecognition is not available", () => {
      // @ts-expect-error - cleanup
      delete window.SpeechRecognition;
      // @ts-expect-error - cleanup
      delete window.webkitSpeechRecognition;

      const { result } = renderHook(() => useSpeechRecognition());

      expect(result.current.isSupported).toBe(false);
      expect(result.current.status).toBe("unsupported");
    });
  });

  describe("listening state", () => {
    it("starts listening when startListening is called", () => {
      const { result } = renderHook(() => useSpeechRecognition());

      act(() => {
        result.current.startListening();
      });

      expect(mockRecognitionInstance?.start).toHaveBeenCalled();
      expect(result.current.status).toBe("listening");
      expect(result.current.isListening).toBe(true);
    });

    it("stops listening when stopListening is called", () => {
      const { result } = renderHook(() => useSpeechRecognition());

      act(() => {
        result.current.startListening();
      });

      act(() => {
        result.current.stopListening();
      });

      expect(mockRecognitionInstance?.stop).toHaveBeenCalled();
      expect(result.current.status).toBe("idle");
      expect(result.current.isListening).toBe(false);
    });

    it("toggles listening state", () => {
      const { result } = renderHook(() => useSpeechRecognition());

      // Start
      act(() => {
        result.current.toggleListening();
      });
      expect(result.current.isListening).toBe(true);

      // Stop
      act(() => {
        result.current.toggleListening();
      });
      expect(result.current.isListening).toBe(false);
    });
  });

  describe("transcript handling", () => {
    it("captures final transcript", () => {
      const onTranscript = vi.fn();
      const { result } = renderHook(() =>
        useSpeechRecognition({ onTranscript }),
      );

      act(() => {
        result.current.startListening();
      });

      act(() => {
        mockRecognitionInstance?.simulateResult("who should I captain", true);
      });

      expect(result.current.transcript).toContain("who should I captain");
      expect(onTranscript).toHaveBeenCalledWith("who should I captain", true);
    });

    it("captures interim transcript", () => {
      const onTranscript = vi.fn();
      const { result } = renderHook(() =>
        useSpeechRecognition({ onTranscript, interimResults: true }),
      );

      act(() => {
        result.current.startListening();
      });

      act(() => {
        mockRecognitionInstance?.simulateResult("who should", false);
      });

      expect(onTranscript).toHaveBeenCalledWith("who should", false);
      expect(result.current.status).toBe("processing");
    });

    it("clears transcript on reset", () => {
      const { result } = renderHook(() => useSpeechRecognition());

      act(() => {
        result.current.startListening();
      });

      act(() => {
        mockRecognitionInstance?.simulateResult("some transcript", true);
      });

      act(() => {
        result.current.reset();
      });

      expect(result.current.transcript).toBe("");
      expect(result.current.status).toBe("idle");
    });
  });

  describe("error handling", () => {
    it("handles not-allowed error", () => {
      const onError = vi.fn();
      const { result } = renderHook(() => useSpeechRecognition({ onError }));

      act(() => {
        result.current.startListening();
      });

      act(() => {
        mockRecognitionInstance?.simulateError("not-allowed");
      });

      expect(result.current.status).toBe("error");
      expect(result.current.error).toContain("Microphone access denied");
      expect(onError).toHaveBeenCalled();
    });

    it("handles no-speech error", () => {
      const onError = vi.fn();
      const { result } = renderHook(() => useSpeechRecognition({ onError }));

      act(() => {
        result.current.startListening();
      });

      act(() => {
        mockRecognitionInstance?.simulateError("no-speech");
      });

      expect(result.current.status).toBe("error");
      expect(result.current.error).toContain("No speech detected");
    });

    it("handles audio-capture error", () => {
      const onError = vi.fn();
      const { result } = renderHook(() => useSpeechRecognition({ onError }));

      act(() => {
        result.current.startListening();
      });

      act(() => {
        mockRecognitionInstance?.simulateError("audio-capture");
      });

      expect(result.current.status).toBe("error");
      expect(result.current.error).toContain("No microphone found");
    });

    it("handles network error", () => {
      const onError = vi.fn();
      const { result } = renderHook(() => useSpeechRecognition({ onError }));

      act(() => {
        result.current.startListening();
      });

      act(() => {
        mockRecognitionInstance?.simulateError("network");
      });

      expect(result.current.status).toBe("error");
      expect(result.current.error).toContain("Network error");
    });

    it("handles aborted gracefully without error", () => {
      const onError = vi.fn();
      const { result } = renderHook(() => useSpeechRecognition({ onError }));

      act(() => {
        result.current.startListening();
      });

      act(() => {
        mockRecognitionInstance?.simulateError("aborted");
      });

      expect(result.current.status).toBe("idle");
      expect(result.current.error).toBeNull();
      expect(onError).not.toHaveBeenCalled();
    });

    it("clears error on reset", () => {
      const { result } = renderHook(() => useSpeechRecognition());

      act(() => {
        result.current.startListening();
      });

      act(() => {
        mockRecognitionInstance?.simulateError("no-speech");
      });

      expect(result.current.error).not.toBeNull();

      act(() => {
        result.current.reset();
      });

      expect(result.current.error).toBeNull();
      expect(result.current.status).toBe("idle");
    });
  });

  describe("configuration", () => {
    it("uses provided language", () => {
      renderHook(() => useSpeechRecognition({ language: "en-US" }));

      expect(mockRecognitionInstance?.lang).toBe("en-US");
    });

    it("defaults to en-GB language", () => {
      renderHook(() => useSpeechRecognition());

      expect(mockRecognitionInstance?.lang).toBe("en-GB");
    });

    it("configures continuous mode", () => {
      renderHook(() => useSpeechRecognition());

      expect(mockRecognitionInstance?.continuous).toBe(true);
    });

    it("configures interim results", () => {
      renderHook(() => useSpeechRecognition({ interimResults: true }));

      expect(mockRecognitionInstance?.interimResults).toBe(true);
    });
  });

  describe("cleanup", () => {
    it("aborts recognition on unmount", () => {
      const { unmount } = renderHook(() => useSpeechRecognition());

      unmount();

      expect(mockRecognitionInstance?.abort).toHaveBeenCalled();
    });
  });
});
