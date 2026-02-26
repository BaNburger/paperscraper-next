import { describe, expect, it } from 'vitest';
import { decryptSecret, encryptSecret, loadOptionalMasterKey } from './crypto';

describe('crypto', () => {
  it('loads an optional base64 master key', () => {
    const raw = Buffer.alloc(32, 7);
    const key = loadOptionalMasterKey(raw.toString('base64'));
    expect(key).not.toBeNull();
    expect(key?.length).toBe(32);
  });

  it('encrypts and decrypts with enc:v1 envelope', () => {
    const key = Buffer.alloc(32, 11);
    const encrypted = encryptSecret('sk-test', key);
    expect(encrypted.startsWith('enc:v1:')).toBe(true);
    expect(decryptSecret(encrypted, key)).toBe('sk-test');
  });

  it('rejects malformed keys', () => {
    expect(() => loadOptionalMasterKey(Buffer.alloc(12).toString('base64'))).toThrowError();
  });
});
