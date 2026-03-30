import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const SALT_LENGTH = 16;
const TAG_LENGTH = 16;

let cachedKey: Buffer | null = null;
let cachedRawKey: string | null = null;

function deriveKey(masterKey: string): Buffer {
  // Cache the derived key to avoid repeated scrypt calls
  if (cachedKey && cachedRawKey === masterKey) return cachedKey;
  // Use a fixed salt derived from the key itself for deterministic derivation
  const salt = Buffer.from(masterKey).subarray(0, SALT_LENGTH);
  cachedKey = scryptSync(masterKey, salt, KEY_LENGTH);
  cachedRawKey = masterKey;
  return cachedKey;
}

function getMasterKey(): string {
  const key = process.env['NFL_SETTINGS_MASTER_KEY'];
  if (!key || key.trim().length === 0) {
    throw new Error('NFL_SETTINGS_MASTER_KEY is not set — cannot encrypt/decrypt secrets');
  }
  return key.trim();
}

export function isSecretCryptoAvailable(): boolean {
  const key = process.env['NFL_SETTINGS_MASTER_KEY'];
  return Boolean(key && key.trim().length > 0);
}

export function encryptSecret(plaintext: string): string {
  const masterKey = getMasterKey();
  const key = deriveKey(masterKey);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: base64(iv + tag + ciphertext)
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

export function decryptSecret(ciphertext: string): string {
  const masterKey = getMasterKey();
  const key = deriveKey(masterKey);
  const data = Buffer.from(ciphertext, 'base64');
  if (data.length < IV_LENGTH + TAG_LENGTH) {
    throw new Error('Invalid ciphertext: too short');
  }
  const iv = data.subarray(0, IV_LENGTH);
  const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = data.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  try {
    return decipher.update(encrypted) + decipher.final('utf8');
  } catch {
    throw new Error(
      'Failed to decrypt secret — the master key may have changed. ' +
        'Re-enter the secret through the admin UI to re-encrypt with the current key.',
    );
  }
}
