import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ENCRYPTION_PREFIX = 'enc:v1:';
const CIPHER_ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;

function decodeMasterKey(encoded: string): Buffer {
  const key = Buffer.from(encoded, 'base64');
  if (key.length !== 32) {
    throw new Error('SECRETS_MASTER_KEY must be base64-encoded 32 bytes.');
  }
  return key;
}

function parseEncryptedPayload(value: string): {
  iv: Buffer;
  authTag: Buffer;
  ciphertext: Buffer;
} {
  if (!value.startsWith(ENCRYPTION_PREFIX)) {
    throw new Error('Encrypted secret must start with enc:v1:.');
  }
  const parts = value.slice(ENCRYPTION_PREFIX.length).split(':');
  if (parts.length !== 3) {
    throw new Error('Encrypted secret payload format is invalid.');
  }
  const [iv, authTag, ciphertext] = parts as [string, string, string];
  return {
    iv: Buffer.from(iv, 'base64'),
    authTag: Buffer.from(authTag, 'base64'),
    ciphertext: Buffer.from(ciphertext, 'base64'),
  };
}

export function loadOptionalMasterKey(value: string | undefined): Buffer | null {
  if (!value || !value.trim()) {
    return null;
  }
  return decodeMasterKey(value.trim());
}

export function encryptSecret(plaintext: string, key: Buffer): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(CIPHER_ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${ENCRYPTION_PREFIX}${iv.toString('base64')}:${authTag.toString('base64')}:${ciphertext.toString('base64')}`;
}

export function decryptSecret(payload: string, key: Buffer): string {
  const parsed = parseEncryptedPayload(payload);
  const decipher = createDecipheriv(CIPHER_ALGORITHM, key, parsed.iv);
  decipher.setAuthTag(parsed.authTag);
  const plaintext = Buffer.concat([
    decipher.update(parsed.ciphertext),
    decipher.final(),
  ]);
  return plaintext.toString('utf8');
}
