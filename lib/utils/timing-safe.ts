import { timingSafeEqual, createHash } from "crypto";

/**
 * Constant-time string comparison to prevent timing attacks.
 * Uses SHA-256 hashing to normalize input lengths before comparison,
 * eliminating length-based timing leaks.
 */
export function timingSafeCompare(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  if (!a || !b) return false;

  // Hash both inputs to normalize to 32 bytes, preventing length-based leaks
  const aHash = createHash("sha256").update(a).digest();
  const bHash = createHash("sha256").update(b).digest();

  return timingSafeEqual(aHash, bHash);
}
