import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/api/rate-limit", () => ({
  rateLimit: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/db/gw-plan", () => ({
  getTransferPredictions: vi.fn(),
}));

import { GET } from "../gw-plan/predictions/route";
import { getTransferPredictions } from "@/lib/db/gw-plan";
import { rateLimit } from "@/lib/api/rate-limit";

const mockGetTransferPredictions = vi.mocked(getTransferPredictions);
const mockRateLimit = vi.mocked(rateLimit);

describe("GET /api/gw-plan/predictions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 when sessionId is missing", async () => {
    const req = new NextRequest("http://localhost/api/gw-plan/predictions");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("returns 200 with predictions array when sessionId is valid", async () => {
    const predictions = [
      {
        id: "pred1",
        sessionId: "sess1",
        gameweek: 28,
        playerOutId: 100,
        playerOutName: "Saka",
        playerInId: 200,
        playerInName: "Palmer",
        pointsGain: 8,
        reasoning: "good form",
        predictedAt: "2026-02-25",
        actualPointsDiff: null,
      },
    ];
    mockGetTransferPredictions.mockReturnValue(predictions as never);

    const req = new NextRequest(
      "http://localhost/api/gw-plan/predictions?sessionId=sess1",
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.predictions).toEqual(predictions);
  });

  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockResolvedValue(
      new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429,
      }) as never,
    );

    const req = new NextRequest(
      "http://localhost/api/gw-plan/predictions?sessionId=sess1",
    );
    const res = await GET(req);
    expect(res.status).toBe(429);
  });
});
