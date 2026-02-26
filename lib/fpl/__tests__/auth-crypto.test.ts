import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// vi.mock is hoisted; use vi.hoisted to share mock refs with the rest of the file
const { mockExistsSync, mockMkdirSync, mockReadFileSync, mockWriteFileSync } =
  vi.hoisted(() => ({
    mockExistsSync: vi.fn().mockReturnValue(false),
    mockMkdirSync: vi.fn(),
    mockReadFileSync: vi.fn(),
    mockWriteFileSync: vi.fn(),
  }));

vi.mock("fs", () => ({
  default: {
    existsSync: mockExistsSync,
    mkdirSync: mockMkdirSync,
    readFileSync: mockReadFileSync,
    writeFileSync: mockWriteFileSync,
  },
  existsSync: mockExistsSync,
  mkdirSync: mockMkdirSync,
  readFileSync: mockReadFileSync,
  writeFileSync: mockWriteFileSync,
}));

import { encrypt, decrypt, _resetKeyCache } from "../auth-crypto";

const IV_LENGTH = 12;
const TAG_LENGTH = 16;

beforeEach(() => {
  _resetKeyCache();
  delete process.env.FPL_CREDENTIALS_KEY;
  mockExistsSync.mockReturnValue(false);
  mockWriteFileSync.mockClear();
  mockReadFileSync.mockReset();
});

afterEach(() => {
  _resetKeyCache();
  delete process.env.FPL_CREDENTIALS_KEY;
});

describe("encrypt / decrypt", () => {
  const original = "correct horse battery staple";

  it("round-trips plaintext", () => {
    expect(decrypt(encrypt(original))).toBe(original);
  });

  it("produces different ciphertext each call (random IV)", () => {
    expect(encrypt(original)).not.toBe(encrypt(original));
  });

  it("decrypting invalid ciphertext throws", () => {
    // A valid-length base64 blob with a bad auth tag
    const fakeIv = Buffer.alloc(IV_LENGTH, 0);
    const fakeTag = Buffer.alloc(TAG_LENGTH, 0);
    const fakePayload = Buffer.alloc(4, 0);
    const fakeCt = Buffer.concat([fakeIv, fakeTag, fakePayload]).toString(
      "base64",
    );
    expect(() => decrypt(fakeCt)).toThrow();
  });

  it("throws when ciphertext is tampered (auth tag fails)", () => {
    const ct = encrypt("authentic message");
    const buf = Buffer.from(ct, "base64");
    // Flip a bit in the ciphertext payload (after IV + tag)
    buf[IV_LENGTH + TAG_LENGTH] ^= 0xff;
    expect(() => decrypt(buf.toString("base64"))).toThrow();
  });

  it("uses FPL_CREDENTIALS_KEY env var when set", () => {
    process.env.FPL_CREDENTIALS_KEY = "test-key-for-unit-tests";
    const ct = encrypt("hello");
    expect(decrypt(ct)).toBe("hello");
  });

  it("generates and persists a random key when env var absent", () => {
    // First call: no key file exists — generates one and writes it
    mockExistsSync.mockReturnValue(false);
    const ct = encrypt("stored value");

    // The written hex key should have been captured by writeFileSync
    const writtenHex = mockWriteFileSync.mock.calls[0]?.[1] as string;
    expect(writtenHex).toBeTruthy();
    expect(writtenHex).toMatch(/^[0-9a-f]{64}$/);

    // Simulate restart: clear cache, now the key file exists and returns the written key
    _resetKeyCache();
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(writtenHex);
    expect(decrypt(ct)).toBe("stored value");
  });
});
