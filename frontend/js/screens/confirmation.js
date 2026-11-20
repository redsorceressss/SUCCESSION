/**
 * Dual-Custody Confirmation Screen
 * Tabler 1.7.4 Enterprise Design System
 * Core bilateral decision point:
 * 1. Confirm Entry (moves to CONFIRMED_BY_BOTH)
 * 2. Request Correction (for clerical typos)
 * 3. Raise Dispute (for weight/karat disagreement, isolates held gold)
 */

import { Api } from '../api.js';
import { Auth } from '../auth.js';
import { State } from '../state.js';
import { renderStateBadge, renderPurityBadge } from '../components/badge.js';
import { Toast } from '../components/toast.js';

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function renderConfirmation(params) {
  const txId = params.id;
  let tx = null;
  let loadError = null;

  try {
    tx = await Api.getTransaction(txId);
  } catch (err) {
    loadError = err.message || 'Could not load transaction details';
    return `
      <div class="container-xl py-4">
        <div class="alert alert-danger border shadow-none" role="alert">
          <h4 class="alert-title">Load Error</h4>
          <div class="text-secondary">${escapeHtml(loadError)}</div>
          <div class="mt-3">
            <a href="#/orders" class="btn btn-outline-danger btn-sm">Return to Orders</a>
          </div>
        </div>
      </div>
    `;
  }

  const cv = tx.current_version && typeof tx.current_version === 'object' ? tx.current_version : {};
  const weight = cv.weight_g ?? tx.weight_g;
  const karat = cv.karat ?? tx.karat;

  return `
    <div class="container-tight py-4">
      <!-- Breadcrumbs -->
      <nav aria-label="breadcrumb" class="mb-3">
        <ol class="breadcrumb">
          <li class="breadcrumb-item"><a href="#/orders" class="text-muted">Job-Work Orders</a></li>
          <li class="breadcrumb-item"><a href="#/orders/${tx.order_id}" class="text-muted">Contract #${tx.order_id}</a></li>
          <li class="breadcrumb-item active text-dark fw-semibold" aria-current="page">Dual-Custody Review</li>
        </ol>
      </nav>

      <div class="card border shadow-none">
        <div class="card-header py-3 bg-white border-bottom d-flex justify-content-between align-items-center">
          <div>
            <h2 class="card-title fs-2 fw-bold text-dark m-0">
              Dual-Custody Review for Entry #${tx.id}
            </h2>
            <div class="text-muted fs-4">Contract Order #${tx.order_id} • Bilateral verification required</div>
          </div>
          <div>${renderStateBadge(tx.state)}</div>
        </div>

        <div class="card-body p-4">
          <div class="alert alert-info border mb-4">
            <div class="text-xs">
              <strong>Bilateral Custody Protocol:</strong> In accordance with dual-custody rules, both the jeweller and the artisan must independently inspect, weigh, and sign this record before it becomes immutable on the hash chain.
            </div>
          </div>

          <!-- Handover Details Card -->
          <div class="row row-cards g-2 text-center mb-4">
            <div class="col-4">
              <div class="card card-sm border bg-light shadow-none">
                <div class="card-body p-3">
                  <div class="text-muted text-xs text-uppercase fw-semibold mb-1">Handover Type</div>
                  <div class="fs-2 fw-bold text-uppercase text-dark font-monospace">${tx.kind}</div>
                </div>
              </div>
            </div>
            <div class="col-4">
              <div class="card card-sm border bg-light shadow-none">
                <div class="card-body p-3">
                  <div class="text-muted text-xs text-uppercase fw-semibold mb-1">Recorded Weight</div>
                  <div class="fs-2 fw-bold font-monospace text-dark">${weight} g</div>
                </div>
              </div>
            </div>
            <div class="col-4">
              <div class="card card-sm border bg-light shadow-none">
                <div class="card-body p-3">
                  <div class="text-muted text-xs text-uppercase fw-semibold mb-1">Assayed Purity</div>
                  <div class="fs-2 fw-bold text-dark">${renderPurityBadge(karat)}</div>
                </div>
              </div>
            </div>
          </div>

          ${tx.note ? `
            <div class="mb-4 p-2 bg-light border rounded text-xs text-secondary">
              <strong>Recorded Batch Remarks:</strong> ${escapeHtml(tx.note)}
            </div>
          ` : ''}

          <!-- Three Verification Paths -->
          <h3 class="fw-bold text-dark fs-3 mb-3">Verification Decisions</h3>
          <div class="row row-cards g-3">
            <!-- Path 1: Confirm -->
            <div class="col-12">
              <div class="card card-sm border shadow-none bg-success-subtle border-success">
                <div class="card-body p-3 d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-3">
                  <div>
                    <h4 class="fw-bold text-success mb-1">Option 1: Confirm Physical Receipt</h4>
                    <p class="text-muted text-xs mb-0">You physically weighed and inspected the metal and agree with the recorded values.</p>
                  </div>
                  <button id="btn-do-confirm" class="btn btn-success px-4 text-nowrap">
                    <svg class="icon me-1" width="18" height="18" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 12l5 5l10 -10"/></svg>
                    Confirm & Sign Entry
                  </button>
                </div>
              </div>
            </div>

            <!-- Path 2: Request Correction -->
            <div class="col-sm-6">
              <div class="card card-sm border shadow-none bg-light h-100">
                <div class="card-body p-3 d-flex flex-column justify-content-between">
                  <div>
                    <h4 class="fw-bold text-dark mb-1">Option 2: Request Correction</h4>
                    <p class="text-muted text-xs mb-3">For clerical typos or agreed revisions before physical custody exchange.</p>
                  </div>
                  <a href="#/transactions/${tx.id}/correction" class="btn btn-outline-secondary btn-sm w-100">
                    Propose Correction
                  </a>
                </div>
              </div>
            </div>

            <!-- Path 3: Raise Dispute -->
            <div class="col-sm-6">
              <div class="card card-sm border shadow-none bg-danger-subtle border-danger h-100">
                <div class="card-body p-3 d-flex flex-column justify-content-between">
                  <div>
                    <h4 class="fw-bold text-danger mb-1">Option 3: Raise Weight Dispute</h4>
                    <p class="text-muted text-xs mb-3">When scale readings disagree. Immediately freezes disputed variance into escrow.</p>
                  </div>
                  <a href="#/transactions/${tx.id}/dispute" class="btn btn-danger btn-sm w-100">
                    Raise Dispute & Freeze
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

renderConfirmation.afterRender = (params) => {
  const confirmBtn = document.getElementById('btn-do-confirm');
  if (confirmBtn) {
    confirmBtn.addEventListener('click', async () => {
      try {
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Confirming...';

        const tx = await Api.getTransaction(params.id);
        const cv = tx.current_version && typeof tx.current_version === 'object' ? tx.current_version : {};
        const vNo = cv.version_no ?? tx.current_version ?? 1;
        await Api.confirmTransaction(tx.id, vNo);

        Toast.success('Transaction confirmed! Ledger record updated to CONFIRMED_BY_BOTH.');
        window.location.hash = `#/orders/${tx.order_id}`;
      } catch (err) {
        Toast.error(err.message || 'Failed to confirm transaction.');
      } finally {
        if (confirmBtn) {
          confirmBtn.disabled = false;
          confirmBtn.innerText = 'Confirm & Sign Entry';
        }
      }
    });
  }
};
