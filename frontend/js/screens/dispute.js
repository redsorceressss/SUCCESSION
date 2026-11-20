/**
 * Dispute Management Screen
 * Tabler 1.7.4 Enterprise Design System
 * Dual-custody dispute isolation:
 * Automatically computes Undisputed vs Held quantity using exact decimal math.
 * Never overwrites original recorded value.
 */

import { Api } from '../api.js';
import { Auth } from '../auth.js';
import { State } from '../state.js';
import { Validators } from '../validators.js';
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

export async function renderDispute(params = {}) {
  const txId = params.id;
  let tx = null;
  let disputesList = [];
  let loadError = null;

  if (txId) {
    try {
      tx = await Api.getTransaction(txId);
    } catch (e) {
      loadError = e.message || 'Could not load transaction';
      return `
        <div class="container-xl py-4">
          <div class="alert alert-danger border shadow-none" role="alert">
            <h4 class="alert-title">Transaction Load Error</h4>
            <div class="text-secondary">${escapeHtml(loadError)}</div>
          </div>
        </div>
      `;
    }
  } else {
    try {
      disputesList = await Api.getDisputes();
    } catch (e) {
      console.warn('Disputes fetch error:', e);
    }
  }

  // View 1: List of all disputes across orders
  if (!txId) {
    return `
      <div class="container-xl py-3">
        <!-- Page Header -->
        <div class="page-header d-print-none mb-3">
          <div class="row g-2 align-items-center">
            <div class="col">
              <div class="page-pretitle text-uppercase tracking-wider text-muted fs-5">Legal & Custody Escrow</div>
              <h2 class="page-title fs-2 fw-bold text-dark">
                ${State.t('disputes.title') || 'Dispute Escrow Registry'}
              </h2>
              <div class="text-muted fs-4">Active disputes, frozen gold quantities, and counterparty resolution workflows</div>
            </div>
          </div>
        </div>

        <!-- Disputes Card Table -->
        <div class="card border shadow-none">
          <div class="card-header py-3 bg-white border-bottom d-flex justify-content-between align-items-center">
            <h3 class="card-title fw-bold text-dark m-0">Dispute Registry</h3>
            <span class="badge bg-warning-subtle text-warning fw-medium px-2 py-1">
              ${disputesList.length} ${disputesList.length === 1 ? 'Case' : 'Cases'}
            </span>
          </div>

          ${disputesList.length === 0 ? `
            <div class="card-body py-5 text-center text-muted">
              <div class="empty">
                <div class="empty-icon mb-3">
                  <span class="avatar avatar-lg rounded-circle bg-success-subtle text-success">
                    <svg class="icon icon-lg" width="32" height="32" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" fill="none"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 12l5 5l10 -10"/></svg>
                  </span>
                </div>
                <p class="empty-title fs-3 fw-bold text-dark mb-1">All Accounts Balanced</p>
                <p class="empty-subtitle text-muted fs-4 mb-0">
                  No open weight or purity disputes. All custody handovers are verified in harmony.
                </p>
              </div>
            </div>
          ` : `
            <div class="table-responsive">
              <table class="table table-vcenter card-table table-hover table-striped">
                <thead>
                  <tr>
                    <th class="w-1 text-muted text-uppercase text-xs tracking-wider">Dispute #</th>
                    <th class="text-muted text-uppercase text-xs tracking-wider">Transaction #</th>
                    <th class="text-muted text-uppercase text-xs tracking-wider">Attribute</th>
                    <th class="text-muted text-uppercase text-xs tracking-wider">Claimed Value</th>
                    <th class="text-muted text-uppercase text-xs tracking-wider">Held Escrow (g)</th>
                    <th class="text-muted text-uppercase text-xs tracking-wider">Status</th>
                    <th class="w-1 text-end text-muted text-uppercase text-xs tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${disputesList.map((d) => `
                    <tr>
                      <td class="text-nowrap">
                        <span class="badge bg-light text-dark font-monospace border">#${d.id}</span>
                      </td>
                      <td class="text-muted font-monospace">
                        #${d.transaction_id}
                      </td>
                      <td class="fw-semibold text-dark text-capitalize">
                        ${escapeHtml(d.field)}
                      </td>
                      <td class="font-monospace text-dark">
                        ${escapeHtml(d.claimed_value)}
                      </td>
                      <td>
                        <strong class="text-danger font-monospace">
                          ${d.held_g || d.held_weight_g || '0.0000'} g
                        </strong>
                      </td>
                      <td>
                        ${renderStateBadge(d.state || d.status)}
                      </td>
                      <td class="text-end text-nowrap">
                        <a href="#/disputes/${d.id}" class="btn btn-sm btn-outline-secondary">
                          Manage Case
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

  // View 2: Raising a new dispute on transaction txId
  const cv = tx.current_version && typeof tx.current_version === 'object' ? tx.current_version : {};
  const origWeight = cv.weight_g ?? tx.weight_g;

  return `
    <div class="container-tight py-4">
      <!-- Breadcrumb -->
      <nav aria-label="breadcrumb" class="mb-3">
        <ol class="breadcrumb">
          <li class="breadcrumb-item"><a href="#/disputes" class="text-muted">Disputes</a></li>
          <li class="breadcrumb-item active text-dark fw-semibold" aria-current="page">Raise Dispute on Tx #${tx.id}</li>
        </ol>
      </nav>

      <div class="card border shadow-none">
        <div class="card-header py-3 bg-white border-bottom">
          <div>
            <h2 class="card-title fs-2 fw-bold text-dark m-0">
              Raise Dispute on Transaction #${tx.id}
            </h2>
            <div class="text-muted fs-4">Disputed variance is safely frozen in escrow; undisputed balance remains free.</div>
          </div>
        </div>

        <div class="card-body p-4">
          <!-- Dynamic Balance Breakdown Preview -->
          <div class="card bg-light border mb-4">
            <div class="card-body p-3">
              <div class="row text-center g-2">
                <div class="col-4">
                  <div class="text-muted text-xs text-uppercase fw-semibold mb-1">Recorded Weight</div>
                  <div class="fs-2 fw-bold font-monospace text-dark" id="disp-original-val">${origWeight} g</div>
                </div>
                <div class="col-4 border-start">
                  <div class="text-muted text-xs text-uppercase fw-semibold mb-1">Undisputed Free</div>
                  <div class="fs-2 fw-bold font-monospace text-success" id="disp-undisputed-preview">--</div>
                </div>
                <div class="col-4 border-start">
                  <div class="text-muted text-xs text-uppercase fw-semibold mb-1">Held in Escrow</div>
                  <div class="fs-2 fw-bold font-monospace text-danger" id="disp-held-preview">--</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Dispute Submission Form -->
          <form id="dispute-form">
            <div class="mb-3">
              <label class="form-label required" for="disp-field">Disputed Attribute</label>
              <select id="disp-field" class="form-select" required>
                <option value="weight_g" selected>Weight (Physical Weighing Scale Discrepancy)</option>
                <option value="karat">Karat (Assay / Fineness Discrepancy)</option>
              </select>
            </div>

            <div class="mb-3">
              <label class="form-label required" for="disp-claimed-val">Claimed Physical Value (Your Scale Reading)</label>
              <div class="input-group">
                <input type="text" id="disp-claimed-val" class="form-control font-monospace" required placeholder="49.8500" autocomplete="off">
                <span class="input-group-text font-monospace">g</span>
              </div>
              <div class="form-hint text-muted">Example: If recorded as 50.0000g but physical scale shows 49.8500g, enter 49.8500.</div>
            </div>

            <div class="mb-4">
              <label class="form-label required" for="disp-reason">Dispute Circumstances & Evidence Note</label>
              <textarea id="disp-reason" class="form-control" rows="3" required placeholder="Specify scale calibration, draft shield condition, packaging tares, or environmental notes"></textarea>
            </div>

            <div class="d-flex justify-content-between align-items-center">
              <a href="#/transactions/${tx.id}" class="btn btn-outline-secondary">
                ${State.t('common.cancel') || 'Cancel'}
              </a>
              <button type="submit" id="submit-dispute-btn" class="btn btn-danger px-4">
                <svg class="icon me-1" width="18" height="18" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 9v2m0 4v.01"/><path d="M5 19h14a2 2 0 0 0 1.84 -2.75l-7.1 -12.25a2 2 0 0 0 -3.5 0l-7.1 12.25a2 2 0 0 0 1.75 2.75"/></svg>
                Raise Dispute & Freeze Variance
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
}

renderDispute.afterRender = (params = {}) => {
  const form = document.getElementById('dispute-form');
  const claimedInput = document.getElementById('disp-claimed-val');
  const fieldSelect = document.getElementById('disp-field');
  const origValEl = document.getElementById('disp-original-val');
  const undisPrev = document.getElementById('disp-undisputed-preview');
  const heldPrev = document.getElementById('disp-held-preview');

  if (!form || !claimedInput) return;

  const origStr = origValEl ? origValEl.innerText.replace(' g', '').trim() : '0';

  // Real-time decimal math preview
  const updatePreview = () => {
    const claimedStr = claimedInput.value.trim();
    const field = fieldSelect.value;

    if (field === 'weight_g' && Validators.isValidWeight(claimedStr) && Validators.isValidWeight(origStr)) {
      try {
        const split = Validators.splitDisputed(origStr, claimedStr);
        if (undisPrev) undisPrev.innerText = `${split.undisputed_g} g`;
        if (heldPrev) heldPrev.innerText = `${split.held_g} g`;
        return;
      } catch (e) {
        // Fallback
      }
    }

    if (undisPrev) undisPrev.innerText = '--';
    if (heldPrev) heldPrev.innerText = '--';
  };

  claimedInput.addEventListener('input', updatePreview);
  fieldSelect.addEventListener('change', updatePreview);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('submit-dispute-btn');
    const field = fieldSelect.value;
    const claimed = claimedInput.value.trim();
    const reason = document.getElementById('disp-reason')?.value.trim();

    if (!claimed || !reason) {
      Toast.error('Please enter the claimed reading and reasons.');
      return;
    }

    if (field === 'weight_g' && !Validators.isValidWeight(claimed)) {
      Toast.error('Claimed weight must be a valid positive decimal.');
      return;
    }

    if (claimed === origStr) {
      Toast.error('Claimed value cannot be identical to the recorded value.');
      return;
    }

    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Recording Dispute...';
      }

      const res = await Api.createDispute(params.id, {
        field,
        claimed_value: claimed,
        reason,
      });

      if (res && res._offline_queued) {
        Toast.info('Dispute saved offline in IndexedDB. Will sync when connectivity returns.');
        window.location.hash = `#/transactions/${params.id}`;
        return;
      }

      Toast.success('Dispute recorded. Disputed variance is frozen in escrow.');
      window.location.hash = res.dispute_id ? `#/disputes/${res.dispute_id}` : `#/transactions/${params.id}`;
    } catch (err) {
      Toast.error(err.message || 'Failed to record dispute.');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerText = 'Raise Dispute & Freeze Variance';
      }
    }
  });
};
