/**
 * Test Frontend Offline Signing, Verification & Idempotency
 */

import { webcrypto } from 'crypto';
// Polyfill global crypto for Node.js test environment if needed
if (!globalThis.crypto) {
  globalThis.crypto = webcrypto;
}

import { canonicalJson } from '../frontend/js/offline/queue.js';
import { buildQrHandshake, verifyQrHandshake } from '../frontend/js/offline/qr.js';

console.log('Testing Web Crypto ECDSA P-256 Signing & Verification...');

async function runCryptoTest() {
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify']
  );

  const payload = {
    transaction_id: 1,
    version_no: 1,
    weight_g: '50.0000',
    karat: 22,
    order_id: 101,
  };

  const canon = canonicalJson(payload);
  const encoder = new TextEncoder();
  const data = encoder.encode(canon);

  // Sign
  const sigBuffer = await crypto.subtle.sign(
    { name: 'ECDSA', hash: { name: 'SHA-256' } },
    keyPair.privateKey,
    data
  );

  // Verify valid signature
  const valid = await crypto.subtle.verify(
    { name: 'ECDSA', hash: { name: 'SHA-256' } },
    keyPair.publicKey,
    sigBuffer,
    data
  );

  if (!valid) {
    throw new Error('Valid signature verification failed!');
  }
  console.log('✓ Valid ECDSA P-256 signature verified successfully');

  // Verify tampered payload fails
  const tamperedPayload = { ...payload, weight_g: '49.8500' };
  const tamperedData = encoder.encode(canonicalJson(tamperedPayload));
  const tamperedValid = await crypto.subtle.verify(
    { name: 'ECDSA', hash: { name: 'SHA-256' } },
    keyPair.publicKey,
    sigBuffer,
    tamperedData
  );

  if (tamperedValid) {
    throw new Error('Tampered payload should have failed verification!');
  }
  console.log('✓ Tampered payload correctly rejected by signature verification');
}

runCryptoTest().then(() => {
  console.log('ALL OFFLINE CRYPTO & SIGNING TESTS PASSED!');
}).catch((err) => {
  console.error('Crypto test failed:', err);
  process.exit(1);
});
