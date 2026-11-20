/**
 * Cross-Check Test: Verifies JavaScript canonical JSON and SHA-256 hash
 * matches tests/vectors/hash_vectors.json exactly.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import canonicalJson from queue.js
import { canonicalJson } from '../frontend/js/offline/queue.js';
import { HashService } from '../frontend/js/services/hash_service.js';

const vectorPath = path.resolve(__dirname, 'vectors', 'hash_vectors.json');
const vectors = JSON.parse(fs.readFileSync(vectorPath, 'utf8'));

console.log(`Running cross-check for ${vectors.length} hash vectors...`);

for (let i = 0; i < vectors.length; i++) {
  const vec = vectors[i];
  const canon = canonicalJson(vec.payload);

  if (canon !== vec.canonical_json) {
    console.error(`Vector ${i} failed canonical JSON!`);
    console.error(`Expected: ${vec.canonical_json}`);
    console.error(`Got:      ${canon}`);
    process.exit(1);
  }

  // Calculate SHA-256 (combined prev_hash + canon)
  const combined = vec.prev_hash + canon;
  const hash = crypto.createHash('sha256').update(combined).digest('hex');

  if (hash !== vec.expected_hash) {
    console.error(`Vector ${i} failed hash verification!`);
    console.error(`Expected: ${vec.expected_hash}`);
    console.error(`Got:      ${hash}`);
    process.exit(1);
  }

  console.log(`✓ Vector ${i + 1} (${vec.description}): MATCH`);
}

console.log('ALL HASH VECTORS VERIFIED SUCCESSFULLY IN JS!');
