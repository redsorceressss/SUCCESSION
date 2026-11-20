/**
 * Offline Operations Queue
 * Manages pending actions when disconnected.
 * Guarantees idempotency via UUID client_id and SHA-256 payload tracking.
 */

import { putItem, getItem, getAllItems, deleteItem } from './db.js';

export function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Canonical JSON serialization matching Python core_engine.integrity.canonical
 */
export function canonicalJson(obj) {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalJson).join(',') + ']';
  }
  const keys = Object.keys(obj).sort();
  const parts = keys.map((k) => JSON.stringify(k) + ':' + canonicalJson(obj[k]));
  return '{' + parts.join(',') + '}';
}

/**
 * SHA-256 hash using Web Crypto API
 */
export async function sha256(str) {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const buffer = new TextEncoder().encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback if crypto.subtle unavailable (pure JS minimal sha256 or mock)
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(64, '0');
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof FormData);
}

/**
 * Enqueue an operation to pending_ops.
 * Only JSON-serializable payloads can be safely persisted and replayed.
 */
export async function enqueueOp({ endpoint, method, payload, kind = 'api_request' }) {
  if (typeof FormData !== 'undefined' && payload instanceof FormData) {
    throw new Error('Offline queue does not support file uploads or multipart payloads');
  }
  if (payload !== null && payload !== undefined && !isPlainObject(payload) && !Array.isArray(payload)) {
    throw new Error('Offline queue supports only JSON object payloads');
  }

  const id = generateUUID();
  const payloadBase = payload == null ? {} : structuredClone(payload);
  // Preserve a stable operation id for replay/idempotency handling.
  payloadBase._offline_op_id = payloadBase._offline_op_id || id;
  if ('client_id' in payloadBase && !payloadBase.client_id) {
    payloadBase.client_id = payloadBase._offline_op_id;
  }
  if ('idempotency_key' in payloadBase && !payloadBase.idempotency_key) {
    payloadBase.idempotency_key = payloadBase._offline_op_id;
  }

  const canon = canonicalJson(payloadBase);
  const hash = await sha256(canon);

  const op = {
    id,
    endpoint,
    method: String(method || 'POST').toUpperCase(),
    payload: payloadBase,
    hash,
    kind,
    timestamp: new Date().toISOString(),
    retries: 0,
    status: 'PENDING',
    lastError: null,
  };

  await putItem('pending_ops', op);
  return op;
}

export const AUTO_REPLAY_STATUSES = new Set(['PENDING', 'RETRYING']);
export const ATTENTION_STATUSES = new Set(['CONFLICT', 'FAILED', 'AUTH_REQUIRED']);
export const ACKNOWLEDGED_STATUSES = new Set(['CONFIRMED', 'ALREADY_EXISTS']);

