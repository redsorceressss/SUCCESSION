/**
 * SUCCESSION Centralized API Client
 * Interfaces directly with FastAPI backend routes.
 * Handles JWT authorization, multipart uploads, error parsing,
 * and offline interception for write endpoints.
 */

import { Auth } from './auth.js';
import { isOnline } from './offline/connectivity.js';
import { enqueueOp } from './offline/queue.js';

/**
 * API base URL — resolved in this priority order:
 *   1. window.__SUCCESSION_CONFIG__.apiBase  (injected by deployment host)
 *   2. localStorage key 'succession_api_base'  (set via Settings screen)
 *   3. http://127.0.0.1:8000  (local development default)
 */
export const API_BASE = (
  (typeof window !== 'undefined' && window.__SUCCESSION_CONFIG__?.apiBase) ||
  (typeof localStorage !== 'undefined' && localStorage.getItem('succession_api_base')) ||
  'http://127.0.0.1:8000'
);

export class ApiError extends Error {
  constructor(status, message, details = null) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

function classifyOfflineMutation(method, path, data, isMultipart) {
  const m = String(method || 'GET').toUpperCase();
  if (m === 'GET') return { supported: false, reason: 'Read requests are not queued offline' };
  if (isMultipart || (typeof FormData !== 'undefined' && data instanceof FormData)) {
    return { supported: false, reason: 'File uploads are not supported offline. Please retry when connected.' };
  }

  // Safely supported with existing backend idempotency/replay contracts.
  if (m === 'POST' && /^\/transactions\/issue$/.test(path)) {
    return { supported: true, kind: 'tx_issue' };
  }
  if (m === 'POST' && /^\/transactions\/return$/.test(path)) {
    return { supported: true, kind: 'tx_return' };
  }
  if (m === 'POST' && /^\/transactions\/\d+\/disputes$/.test(path)) {
    // Backend dispute create is idempotent on client_id; can be replayed directly.
    return { supported: true, kind: 'dispute_create' };
  }
  if (m === 'POST' && /^\/disputes\/\d+\/notes$/.test(path)) {
    // Must replay via /sync batch for SyncRecord idempotency.
    return { supported: true, kind: 'dispute_note' };
  }

  return {
    supported: false,
    reason: 'This action is not supported offline. Please retry when connected.',
  };
}

async function tryQueueOfflineMutation(method, path, data, isMultipart) {
  const decision = classifyOfflineMutation(method, path, data, isMultipart);
  if (!decision.supported) {
    throw new ApiError(0, decision.reason, { offline_supported: false, endpoint: path, method });
  }
  const queued = await enqueueOp({
    endpoint: path,
    method,
    payload: data,
    kind: decision.kind,
  });
  return {
    _offline_queued: true,
    offline_supported: true,
    message: 'Saved offline. It will sync automatically when the connection is restored.',
    queued_op: queued,
  };
}

export async function request(method, path, data = null, isMultipart = false) {
  const url = `${API_BASE}${path}`;
  const headers = {};

  const token = Auth.getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const upperMethod = String(method || 'GET').toUpperCase();

  // Intercept offline mutation requests if browser is offline
  if (!isOnline() && upperMethod !== 'GET') {
    return tryQueueOfflineMutation(upperMethod, path, data, isMultipart);
  }

  let body = undefined;
  if (isMultipart) {
    body = data; // FormData instance
  } else if (data !== null) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(data);
  }

  let response;
  try {
    response = await fetch(url, {
      method: upperMethod,
      headers,
      body,
    });
  } catch (netErr) {
    // Network failure during a mutation: queue only if safely supported offline.
    if (upperMethod !== 'GET') {
      try {
        const queued = await tryQueueOfflineMutation(upperMethod, path, data, isMultipart);
        queued.message = 'Backend unreachable. Saved offline for automatic sync when available.';
        return queued;
      } catch (queueErr) {
        // Unsupported offline operation: surface a clear network/unavailable error.
        throw new ApiError(0, `Network error: ${netErr.message}. ${queueErr.message || ''}`.trim());
      }
    }
    throw new ApiError(0, `Network error: ${netErr.message}`);
  }

  if (response.status === 401) {
    Auth.clearSession();
    window.location.hash = '#/login';
    throw new ApiError(401, 'Session expired. Please log in again.');
  }

  let jsonResult = null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    jsonResult = await response.json();
  }

  if (!response.ok) {
    const errorMsg = jsonResult?.detail || jsonResult?.message || response.statusText;
    throw new ApiError(response.status, errorMsg, jsonResult);
  }

  return jsonResult;
}

