/**
 * Notifications and AI Reminders Screen
 * Tabler 1.7.4 Enterprise Design System
 * Displays autonomous system audits, reminders, and verification prompts.
 */

import { State } from '../state.js';
import { Api } from '../api.js';

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function renderNotifications() {
  let notifications = [];
  try {
    const remote = await Api.getNotifications?.();
    if (Array.isArray(remote) && remote.length > 0) {
      notifications = remote.map((r) => ({
        id: r.id,
        type: r.kind || 'agent_reminder',
        title: r.kind === 'dispute_opened' ? 'Dispute Opened' : r.kind === 'resolution_proposed' ? 'Resolution Proposed' : 'Ledger Update',
        message: r.message,
        timestamp: r.created_at || 'Recent',
        read: Boolean(r.read),
      }));
    }
  } catch (e) {
    // fallback to local state
  }

  if (notifications.length === 0) {
    notifications = State.get('notifications') || [
      {
        id: 1,
        type: 'agent_reminder',
        title: 'Custody Handover Pending Bilateral Confirmation',
        message: 'New issue entry on Order #1 has been committed to the hash chain and is awaiting counterparty verification.',
        timestamp: 'Just now',
        read: false,
      },
      {
        id: 2,
        type: 'agent_reconciliation',
        title: 'Metal Conservation Status Update',
        message: 'Order #1 reconciliation indicates mass balance verification is complete with zero unexplained variance.',
        timestamp: '15 mins ago',
        read: false,
      },
    ];
  }

  return `
    <div class="container-xl py-3">
      <!-- Page Header -->
      <div class="page-header d-print-none mb-3">
        <div class="row g-2 align-items-center">
          <div class="col">
            <div class="page-pretitle text-uppercase tracking-wider text-muted fs-5">System Invariants</div>
            <h2 class="page-title fs-2 fw-bold text-dark">
              ${State.t('nav.notifications') || 'Notifications & Audit Prompts'}
            </h2>
            <div class="text-muted fs-4">Autonomous system audits, custody reminders, and dual-approval verification alerts</div>
          </div>
          <div class="col-auto ms-auto d-print-none">
            <button id="clear-notifications-btn" class="btn btn-outline-secondary">
              Mark All as Read
            </button>
          </div>
        </div>
      </div>

      <!-- Notifications Card -->
      <div class="card border shadow-none">
        <div class="card-header py-3 bg-white border-bottom d-flex justify-content-between align-items-center">
          <h3 class="card-title fw-bold text-dark m-0">Activity Feed</h3>
          <span class="badge bg-primary-subtle text-primary fw-medium px-2 py-1">
            ${notifications.length} ${notifications.length === 1 ? 'Alert' : 'Alerts'}
          </span>
        </div>

        <div class="card-body p-0">
          ${notifications.length === 0 ? `
            <div class="py-5 text-center text-muted">
              <svg class="icon text-success mb-2" width="32" height="32" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 12l5 5l10 -10"/></svg>
              <p class="fs-4 mb-0">No pending notifications. You are completely caught up!</p>
            </div>
          ` : `
            <div class="list-group list-group-flush">
              ${notifications.map((n) => `
                <div class="list-group-item py-3 px-4 ${n.read ? 'bg-white' : 'bg-light'}">
                  <div class="row align-items-center">
                    <div class="col-auto">
                      <span class="avatar avatar-md rounded-circle ${n.read ? 'bg-secondary-subtle text-secondary' : 'bg-primary-subtle text-primary'}">
                        <svg class="icon" width="20" height="20" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M10 5a2 2 0 1 1 4 0a7 7 0 0 1 4 6v3a4 4 0 0 0 2 3h-16a4 4 0 0 0 2 -3v-3a7 7 0 0 1 4 -6"/><path d="M9 17v1a3 3 0 0 0 6 0v-1"/></svg>
                      </span>
                    </div>
                    <div class="col text-truncate">
                      <div class="d-flex justify-content-between align-items-center mb-1">
                        <div class="text-reset d-block fw-bold fs-4 text-dark">${escapeHtml(n.title)}</div>
                        <small class="text-muted font-monospace">${escapeHtml(n.timestamp)}</small>
                      </div>
                      <div class="text-secondary text-truncate fs-5">
                        ${escapeHtml(n.message)}
                      </div>
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      </div>
    </div>
  `;
}

renderNotifications.afterRender = () => {
  const clearBtn = document.getElementById('clear-notifications-btn');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      State.set('notifications', []);
      window.location.reload();
    });
  }
};
