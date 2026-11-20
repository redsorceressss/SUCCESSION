/**
 * Web Crypto API ECDSA P-256 Digital Signing
 * Provides offline non-repudiation by signing canonical transaction payloads.
 */

import { canonicalJson } from './queue.js';
import { getItem, putItem } from './db.js';

const KEY_PAIR_STORAGE_KEY = 'user_signing_keypair_p256';

/**
 * Generate or retrieve the device's ECDSA P-256 keypair
 */
export async function getOrCreateSigningKey() {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('Web Crypto API (crypto.subtle) is not supported in this environment');
  }

  // Check if existing keys are stored in IndexedDB
  const cached = await getItem('cached_transactions', KEY_PAIR_STORAGE_KEY);
  if (cached && cached.publicKeyJwk && cached.privateKeyJwk) {
    const publicKey = await crypto.subtle.importKey(
      'jwk',
      cached.publicKeyJwk,
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['verify']
    );
    const privateKey = await crypto.subtle.importKey(
      'jwk',
      cached.privateKeyJwk,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign']
    );
    return { publicKey, privateKey, publicKeyJwk: cached.publicKeyJwk };
  }

  // Generate new keypair
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify']
  );

  const publicKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
  const privateKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);

  await putItem('cached_transactions', {
    id: KEY_PAIR_STORAGE_KEY,
    publicKeyJwk,
    privateKeyJwk,
    created_at: new Date().toISOString(),
  });

  return { publicKey: keyPair.publicKey, privateKey: keyPair.privateKey, publicKeyJwk };
}

/**
 * Sign an arbitrary payload object using ECDSA P-256
 * @returns {Promise<string>} Hex-encoded signature
 */
export async function signPayload(payload) {
  const { privateKey } = await getOrCreateSigningKey();
  const canon = canonicalJson(payload);
  const encoder = new TextEncoder();
  const data = encoder.encode(canon);

  const signatureBuffer = await crypto.subtle.sign(
    { name: 'ECDSA', hash: { name: 'SHA-256' } },
    privateKey,
    data
  );

  const hashArray = Array.from(new Uint8Array(signatureBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify a signature against a payload using a JWK public key
 */
export async function verifySignature(payload, hexSignature, publicKeyJwk) {
  const publicKey = await crypto.subtle.importKey(
    'jwk',
    publicKeyJwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify']
  );

  const canon = canonicalJson(payload);
  const data = new TextEncoder().encode(canon);

  // Convert hex back to Uint8Array
  const bytes = new Uint8Array(hexSignature.length / 2);
  for (let i = 0; i < hexSignature.length; i += 2) {
    bytes[i / 2] = parseInt(hexSignature.substring(i, i + 2), 16);
  }

  return await crypto.subtle.verify(
    { name: 'ECDSA', hash: { name: 'SHA-256' } },
    publicKey,
    bytes.buffer,
    data
  );
}
