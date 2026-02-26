import { describe, it, expect, vi } from "vitest";
import { encrypt, decrypt } from "../auth-crypto";

describe("encrypt / decrypt", () => {
  const original = "correct horse battery staple";

  it("round-trips plaintext", () => {
    expect(decrypt(encrypt(original))).toBe(original);
  });

  it("produces different ciphertext each call (random IV)", () => {
    expect(encrypt(original)).not.toBe(encrypt(original));
  });

  it("decrypting wrong ciphertext throws", () => {
    expect(() => decrypt("not-valid-base64-ciphertext==")).toThrow();
  });

  it("uses FPL_CREDENTIALS_KEY env var when set", () => {
    const originalKey = process.env.FPL_CREDENTIALS_KEY;
    process.env.FPL_CREDENTIALS_KEY = "test-key";
    try {
      const ct = encrypt("hello");
      expect(decrypt(ct)).toBe("hello");
    } finally {
      if (originalKey === undefined) {
        delete process.env.FPL_CREDENTIALS_KEY;
      } else {
        process.env.FPL_CREDENTIALS_KEY = originalKey;
      }
    }
  });
});
