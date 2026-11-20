/**
 * Correction Request Screen
 * Tabler 1.7.4 Enterprise Design System
 * For clerical or minor adjustments. Requires counterparty's explicit decision.
 */

import { Api } from '../api.js';
import { State } from '../state.js';
import { Validators } from '../validators.js';
import { Toast } from '../components/toast.js';

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function renderCorrection(params) {
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

  return `
    <div class="container-tight py-4">
      <!-- Breadcrumbs -->
      <nav aria-label="breadcrumb" class="mb-3">
        <ol class="breadcrumb">
          <li class="breadcrumb-item"><a href="#/orders" class="text-muted">Job-Work Orders</a></li>
          <li class="breadcrumb-item"><a href="#/transactions/${tx.id}" class="text-muted">Transaction #${tx.id}</a></li>
          <li class="breadcrumb-item active text-dark fw-semibold" aria-current="page">Request Correction</li>
        </ol>
      </nav>

      <div class="card border shadow-none">
        <div class="card-header py-3 bg-white border-bottom">
          <h2 class="card-title fs-2 fw-bold text-dark m-0">
            Request Correction for Entry #${tx.id}
          </h2>
          <div class="text-muted fs-4">Submit an adjustment proposal for counterparty bilateral review</div>
        </div>

        <div class="card-body p-4">
          <div class="alert alert-info border mb-3">
            <div class="text-xs">
              <strong>Current Entry Values:</strong> Weight: <strong>${tx.weight_g} g</strong> | Karat: <strong>${tx.karat}K</strong> | Scrap: <strong>${tx.scrap_g || '0.0000'} g</strong>
            </div>
          </div>

          <form id="correction-form">
            <div class="mb-3">
              <label class="form-label required" for="corr-field">Field to Correct</label>
              <select id="corr-field" class="form-select" required>
                <option value="weight_g">Weight (Gross Grams)</option>
                <option value="karat">Karat (Assayed Purity)</option>
                <option value="scrap_g">Scrap Weight (Grams)</option>
                <option value="note">Custody Remarks / Batch Note</option>
              </select>
            </div>

            <div class="mb-3">
              <label class="form-label required" for="corr-value">Proposed Corrected Value</label>
              <input type="text" id="corr-value" class="form-control" required placeholder="e.g. 50.0000 or 22" autocomplete="off">
            </div>

            <div class="mb-4">
              <label class="form-label required" for="corr-reason">Reason for Correction</label>
              <textarea id="corr-reason" class="form-control" rows="3" required placeholder="Explain why this adjustment is necessary (e.g. typographical error on tare weight)"></textarea>
            </div>

            <div class="d-flex justify-content-between align-items-center">
              <a href="#/transactions/${tx.id}" class="btn btn-outline-secondary">
                ${State.t('common.cancel') || 'Cancel'}
              </a>
              <button type="submit" id="submit-corr-btn" class="btn btn-primary px-4">
                Submit Correction Request
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
}

renderCorrection.afterRender = (params) => {
  const form = document.getElementById('correction-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('submit-corr-btn');
    const field = document.getElementById('corr-field')?.value;
    const proposedVal = document.getElementById('corr-value')?.value.trim();
    const reason = document.getElementById('corr-reason')?.value.trim();

    if (!proposedVal || !reason) {
      Toast.error('Please enter proposed value and reason.');
      return;
    }

    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Submitting Proposal...';
      }

      await Api.requestCorrection(params.id, {
        field,
        proposed_value: proposedVal,
        reason,
      });

      Toast.success('Correction request submitted! Waiting for counterparty decision.');
      window.location.hash = `#/transactions/${params.id}`;
    } catch (err) {
      Toast.error(err.message || 'Failed to submit correction request.');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerText = 'Submit Correction Request';
      }
    }
  });
};
