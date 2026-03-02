import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
} from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

let _key: Buffer | null = null;

function getKeyFilePath(): string {
  const dbPath = process.env.DATABASE_PATH ?? "./data/fpl.db";
  return resolve(dirname(dbPath), ".credentials-key");
}

function deriveKey(): Buffer {
  if (_key) return _key;

  const envKey = process.env.FPL_CREDENTIALS_KEY;
  if (envKey) {
    _key = createHash("sha256").update(envKey).digest();
    return _key;
  }

  // Zero-config fallback: persist a random key so it survives restarts
  const keyFile = getKeyFilePath();
  if (existsSync(keyFile)) {
    _key = Buffer.from(readFileSync(keyFile, "utf8").trim(), "hex");
    return _key;
  }

  const newKey = randomBytes(32);
  mkdirSync(dirname(keyFile), { recursive: true });
  writeFileSync(keyFile, newKey.toString("hex"), { mode: 0o600 });
  console.warn(
    `[FPL Auth] FPL_CREDENTIALS_KEY not set — generated a random encryption key at ${keyFile}. ` +
      "Set FPL_CREDENTIALS_KEY in your environment for explicit key management.",
  );
  _key = newKey;
  return _key;
}

export function encrypt(plaintext: string): string {
  const key = deriveKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decrypt(ciphertext: string): string {
  const key = deriveKey();
  const buf = Buffer.from(ciphertext, "base64");
  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = buf.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: TAG_LENGTH,
  });
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
    "utf8",
  );
}

/** Reset the cached key — used in tests only */
export function _resetKeyCache(): void {
  _key = null;
}
