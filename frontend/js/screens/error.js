/**
 * SUCCESSION Branded Error & Status Screen
 * Tabler 1.7.4 Enterprise Design System
 * Handles HTTP error and status presentation (400, 401, 403, 404, 409, 422, 500, etc.)
 * Strictly distinguishes terminal errors from operational states (e.g. 202 Accepted, 409 Conflict).
 */

import { Auth } from '../auth.js';
import { State } from '../state.js';

const ERROR_METADATA = {
  '400': {
    title: 'Bad Request',
    subtitle: 'The request could not be understood or contained invalid parameters.',
    actionLabel: 'Return to Dashboard',
    actionHref: '#/dashboard',
    icon: `<svg class="icon icon-lg text-warning" width="48" height="48" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" fill="none"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  },
  '401': {
    title: 'Session Expired',
    subtitle: 'Your cryptographic session token has expired or is invalid. Please sign in again to resume your workflow.',
    actionLabel: 'Sign In to SUCCESSION',
    actionHref: '#/login',
    recoveryType: 'auth',
    icon: `<svg class="icon icon-lg text-primary" width="48" height="48" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" fill="none"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><rect x="5" y="11" width="14" height="10" rx="2"/><circle cx="12" cy="16" r="1"/><path d="M8 11v-4a4 4 0 0 1 8 0v4"/></svg>`,
  },
  '403': {
    title: 'Access Restricted',
    subtitle: 'You do not have the required authority (Jeweller / Karigar / Counterparty) to perform this action.',
    actionLabel: 'Return to Dashboard',
    actionHref: '#/dashboard',
    icon: `<svg class="icon icon-lg text-danger" width="48" height="48" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" fill="none"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><circle cx="12" cy="12" r="9"/><path d="M5.7 5.7l12.6 12.6"/></svg>`,
  },
  '404': {
    title: 'Record Not Found',
    subtitle: 'The requested ledger transaction, order, dispute, or audit log entry does not exist.',
    actionLabel: 'View Active Orders',
    actionHref: '#/orders',
    icon: `<svg class="icon icon-lg text-muted" width="48" height="48" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" fill="none"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><circle cx="10" cy="10" r="7"/><line x1="21" y1="21" x2="15" y2="15"/><line x1="10" y1="13" x2="10" y2="13.01"/><line x1="10" y1="7" x2="10" y2="10"/></svg>`,
  },
  '405': {
    title: 'Method Not Allowed',
    subtitle: 'The specified ledger mutation is not permitted for this resource endpoint.',
    actionLabel: 'Return to Dashboard',
    actionHref: '#/dashboard',
    icon: `<svg class="icon icon-lg text-warning" width="48" height="48" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" fill="none"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  },
  '408': {
    title: 'Request Timeout',
    subtitle: 'The connection timed out before the ledger could record the mutation. If you are offline, this operation is safely queued in IndexedDB.',
    actionLabel: 'Check Offline Queue',
    actionHref: '#/settings',
    icon: `<svg class="icon icon-lg text-warning" width="48" height="48" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" fill="none"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/></svg>`,
  },
  '409': {
    title: 'Ledger State Conflict',
    subtitle: 'The requested operation conflicts with the current ledger state. For example, a dispute is already open, an idempotency key was reused, or accounts changed after a settlement draft was created.',
    actionLabel: 'Inspect Disputes & Holds',
    actionHref: '#/disputes',
    isConflict: true,
    icon: `<svg class="icon icon-lg text-danger" width="48" height="48" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" fill="none"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 9v2m0 4v.01"/><path d="M5 19h14a2 2 0 0 0 1.84 -2.75l-7.1 -12.25a2 2 0 0 0 -3.5 0l-7.1 12.25a2 2 0 0 0 1.75 2.75"/></svg>`,
  },
  '413': {
    title: 'Payload Too Large',
    subtitle: 'The uploaded scale photo, evidence document, or payload exceeds the allowed storage limit.',
    actionLabel: 'Return to Evidence',
    actionHref: '#/disputes',
    icon: `<svg class="icon icon-lg text-warning" width="48" height="48" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" fill="none"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2"/><polyline points="7 9 12 4 17 9"/><line x1="12" y1="4" x2="12" y2="16"/></svg>`,
  },
  '415': {
    title: 'Unsupported Media Type',
    subtitle: 'The uploaded file format is not supported. Please upload PNG, JPG, WEBP scale photos or PDF evidence.',
    actionLabel: 'Back to Evidence',
    actionHref: '#/disputes',
    icon: `<svg class="icon icon-lg text-warning" width="48" height="48" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" fill="none"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z"/><line x1="9" y1="14" x2="15" y2="14"/></svg>`,
  },
  '422': {
    title: 'Unprocessable Entity',
    subtitle: 'Validation failed for one or more fields. Check decimal weights (max 4 decimal places), karat range (1-24), or required descriptions.',
    actionLabel: 'Return to Active Orders',
    actionHref: '#/orders',
    icon: `<svg class="icon icon-lg text-warning" width="48" height="48" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" fill="none"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M9 5h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2h-2"/><rect x="9" y="3" width="6" height="4" rx="2"/><line x1="9" y1="14" x2="9.01" y2="14"/><line x1="13" y1="14" x2="15" y2="14"/></svg>`,
  },
  '429': {
    title: 'Too Many Requests',
    subtitle: 'Rate limit exceeded. Please wait a moment before sending additional cryptographic signatures or verification requests.',
    actionLabel: 'Return to Dashboard',
    actionHref: '#/dashboard',
    icon: `<svg class="icon icon-lg text-warning" width="48" height="48" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" fill="none"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/></svg>`,
  },
  '500': {
    title: 'Internal Server Error',
    subtitle: 'An unexpected exception occurred on the ledger node. Database invariants remain intact.',
    actionLabel: 'Return to Dashboard',
    actionHref: '#/dashboard',
    icon: `<svg class="icon icon-lg text-danger" width="48" height="48" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" fill="none"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  },
  '502': {
    title: 'Bad Gateway',
    subtitle: 'Unable to communicate with the FastAPI backend service. Verify that the server is running on port 8000.',
    actionLabel: 'Retry Connection',
    actionHref: '#/dashboard',
    icon: `<svg class="icon icon-lg text-danger" width="48" height="48" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" fill="none"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M3 12h4l3 8l4 -16l3 8h4"/></svg>`,
  },
  '503': {
    title: 'Service Unavailable',
    subtitle: 'The ledger service or AI inference engine is temporarily unavailable or undergoing maintenance.',
    actionLabel: 'View Offline Ledger',
    actionHref: '#/passbook',
    icon: `<svg class="icon icon-lg text-warning" width="48" height="48" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" fill="none"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 3a9 9 0 0 0 -9 9a9 9 0 0 0 9 9a9 9 0 0 0 9 -9"/><path d="M12 7v5l3 3"/></svg>`,
  },
  '504': {
    title: 'Gateway Timeout',
    subtitle: 'The ledger backend took too long to respond. Do not blindly repeat the transaction if client_id was not used.',
    actionLabel: 'Inspect Transactions',
    actionHref: '#/passbook',
    icon: `<svg class="icon icon-lg text-danger" width="48" height="48" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" fill="none"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/></svg>`,
  },
};

