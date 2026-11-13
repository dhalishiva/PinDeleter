// AES-256-GCM token encryption (WebCrypto), hashing and random helpers.
// Ciphertext format: "v1.<base64url iv>.<base64url ciphertext+tag>"

const enc = new TextEncoder();
const dec = new TextDecoder();

export function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(value: string): Uint8Array {
  const b64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function fromBase64(value: string): Uint8Array {
  return fromBase64Url(value.trim());
}

const keyCache = new Map<string, Promise<CryptoKey>>();

export function importAesKey(base64Key: string): Promise<CryptoKey> {
  let cached = keyCache.get(base64Key);
  if (!cached) {
    const raw = fromBase64(base64Key);
    if (raw.length !== 32) {
      throw new Error(
        'TOKEN_ENCRYPTION_KEY must be 32 random bytes, base64 encoded (openssl rand -base64 32).',
      );
    }
    cached = crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
    keyCache.set(base64Key, cached);
  }
  return cached;
}

export async function encryptString(plaintext: string, base64Key: string): Promise<string> {
  const key = await importAesKey(base64Key);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext)));
  return `v1.${toBase64Url(iv)}.${toBase64Url(ct)}`;
}

export async function decryptString(payload: string, base64Key: string): Promise<string> {
  const [version, ivPart, ctPart] = payload.split('.');
  if (version !== 'v1' || !ivPart || !ctPart) throw new Error('Unsupported ciphertext format');
  const key = await importAesKey(base64Key);
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64Url(ivPart) },
    key,
    fromBase64Url(ctPart),
  );
  return dec.decode(pt);
}

export function randomToken(bytes = 32): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function hmacSha256Hex(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(value));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Constant-time string comparison. */
export function timingSafeEqual(a: string, b: string): boolean {
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  let diff = ab.length ^ bb.length;
  const len = Math.max(ab.length, bb.length);
  for (let i = 0; i < len; i++) diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
}
