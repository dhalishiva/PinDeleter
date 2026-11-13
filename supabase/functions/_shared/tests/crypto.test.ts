import {
  decryptString,
  encryptString,
  fromBase64Url,
  randomToken,
  timingSafeEqual,
  toBase64Url,
} from '../crypto.ts';
import { assert, assertEquals, assertNotEquals, assertRejects } from './assert.ts';

const key = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));

Deno.test('AES-GCM round-trip', async () => {
  const secret = 'pina_' + 'x'.repeat(120);
  const enc = await encryptString(secret, key);
  assert(enc.startsWith('v1.'));
  assert(!enc.includes(secret));
  assertEquals(await decryptString(enc, key), secret);
});

Deno.test('AES-GCM uses a fresh IV per encryption', async () => {
  const a = await encryptString('same', key);
  const b = await encryptString('same', key);
  assertNotEquals(a, b);
});

Deno.test('AES-GCM rejects tampered ciphertext and wrong keys', async () => {
  const enc = await encryptString('token', key);
  const [v, iv, ct] = enc.split('.');
  const bytes = fromBase64Url(ct!);
  bytes[0] = bytes[0]! ^ 1;
  await assertRejects(() => decryptString(`${v}.${iv}.${toBase64Url(bytes)}`, key));
  const other = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
  await assertRejects(() => decryptString(enc, other));
});

Deno.test('rejects keys that are not 32 bytes', async () => {
  await assertRejects(() => encryptString('x', btoa('short')));
});

Deno.test('randomToken is base64url of the requested size', () => {
  const t = randomToken(32);
  assert(/^[A-Za-z0-9_-]+$/.test(t));
  assertEquals(fromBase64Url(t).length, 32);
});

Deno.test('timingSafeEqual', () => {
  assert(timingSafeEqual('abc', 'abc'));
  assert(!timingSafeEqual('abc', 'abd'));
  assert(!timingSafeEqual('abc', 'abcd'));
});
