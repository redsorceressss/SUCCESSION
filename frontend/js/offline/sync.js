/**
 * Background Synchronizer
 * Replays queued offline operations against the backend API.
 * Uses exponential backoff and idempotency handling (409 Conflict treated safely).
 */

import { getPendingOps, getQueueSummary, updateOpStatus, removeOp } from './queue.js';
import { putItem } from './db.js';
import { isOnline } from './connectivity.js';

const MAX_TRANSIENT_RETRIES = 5;
const RETRY_BASE_DELAY_MS = 5000;
const RETRY_MAX_DELAY_MS = 5 * 60 * 1000;

function computeNextAttemptAt(retryCount, nowMs = Date.now()) {
  const attempt = Math.max(1, Number(retryCount) || 1);
  const delay = Math.min(RETRY_MAX_DELAY_MS, RETRY_BASE_DELAY_MS * (2 ** (attempt - 1)));
  return new Date(nowMs + delay).toISOString();
}

let isSyncing = false;
const listeners = new Set();
const syncBroadcast = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('succession_sync_channel') : null;

if (syncBroadcast) {
  syncBroadcast.onmessage = (event) => {
    if (event.data?.type === 'sync_completed') {
      notifySync('remote_sync_completed', event.data);
    }
  };
}

export function onSyncEvent(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function notifySync(event, data) {
  for (const cb of listeners) {
    try {
      cb(event, data);
    } catch (e) {
      console.error('Sync listener error:', e);
    }
  }
}

function shouldUseSyncBatch(op) {
  if (!op) return false;
  if (op.endpoint === '/sync') return false; // never wrap a sync call inside sync
  return op.kind === 'dispute_create' || op.kind === 'dispute_note';
}

function isIdempotentReplayOp(op) {
  if (!op?.payload) return false;
  return Boolean(op.payload.client_id || op.payload.idempotency_key || op.payload._offline_op_id);
}

function summarizeSyncItemResult(item) {
  if (!item || typeof item !== 'object') {
    return { outcome: 'failed', detail: 'Invalid /sync response item', permanent: true };
  }
  if (item.status === 'accepted' || item.status === 'duplicate') {
    return { outcome: item.status === 'duplicate' ? 'already_exists' : 'confirmed', detail: item.detail || null, result: item.result || null };
  }
  if (item.status === 'conflict') {
    return { outcome: 'conflict', detail: item.detail || 'Conflict during sync replay', result: item.result || null };
  }
  // "error" from /sync indicates item-level failure; treat as non-auto-retriable attention unless clearly transient.
  return { outcome: 'failed', detail: item.detail || `Sync item status: ${item.status || 'unknown'}`, result: item.result || null, permanent: true };
}

function classifyFailure(err) {
  const status = err?.status;
  const message = err?.message || String(err || 'Unknown error');
  if (status === 401) return { category: 'auth_expired', attentionStatus: 'AUTH_REQUIRED', retryable: false, stop: true };
  // 403 may be a genuine authorization/permission restriction; do not treat as auth expiry auto-resume.
  if (status === 403) return { category: 'authorization_denied', attentionStatus: 'FAILED', retryable: false, stop: true };
  if (status === 409) return { category: 'conflict', attentionStatus: 'CONFLICT', retryable: false, stop: false };
  if (status === 0) return { category: 'network', attentionStatus: 'RETRYING', retryable: true, stop: false };
  if (status >= 500 && status <= 599) return { category: 'server_unavailable', attentionStatus: 'RETRYING', retryable: true, stop: false };
  if (status >= 400 && status <= 499) return { category: 'permanent_client', attentionStatus: 'FAILED', retryable: false, stop: false };
  // Unknown thrown errors: be conservative and require attention rather than infinite auto-retry.
  return { category: 'unknown', attentionStatus: 'FAILED', retryable: false, stop: false };
}

async function applyTransientFailure(op, message, details, category, nowMs = Date.now()) {
  const nextRetries = (op.retries || 0) + 1;
  if (nextRetries >= MAX_TRANSIENT_RETRIES) {
    await updateOpStatus(op.id, 'FAILED', `${message} (auto-retry limit reached)`, { incrementRetry: true, clearNextAttemptAt: true });
    await recordSyncLog(op, 'FAILED', { error: message, category, retries: nextRetries, details });
    return { terminal: 'failed', retries: nextRetries };
  }
  const nextAttemptAt = computeNextAttemptAt(nextRetries, nowMs);
  await updateOpStatus(op.id, 'RETRYING', message, { incrementRetry: true, nextAttemptAt });
  await recordSyncLog(op, 'RETRYING', { error: message, category, retries: nextRetries, details, nextAttemptAt });
  return { terminal: 'retrying', retries: nextRetries, nextAttemptAt };
}

async function buildResult(status, successCount, failCount, conflictCount, extra = {}) {
  const summary = await getQueueSummary();
  return {
    status,
    successCount,
    failCount,
    conflictCount,
    pendingCount: summary.autoReplayable,
    attentionCount: summary.attention,
    summary,
    ...extra,
  };
}

/**
 * Trigger sync process (auto-replay eligible operations only).
 * CONFLICT/FAILED/AUTH_REQUIRED operations are retained for attention and are never auto-replayed.
 * @param {Function} apiRequest - Injected authorized request function from api.js
 */
export async function syncQueue(apiRequest) {
  if (typeof apiRequest !== 'function') {
    throw new Error('syncQueue requires a request function(apiRequest method,path,data,isMultipart)');
  }
  if (isSyncing) {
    const result = await buildResult('already_running', 0, 0, 0);
    notifySync('busy', result);
    return result;
  }
  if (!isOnline()) {
    const result = await buildResult('offline', 0, 0, 0);
    notifySync('offline', result);
    return result;
  }

  isSyncing = true;
  notifySync('started', {});

  const pending = await getPendingOps(); // auto-replayable only (PENDING, RETRYING)
  let successCount = 0;
  let failCount = 0;
  let conflictCount = 0;
  let authStopped = false;

  for (const op of pending) {
    try {
      await updateOpStatus(op.id, 'RETRYING');

      if (shouldUseSyncBatch(op)) {
        const syncItem = {
          idempotency_key: op.id,
          kind: op.kind,
          payload: op.payload,
        };
        const response = await apiRequest('POST', '/sync', { items: [syncItem] });
        const itemResult = Array.isArray(response?.results) ? response.results[0] : null;
        const summary = summarizeSyncItemResult(itemResult);

        if (summary.outcome === 'confirmed' || summary.outcome === 'already_exists') {
          await recordSyncLog(op, summary.outcome === 'already_exists' ? 'ALREADY_EXISTS' : 'CONFIRMED', response);
          await removeOp(op.id);
          successCount++;
          notifySync('item_synced', { op, response, outcome: summary.outcome });
        } else if (summary.outcome === 'conflict') {
          await updateOpStatus(op.id, 'CONFLICT', summary.detail || 'Conflict', { clearNextAttemptAt: true });
          await recordSyncLog(op, 'CONFLICT', { response, detail: summary.detail });
          conflictCount++;
          notifySync('item_conflict', { op, response, detail: summary.detail });
        } else {
          // Batch item-level error: keep for attention; do not auto-retry blindly.
          await updateOpStatus(op.id, 'FAILED', summary.detail || 'Sync failed', { clearNextAttemptAt: true });
          await recordSyncLog(op, 'FAILED', { response, detail: summary.detail });
          failCount++;
          notifySync('item_failed', { op, error: summary.detail, response });
        }
        continue;
      }

      // Direct endpoint replay (JSON payloads only; multipart should never be queued)
      let response;
      try {
        response = await apiRequest(op.method, op.endpoint, op.payload);
      } catch (err) {
        if (err?.status === 409 && isIdempotentReplayOp(op)) {
          await recordSyncLog(op, 'ALREADY_EXISTS', { status: 409, message: err.message });
          await removeOp(op.id);
          successCount++;
          notifySync('item_synced', { op, conflictResolved: true, outcome: 'already_exists' });
          continue;
        }
        if (err?.status === 409) {
          await updateOpStatus(op.id, 'CONFLICT', err.message || 'Conflict', { clearNextAttemptAt: true });
          await recordSyncLog(op, 'CONFLICT', { error: err.message, status: err.status, details: err.details });
          conflictCount++;
          notifySync('item_conflict', { op, error: err.message, details: err.details });
          continue;
        }
        throw err;
      }

      await recordSyncLog(op, 'CONFIRMED', response);
      await removeOp(op.id);
      successCount++;
      notifySync('item_synced', { op, response, outcome: 'confirmed' });
    } catch (err) {
      const message = err?.message || String(err);
      const cls = classifyFailure(err);
      if (cls.category === 'auth_expired') {
        await updateOpStatus(op.id, 'AUTH_REQUIRED', message, { clearNextAttemptAt: true });
        await recordSyncLog(op, 'AUTH_REQUIRED', { error: message, status: err?.status, details: err?.details });
        authStopped = true;
        notifySync('auth_required', { op, error: message, status: err?.status });
        break;
      }
      if (cls.category === 'authorization_denied') {
        await updateOpStatus(op.id, 'FAILED', message, { clearNextAttemptAt: true });
        await recordSyncLog(op, 'FAILED', { error: message, status: err?.status, category: 'authorization_denied', details: err?.details });
        failCount++;
        notifySync('item_failed', { op, error: message, status: err?.status, category: 'authorization_denied' });
        // Stop current run: token/session context may be unusable or misleading for subsequent ops.
        authStopped = true;
        notifySync('auth_required', { op, error: message, status: err?.status, authorization: true });
        break;
      }
      if (cls.retryable) {
        const outcome = await applyTransientFailure(op, message, err?.details, cls.category);
        if (outcome.terminal === 'failed') {
          failCount++;
          notifySync('item_failed', { op, error: `${message} (auto-retry limit reached)`, status: err?.status, category: cls.category });
        } else {
          notifySync('item_retry_scheduled', { op, error: message, status: err?.status, category: cls.category, nextAttemptAt: outcome.nextAttemptAt });
        }
        continue;
      }
      // Permanent/non-retryable failures and unknowns: retain for attention.
      const attentionStatus = cls.attentionStatus === 'CONFLICT' ? 'CONFLICT' : 'FAILED';
      await updateOpStatus(op.id, attentionStatus, message, { clearNextAttemptAt: true });
      await recordSyncLog(op, attentionStatus, { error: message, status: err?.status, category: cls.category, details: err?.details });
      if (attentionStatus === 'CONFLICT') conflictCount++; else failCount++;
      notifySync(attentionStatus === 'CONFLICT' ? 'item_conflict' : 'item_failed', { op, error: message, status: err?.status, category: cls.category });
    }
  }

  isSyncing = false;
  const result = await buildResult(authStopped ? 'auth_required' : 'completed', successCount, failCount, conflictCount);
  notifySync('completed', result);
  if (syncBroadcast) {
    try {
      syncBroadcast.postMessage({ type: 'sync_completed', result });
    } catch (e) {
      // transient broadcast error
    }
  }
  return result;
}

async function recordSyncLog(op, status, details) {
  try {
    await putItem('sync_log', {
      op_id: op.id,
      endpoint: op.endpoint,
      method: op.method,
      status,
      details,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.error('Failed to write sync log:', e);
  }
}
