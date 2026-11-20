/**
 * Assayer Assigned Verification Tasks Screen
 * Lists disputes/verification tasks explicitly assigned to the authenticated assayer.
 */
import { Api } from '../api.js';
import { Auth } from '../auth.js';
import { State } from '../state.js';
import { renderStateBadge } from '../components/badge.js';
import { Toast } from '../components/toast.js';

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function verificationBadge(status) {
  const map = {
    PENDING_REWEIGH_REQUEST: 'bg-secondary-lt text-secondary',
    PENDING_RESULT: 'bg-warning-lt text-warning',
    PENDING_VERIFICATION: 'bg-info-lt text-info',
    SUBMITTED_RESULT: 'bg-primary-lt text-primary',
    COMPLETED: 'bg-success-lt text-success',
  };
  const cls = map[status] || 'bg-secondary-lt text-secondary';
  const label = (status || 'UNKNOWN').replace(/_/g, ' ');
  return `<span class="badge ${cls}">${escapeHtml(label)}</span>`;
}

export async function renderAssayerTasks() {
  if (!Auth.isAssayer || !Auth.isAssayer()) {
    // Fallback guard (router should also enforce role-specific access where used)
  }

  let payload = { tasks: [], count: 0 };
  let loadError = null;
  try {
    payload = await Api.getAssayerTasks();
  } catch (e) {
    loadError = e?.message || 'Failed to load assigned verification tasks';
  }

  const tasks = Array.isArray(payload?.tasks) ? payload.tasks : [];

  if (loadError) {
    return `
      <div class="container-xl py-4">
        <div class="page-header d-print-none mb-3">
          <div class="row align-items-center">
            <div class="col">
              <div class="page-pretitle text-uppercase tracking-wider text-muted">Assayer Workflow</div>
              <h2 class="page-title">Assigned Verification Tasks</h2>
            </div>
          </div>
        </div>
        <div class="alert alert-danger" role="alert">
          <h4 class="alert-title">Unable to load tasks</h4>
          <div class="text-secondary">${escapeHtml(loadError)}</div>
        </div>
      </div>
    `;
  }

  return `
    <div class="container-xl py-3">
      <div class="page-header d-print-none mb-3">
        <div class="row g-2 align-items-center">
          <div class="col">
            <div class="page-pretitle text-uppercase tracking-wider text-muted">Independent Verification</div>
            <h2 class="page-title">Assigned Verification Tasks</h2>
            <div class="text-muted">Only disputes explicitly assigned to you are visible. Access is scoped, auditable, and revocable.</div>
          </div>
          <div class="col-auto ms-auto">
            <span class="badge bg-azure-lt text-azure">${tasks.length} task${tasks.length === 1 ? '' : 's'}</span>
          </div>
        </div>
      </div>

      <div class="card border shadow-none">
        <div class="card-header bg-white border-bottom">
          <h3 class="card-title mb-0">Verification Queue</h3>
        </div>
        ${tasks.length === 0 ? `
          <div class="card-body">
            <div class="empty py-5">
              <div class="empty-icon mb-2">🧪</div>
              <p class="empty-title">No assigned verification tasks</p>
              <p class="empty-subtitle text-muted">When an authorized party assigns you to a dispute, it will appear here with its verification status.</p>
            </div>
          </div>
        ` : `
          <div class="table-responsive">
            <table class="table table-vcenter card-table table-hover">
              <thead>
                <tr>
                  <th>Dispute</th>
                  <th>Transaction</th>
                  <th>Order</th>
                  <th>Dispute Status</th>
                  <th>Verification Status</th>
                  <th>Assigned</th>
                  <th class="text-end">Action</th>
                </tr>
              </thead>
              <tbody>
                ${tasks.map((t) => {
                  const d = t.dispute || {};
                  const tx = t.transaction || {};
                  const order = t.order || {};
                  const a = t.assignment || {};
                  return `
                    <tr>
                      <td><span class="badge bg-light text-dark border font-monospace">#${escapeHtml(d.id)}</span></td>
                      <td><span class="font-monospace">#${escapeHtml(d.transaction_id ?? tx.id ?? '-')}</span></td>
                      <td>
                        <div class="fw-medium">${escapeHtml(order.description || `Order #${order.id || '-'}`)}</div>
                        <div class="text-muted text-xs">Order #${escapeHtml(order.id ?? '-')}</div>
                      </td>
                      <td>${renderStateBadge(d.state || d.status || 'UNKNOWN')}</td>
                      <td>${verificationBadge(t.verification_status)}</td>
                      <td><span class="text-muted text-xs">${escapeHtml(a.created_at || '-')}</span></td>
                      <td class="text-end">
                        <a href="#/disputes/${escapeHtml(d.id)}" class="btn btn-sm btn-outline-primary">Open Task</a>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>

      <div class="card border shadow-none mt-3">
        <div class="card-body">
          <div class="d-flex align-items-start gap-2">
            <span class="badge bg-info-lt text-info">Note</span>
            <div class="text-muted text-sm">
              Assayers can review assigned dispute details and permitted evidence, record reweigh results, and submit independent verification.
              Original transactions cannot be modified and disputed amounts cannot be settled by assayers.
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}