export async function renderError(params = {}) {
  const root = document.getElementById('app-root');
  if (!root) return;

  const code = String(params.code || '404');
  const details = params.details || State.get('last_error_details') || '';
  const meta = ERROR_METADATA[code] || {
    title: `Error ${code}`,
    subtitle: 'An unexpected application error occurred.',
    actionLabel: 'Return to Dashboard',
    actionHref: '#/dashboard',
    icon: `<svg class="icon icon-lg text-muted" width="48" height="48" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" fill="none"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  };

  root.innerHTML = `
    <div class="page page-center" style="min-height: 70vh; background-color: var(--tblr-bg-surface, #FAF9F5);">
      <div class="container-tight py-4">
        <div class="text-center mb-4">
          <div class="mb-3">
            <span class="avatar avatar-xl rounded-circle bg-light border">
              ${meta.icon}
            </span>
          </div>
          <div class="text-muted fw-bold text-uppercase tracking-wider fs-5 mb-1">SUCCESSION Protocol</div>
          <h1 class="display-6 fw-bold mb-2 text-dark">${meta.title}</h1>
          <div class="badge bg-secondary-subtle text-secondary px-3 py-1 mb-3">HTTP Status ${code}</div>
          <p class="text-secondary fs-4 mx-auto" style="max-width: 480px;">
            ${meta.subtitle}
          </p>
        </div>

        ${details ? `
          <div class="card border mb-3 shadow-none">
            <div class="card-header py-2 bg-light">
              <h4 class="card-title text-xs text-uppercase tracking-wider text-muted m-0">Diagnostic Details</h4>
            </div>
            <div class="card-body p-3 font-monospace text-xs text-danger bg-white overflow-auto" style="max-height: 140px;">
              ${escapeHtml(typeof details === 'object' ? JSON.stringify(details, null, 2) : details)}
            </div>
          </div>
        ` : ''}

        ${meta.isConflict ? `
          <div class="alert alert-warning border mb-3" role="alert">
            <div class="d-flex align-items-center">
              <svg class="icon me-2" width="20" height="20" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <div class="text-xs">
                <strong>Financial Invariant Protection:</strong> Disputed quantities remain safely isolated in <code>SettlementHold</code>. Original records are immutable.
              </div>
            </div>
          </div>
        ` : ''}

        <div class="empty-action text-center mt-4">
          <a href="${meta.actionHref}" class="btn btn-primary px-4 py-2">
            ${meta.actionLabel}
          </a>
          <a href="#/dashboard" class="btn btn-outline-secondary px-4 py-2 ms-2">
            Overview
          </a>
        </div>
      </div>
    </div>
  `;
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
