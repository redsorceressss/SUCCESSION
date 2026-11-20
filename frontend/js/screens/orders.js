/**
 * Orders Screen
 * Tabler 1.7.4 Enterprise Design System
 * Lists active and settled gold contracts; allows jewellers to initiate job-work orders.
 */

import { Api } from '../api.js';
import { Auth } from '../auth.js';
import { State } from '../state.js';
import { renderStateBadge } from '../components/badge.js';
import { Toast } from '../components/toast.js';
import { Modal } from '../components/modal.js';
import { Validators } from '../validators.js';

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function renderOrders() {
  const isJeweller = Auth.isJeweller();
  let orders = [];
  let loadError = null;

  try {
    orders = await Api.getOrders();
  } catch (err) {
    loadError = err.message || 'Could not load orders';
    Toast.error('Could not load orders: ' + loadError);
  }

  return `
    <div class="container-xl py-3">
      <!-- Page Header -->
      <div class="page-header d-print-none mb-3">
        <div class="row g-2 align-items-center">
          <div class="col">
            <div class="page-pretitle text-uppercase tracking-wider text-muted fs-5">Manufacturing Operations</div>
            <h2 class="page-title fs-2 fw-bold text-dark">
              ${State.t('orders.title') || 'Job-Work Orders'}
            </h2>
          </div>
          ${isJeweller ? `
            <div class="col-auto ms-auto d-print-none">
              <button id="open-new-order-modal" class="btn btn-primary d-none d-sm-inline-block">
                <svg class="icon me-1" width="20" height="20" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                ${State.t('orders.create_order') || 'Create New Order'}
              </button>
            </div>
          ` : ''}
        </div>
      </div>

      ${loadError ? `
        <div class="alert alert-danger border mb-3" role="alert">
          <div class="d-flex">
            <div>
              <svg class="icon alert-icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>
            <div>
              <h4 class="alert-title">Failed to load orders</h4>
              <div class="text-secondary">${escapeHtml(loadError)}</div>
            </div>
          </div>
        </div>
      ` : ''}

      <!-- Orders Card Table -->
      <div class="card border shadow-none">
        <div class="card-header py-3 bg-white border-bottom">
          <h3 class="card-title fw-bold text-dark m-0">Contract Registry</h3>
          <div class="card-actions">
            <span class="badge bg-primary-subtle text-primary fw-medium px-2 py-1">
              ${orders.length} ${orders.length === 1 ? 'Order' : 'Orders'} Total
            </span>
          </div>
        </div>

        ${orders.length === 0 ? `
          <div class="card-body py-5 text-center">
            <div class="empty">
              <div class="empty-icon mb-3">
                <span class="avatar avatar-lg rounded-circle bg-light border text-muted">
                  <svg class="icon icon-lg" width="32" height="32" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" fill="none"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/><path d="M21 21v-2a4 4 0 0 0 -3 -3.85"/></svg>
                </span>
              </div>
              <p class="empty-title fs-3 fw-bold text-dark mb-1">No Orders Recorded</p>
              <p class="empty-subtitle text-muted fs-4 mb-3">
                ${isJeweller ? 'Initiate your first gold manufacturing contract with a karigar to start recording issues.' : 'You have no open or completed job-work orders assigned to your account.'}
              </p>
              ${isJeweller ? `
                <div class="empty-action">
                  <button id="open-new-order-modal-empty" class="btn btn-primary">
                    <svg class="icon me-1" width="18" height="18" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Create First Order
                  </button>
                </div>
              ` : ''}
            </div>
          </div>
        ` : `
          <div class="table-responsive">
            <table class="table table-vcenter card-table table-hover table-striped">
              <thead>
                <tr>
                  <th class="w-1 text-muted text-uppercase text-xs tracking-wider">Order ID</th>
                  <th class="text-muted text-uppercase text-xs tracking-wider">Article Description</th>
                  <th class="text-muted text-uppercase text-xs tracking-wider">Wastage %</th>
                  <th class="text-muted text-uppercase text-xs tracking-wider">Due Date</th>
                  <th class="text-muted text-uppercase text-xs tracking-wider">Status</th>
                  <th class="w-1 text-end text-muted text-uppercase text-xs tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${orders.map((o) => `
                  <tr>
                    <td class="text-nowrap">
                      <span class="badge bg-light text-dark font-monospace border">#${o.id}</span>
                    </td>
                    <td class="fw-semibold text-dark">
                      ${escapeHtml(o.description)}
                    </td>
                    <td>
                      <span class="font-monospace text-muted">${Number(o.wastage_pct || 0).toFixed(3)}%</span>
                    </td>
                    <td class="text-muted">
                      ${o.due_date ? `
                        <span class="d-inline-flex align-items-center">
                          <svg class="icon me-1 text-muted" width="14" height="14" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><rect x="4" y="5" width="16" height="16" rx="2"/><line x1="16" y1="3" x2="16" y2="7"/><line x1="8" y1="3" x2="8" y2="7"/><line x1="4" y1="11" x2="20" y2="11"/></svg>
                          ${escapeHtml(o.due_date)}
                        </span>
                      ` : '<span class="text-muted">—</span>'}
                    </td>
                    <td>
                      ${renderStateBadge(o.status)}
                    </td>
                    <td class="text-end text-nowrap">
                      <a href="#/orders/${o.id}" class="btn btn-sm btn-outline-secondary">
                        ${State.t('orders.view_detail') || 'View Contract'}
                        <svg class="icon ms-1" width="14" height="14" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><polyline points="9 6 15 12 9 18"/></svg>
                      </a>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    </div>
  `;
}

renderOrders.afterRender = () => {
  const attachModalHandler = (buttonId) => {
    const btn = document.getElementById(buttonId);
    if (!btn) return;

    btn.addEventListener('click', () => {
      Modal.open({
        title: State.t('orders.create_order') || 'Create Job-Work Order',
        confirmText: 'Issue Order Contract',
        contentHtml: `
          <form id="create-order-form" class="space-y-3">
            <div class="mb-3">
              <label class="form-label required" for="new-order-karigar">Karigar Username / Login</label>
              <input type="text" id="new-order-karigar" class="form-control" required placeholder="e.g. ramesh_karigar" autocomplete="off">
              <div class="form-hint text-muted">The verified karigar counterparty for this dual-custody order.</div>
            </div>
            <div class="mb-3">
              <label class="form-label required" for="new-order-desc">Article Description</label>
              <input type="text" id="new-order-desc" class="form-control" required placeholder="e.g. 22K Traditional Bridal Necklace — 45g target">
            </div>
            <div class="row">
              <div class="col-md-6 mb-3">
                <label class="form-label" for="new-order-wastage">Manufacturing Wastage %</label>
                <div class="input-group">
                  <input type="text" id="new-order-wastage" class="form-control font-monospace" value="2.000" placeholder="2.000">
                  <span class="input-group-text">%</span>
                </div>
                <div class="form-hint text-muted">Allowed loss allowance (0.000% – 20.000%).</div>
              </div>
              <div class="col-md-6 mb-3">
                <label class="form-label" for="new-order-due">Target Completion Date</label>
                <input type="date" id="new-order-due" class="form-control">
              </div>
            </div>
          </form>
        `,
        onConfirm: async () => {
          const karigarLogin = document.getElementById('new-order-karigar')?.value.trim();
          const desc = document.getElementById('new-order-desc')?.value.trim();
          const wastage = document.getElementById('new-order-wastage')?.value.trim();
          const due = document.getElementById('new-order-due')?.value || null;

          if (!karigarLogin || !desc) {
            Toast.error('Please enter the Karigar username and Article description.');
            return false;
          }

          if (!Validators.isValidWastagePct(wastage)) {
            Toast.error('Wastage % must be a number between 0 and 20 (max 3 decimals).');
            return false;
          }

          try {
            await Api.createOrder({
              karigar_login: karigarLogin,
              description: desc,
              wastage_pct: wastage,
              due_date: due,
            });
            Toast.success('Job-work order created successfully!');
            window.location.hash = '#/orders';
            window.location.reload();
            return true;
          } catch (err) {
            Toast.error(err.message || 'Failed to create order contract.');
            return false;
          }
        },
      });
    });
  };

  attachModalHandler('open-new-order-modal');
  attachModalHandler('open-new-order-modal-empty');
};