export const Api = {
  // Auth
  register(login, name, password, role, language = 'en') {
    return request('POST', '/auth/register', { login, name, password, role, language });
  },
  login(login, password) {
    return request('POST', '/auth/login', { login, password });
  },
  me() {
    return request('GET', '/me');
  },

  // Orders
  createOrder({ karigar_login, description, due_date = null, wastage_pct = '0' }) {
    return request('POST', '/orders', { karigar_login, description, due_date, wastage_pct });
  },
  getOrders() {
    return request('GET', '/orders');
  },
  getOrder(orderId) {
    return request('GET', `/orders/${orderId}`);
  },
  getOrderSummary(orderId) {
    return request('GET', `/orders/${orderId}/summary`);
  },

  // Transactions
  issueGold({ order_id, weight_g, karat, note = '', client_id = null }) {
    return request('POST', '/transactions/issue', { order_id, weight_g, karat, note, client_id });
  },
  returnGold({ order_id, weight_g, karat, scrap_g = '0', note = '', client_id = null }) {
    return request('POST', '/transactions/return', { order_id, weight_g, karat, scrap_g, note, client_id });
  },
  getTransactions(orderId) {
    return request('GET', `/transactions?order_id=${orderId}`);
  },
  getTransaction(txId) {
    return request('GET', `/transactions/${txId}`);
  },
  getTransactionHistory(txId) {
    return request('GET', `/transactions/${txId}/history`);
  },
  confirmTransaction(txId, version_no) {
    return request('POST', `/transactions/${txId}/confirm`, { version_no });
  },
  requestCorrection(txId, { field, proposed_value, reason = '' }) {
    return request('POST', `/transactions/${txId}/correction-requests`, { field, proposed_value, reason });
  },
  decideCorrection(crId, decision, reason = '') {
    return request('POST', `/correction-requests/${crId}/decide`, { decision, reason });
  },
  disputeTransaction(txId, { field, claimed_value, reason = '', client_id = null, evidence_refs = [] }) {
    return request('POST', `/transactions/${txId}/disputes`, { field, claimed_value, reason, client_id, evidence_refs });
  },

  // Disputes
  getDisputes() {
    return request('GET', '/disputes');
  },
  getDispute(disputeId) {
    return request('GET', `/disputes/${disputeId}`);
  },
  addDisputeNote(disputeId, text) {
    return request('POST', `/disputes/${disputeId}/notes`, { text });
  },
  uploadDisputeEvidence(disputeId, file) {
    const formData = new FormData();
    formData.append('file', file);
    return request('POST', `/disputes/${disputeId}/evidence`, formData, true);
  },
  requestReweigh(disputeId, note = '') {
    return request('POST', `/disputes/${disputeId}/reweighing-requests`, { note });
  },
  submitReweighResult(requestId, weight_g) {
    return request('POST', `/reweighing-requests/${requestId}/result`, { weight_g });
  },
  verifyReweighResult(requestId, verified_weight_g, note = '') {
    return request('POST', `/reweighing-requests/${requestId}/verify`, { verified_weight_g, note });
  },
  assignAssayer(disputeId, assayer_login, note = '') {
    return request('POST', `/disputes/${disputeId}/assayer-assignments`, { assayer_login, note });
  },
  revokeAssayerAssignment(assignmentId, reason = '') {
    return request('POST', `/assayer-assignments/${assignmentId}/revoke`, { reason });
  },
  getAssayerTasks() {
    return request('GET', '/assayer/tasks');
  },
  proposeResolution(disputeId, { outcome, agreed_value = null, note = '' }) {
    return request('POST', `/disputes/${disputeId}/resolution-proposals`, { outcome, agreed_value, note });
  },
  decideResolution(proposalId, decision, reason = '') {
    return request('POST', `/resolution-proposals/${proposalId}/decide`, { decision, reason });
  },

  // Passbook
  getPassbook(karigarId) {
    return request('GET', `/passbook/${karigarId}`);
  },

  // Settlements
  createSettlement(order_id) {
    return request('POST', '/settlements', { order_id });
  },
  getSettlements(orderId) {
    return request('GET', `/settlements?order_id=${orderId}`);
  },
  getSettlement(sid) {
    return request('GET', `/settlements/${sid}`);
  },
  approveSettlement(sid, accept_partial = false) {
    return request('POST', `/settlements/${sid}/approve`, { accept_partial });
  },
  rejectSettlement(sid, reason = '') {
    return request('POST', `/settlements/${sid}/reject`, { reason });
  },

  // AI & Hardware
  parseVoice(text, language = 'auto') {
    return request('POST', '/voice/parse', { text, language });
  },
  uploadScalePhoto(transaction_id, entered_weight, file) {
    const formData = new FormData();
    formData.append('transaction_id', transaction_id);
    formData.append('entered_weight', entered_weight);
    formData.append('file', file);
    return request('POST', '/scale-photos', formData, true);
  },

  // Sync & Health
  syncBatch(items) {
    return request('POST', '/sync', { items });
  },
  ping() {
    return request('GET', '/health');
  },
  getNotifications() {
    return request('GET', '/notifications');
  },
  queryAI(question) {
    return request('POST', '/ai/query', { question });
  },
};
