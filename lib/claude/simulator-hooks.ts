/**
 * React hooks for Claude AI simulation and analysis features
 */

import { useState, useCallback } from "react";
import type {
  SimulationRequest,
  SimulationResponse,
  RivalAnalysisRequest,
  RivalAnalysisResponse,
  InjuryPredictionRequest,
  InjuryPredictionResponse,
} from "./simulator-types";

// =============================================================================
// GW Decision Simulator Hook
// =============================================================================

interface UseSimulationResult {
  simulate: (request: SimulationRequest) => Promise<void>;
  response: SimulationResponse | null;
  isLoading: boolean;
  error: string | null;
  reset: () => void;
}

export function useSimulation(): UseSimulationResult {
  const [response, setResponse] = useState<SimulationResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const simulate = useCallback(async (request: SimulationRequest) => {
    setIsLoading(true);
    setError(null);
    setResponse(null);

    try {
      const res = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Simulation failed");
      }

      setResponse(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResponse(null);
    setError(null);
  }, []);

  return { simulate, response, isLoading, error, reset };
}

// =============================================================================
// Rival Analysis Hook
// =============================================================================

interface UseRivalAnalysisResult {
  analyze: (request: RivalAnalysisRequest) => Promise<void>;
  response: RivalAnalysisResponse | null;
  isLoading: boolean;
  error: string | null;
  reset: () => void;
}

export function useRivalAnalysis(): UseRivalAnalysisResult {
  const [response, setResponse] = useState<RivalAnalysisResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(async (request: RivalAnalysisRequest) => {
    setIsLoading(true);
    setError(null);
    setResponse(null);

    try {
      const res = await fetch("/api/rival-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Analysis failed");
      }

      setResponse(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResponse(null);
    setError(null);
  }, []);

  return { analyze, response, isLoading, error, reset };
}

// =============================================================================
// Injury Prediction Hook
// =============================================================================

interface UseInjuryPredictionResult {
  predict: (request: InjuryPredictionRequest) => Promise<void>;
  response: InjuryPredictionResponse | null;
  isLoading: boolean;
  error: string | null;
  reset: () => void;
}

export function useInjuryPrediction(): UseInjuryPredictionResult {
  const [response, setResponse] = useState<InjuryPredictionResponse | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const predict = useCallback(async (request: InjuryPredictionRequest) => {
    setIsLoading(true);
    setError(null);
    setResponse(null);

    try {
      const res = await fetch("/api/injury-prediction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Prediction failed");
      }

      setResponse(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResponse(null);
    setError(null);
  }, []);

  return { predict, response, isLoading, error, reset };
}
