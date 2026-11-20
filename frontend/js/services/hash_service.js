/**
 * Hash Verification and Integrity Service
 * Implements canonical JSON serialization and SHA-256 chaining matching core_engine.integrity.
 */

import { canonicalJson, sha256 } from '../offline/queue.js';

export const GENESIS = '0'.repeat(64);

export const HashService = {
  canonical(obj) {
    return canonicalJson(obj);
  },

  async calculateHash(prevHash, payload) {
    const canon = this.canonical(payload);
    // Python: hashlib.sha256(prev_hash.encode("ascii") + canonical(payload)).hexdigest()
    const combined = prevHash + canon;
    return await sha256(combined);
  },

  async verifyChain(entries) {
    let prev = GENESIS;
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      if (e.prev_hash !== prev) {
        return { ok: false, breakIndex: i, reason: 'Broken previous hash reference' };
      }
      const calculated = await this.calculateHash(prev, e.payload);
      if (calculated !== e.hash) {
        return { ok: false, breakIndex: i, reason: 'Hash mismatch: entry payload tampered' };
      }
      prev = e.hash;
    }
    return { ok: true, breakIndex: null };
  },
};
