/**
 * Test Frontend Offline QR & Validators
 */

import { buildQrHandshake, verifyQrHandshake } from '../frontend/js/offline/qr.js';
import { Validators } from '../frontend/js/validators.js';

console.log('Testing QR Handshake build & verify...');
const qrStr = buildQrHandshake({
  transactionId: 101,
  versionNo: 2,
  versionHash: 'abcdef0123456789',
  userId: 5,
  role: 'karigar',
});

const { ok, data, error } = verifyQrHandshake(qrStr);
if (!ok) {
  console.error('QR verification failed:', error);
  process.exit(1);
}
if (data.tx !== 101 || data.ver !== 2 || data.vh !== 'abcdef0123456789' || data.u !== 5 || data.r !== 'karigar') {
  console.error('QR field mismatch:', data);
  process.exit(1);
}
console.log('✓ QR Handshake matches schema');

console.log('Testing Decimal Validators...');
if (!Validators.isValidWeight('50.0000')) throw new Error('50.0000 should be valid');
if (!Validators.isValidWeight('49.85')) throw new Error('49.85 should be valid');
if (Validators.isValidWeight('-10.00')) throw new Error('Negative weight should fail');
if (Validators.isValidWeight('50.12345')) throw new Error('5 decimal places should fail');

const diff = Validators.decimalSubtract('50.0000', '49.8500');
if (diff !== '0.1500') {
  throw new Error(`decimalSubtract expected 0.1500, got ${diff}`);
}
console.log(`✓ String-based decimal subtraction exact: 50.0000 - 49.8500 = ${diff}`);

console.log('ALL FRONTEND TESTS PASSED!');