function sortByTimestamp(items) {
  return [...items].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

function isRetryEligible(op, nowMs = Date.now()) {
  if (!op || op.status !== 'RETRYING') return true;
  if (!op.nextAttemptAt) return true;
  const ts = Date.parse(op.nextAttemptAt);
  if (Number.isNaN(ts)) return true; // malformed metadata should not permanently strand an eligible retry record
  return ts <= nowMs;
}

/**
 * Automatically replayable operations only (normal sync scope).
 * RETRYING operations with a future nextAttemptAt are excluded until eligible.
 */
export async function getPendingOps(nowMs = Date.now()) {
  const items = await getAllItems('pending_ops');
  return sortByTimestamp(
    items.filter((op) => AUTO_REPLAY_STATUSES.has(op.status) && isRetryEligible(op, nowMs))
  );
}

/**
 * Durable acknowledged operation count from sync_log (read-only).
 * Counts unique op_ids with at least one CONFIRMED or ALREADY_EXISTS outcome.
 * Excludes conflict/failed/auth-required/retry/transient log entries.
 */
export async function getAcknowledgedSyncCount() {
  try {
    const logs = await getAllItems('sync_log');
    if (!Array.isArray(logs) || logs.length === 0) return 0;
    const acked = new Set();
    for (const entry of logs) {
      const status = entry?.status;
      const opId = entry?.op_id;
      if (!opId) continue;
      if (status === 'CONFIRMED' || status === 'ALREADY_EXISTS') {
        acked.add(opId);
      }
    }
    return acked.size;
  } catch (e) {
    console.warn('Could not read sync_log for acknowledged count:', e);
    return null; // unavailable; callers must not fabricate a count
  }
}

/**
 * Alias for clarity in callers that need auto-replay eligibility semantics.
 */
export async function getAutoReplayOps(nowMs = Date.now()) {
  return getPendingOps(nowMs);
}

/**
 * Operations requiring user/explicit attention (not auto-replayed).
 */
export async function getAttentionOps() {
  const items = await getAllItems('pending_ops');
  return sortByTimestamp(items.filter((op) => ATTENTION_STATUSES.has(op.status)));
}

/**
 * Queue summary for UI/reporting. Queue-state counts reflect stored pending_ops state.
 * "acknowledged" is a durable unique count from sync_log (CONFIRMED/ALREADY_EXISTS op_ids),
 * not a fabricated count from removed queue entries. It may be null if sync_log is unavailable.
 */
export async function getQueueSummary(nowMs = Date.now()) {
  const items = await getAllItems('pending_ops');
  const summary = {
    total: items.length,
    autoReplayable: 0,
    pending: 0,
    retrying: 0,
    retryingScheduled: 0,
    conflict: 0,
    failed: 0,
    authRequired: 0,
    acknowledged: 0,
    acknowledgedAvailable: true,
    attention: 0,
  };
  for (const op of items) {
    const s = op?.status;
    if (s === 'PENDING') { summary.pending++; summary.autoReplayable++; }
    else if (s === 'RETRYING') {
      summary.retrying++;
      if (isRetryEligible(op, nowMs)) summary.autoReplayable++;
      else summary.retryingScheduled++;
    }
    else if (s === 'CONFLICT') { summary.conflict++; summary.attention++; }
    else if (s === 'FAILED') { summary.failed++; summary.attention++; }
    else if (s === 'AUTH_REQUIRED') { summary.authRequired++; summary.attention++; }
    else if (ACKNOWLEDGED_STATUSES.has(s)) { /* queue-side acknowledged entries are not expected; durable count comes from sync_log */ }
  }
  const ack = await getAcknowledgedSyncCount();
  if (ack === null) {
    summary.acknowledged = null;
    summary.acknowledgedAvailable = false;
  } else {
    summary.acknowledged = ack;
    summary.acknowledgedAvailable = true;
  }
  return summary;
}

/**
 * Get all operations regardless of status
 */
export async function getAllOps() {
  return await getAllItems('pending_ops');
}

/**
 * Mark operation status. Retries are incremented only when explicitly requested
 * (e.g. transient failure attempts), not for terminal attention-state labeling.
 * Optional metadata updates (e.g. nextAttemptAt) are applied without mutating
 * original operation identity/payload/hash/idempotency fields.
 */
export async function updateOpStatus(
  id,
  status,
  error = null,
  { incrementRetry = false, nextAttemptAt = undefined, clearNextAttemptAt = false } = {}
) {
  const op = await getItem('pending_ops', id);
  if (!op) return null;
  op.status = status;
  if (error !== null && error !== undefined) {
    op.lastError = error;
  }
  if (incrementRetry) {
    op.retries = (op.retries || 0) + 1;
  }
  if (clearNextAttemptAt) {
    delete op.nextAttemptAt;
  } else if (nextAttemptAt !== undefined) {
    op.nextAttemptAt = nextAttemptAt;
  }
  op.updatedAt = new Date().toISOString();
  await putItem('pending_ops', op);
  return op;
}

/**
 * Resume operations paused due to authentication after a successful login.
 * Dedicated recovery path: only AUTH_REQUIRED records are transitioned.
 * Does not alter payload/idempotency identifiers. Backend will re-authorize each op.
 */
export async function resumeAuthRequiredOps() {
  const items = await getAllItems('pending_ops');
  let resumed = 0;
  for (const op of items) {
    if (op.status === 'AUTH_REQUIRED') {
      op.status = 'PENDING';
      delete op.nextAttemptAt;
      op.updatedAt = new Date().toISOString();
      await putItem('pending_ops', op);
      resumed++;
    }
  }
  return resumed;
}

/**
 * Remove an operation after successful server confirmation
 * Note: Never deletes unresolved disputes/corrections if marked active!
 */
export async function removeOp(id) {
  await deleteItem('pending_ops', id);
}

/**
 * Clear acknowledged/completed operations from the queue.
 *
 * SAFE: Only removes operations whose status is CONFIRMED or ALREADY_EXISTS
 * (server-acknowledged outcomes). PENDING/RETRYING/CONFLICT/FAILED/AUTH_REQUIRED remain
 * stored and recoverable/inspectable.
 *
 * @returns {Promise<number>} Count of operations removed.
 */
export async function clearCompleted() {
  const all = await getAllItems('pending_ops');
  const toDelete = all.filter((op) => ACKNOWLEDGED_STATUSES.has(op.status));
  for (const op of toDelete) {
    await deleteItem('pending_ops', op.id);
  }
  return toDelete.length;
}
