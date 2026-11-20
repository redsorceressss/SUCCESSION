/**
 * Order Settlement Screen
 * Tabler 1.7.4 Enterprise Design System
 * Core Dual-Custody Invariant:
 * 1. AI Agent may only DRAFT settlements (never approve or modify balances).
 * 2. Human approval is strictly required from BOTH Jeweller and Karigar.
 * 3. If an open dispute exists, approval is blocked UNLESS accept_partial=true.
 */

import { Api } from '../api.js';
import { Auth } from '../auth.js';
import { State } from '../state.js';
import { renderStateBadge } from '../components/badge.js';
import { Toast } from '../components/toast.js';
import { Modal } from '../components/modal.js';

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function renderSettlement() {
  const hash = window.location.hash;
  const urlParams = new URLSearchParams(hash.includes('?') ? hash.split('?')[1] : '');
  const orderId = urlParams.get('order_id') || '1';

  let settlements = [];
  let summary = null;
  let order = null;
  let loadError = null;

  try {
    order = await Api.getOrder(orderId);
    summary = await Api.getOrderSummary(orderId);
    settlements = await Api.getSettlements(orderId);
  } catch (err) {
    loadError = err.message || 'Could not load settlement details';
    return `
      <div class="container-xl py-4">
        <div class="alert alert-danger border shadow-none" role="alert">
          <h4 class="alert-title">Settlement Load Error</h4>
          <div class="text-secondary">${escapeHtml(loadError)}</div>
          <div class="mt-3">
            <a href="#/orders" class="btn btn-outline-danger btn-sm">Return to Orders</a>
          </div>
        </div>
      </div>
    `;
  }

  const user = Auth.getUser();
  const latestDraft = settlements[settlements.length - 1] || null;
  const recon = summary?.reconciliation || {};
  const gapGrams = recon.unexplained_gap_g || summary?.unexplained_gap_g || '0.0000';
  const isBalanced = gapGrams === '0.0000';

  const jewellerApproved = latestDraft?.approvals?.some((a) => a.user_id === order.jeweller_id && a.decision === 'APPROVE');
  const karigarApproved = latestDraft?.approvals?.some((a) => a.user_id === order.karigar_id && a.decision === 'APPROVE');

  return `
    <div class="container-xl py-3">
      <!-- Breadcrumbs -->
      <nav aria-label="breadcrumb" class="mb-3">
        <ol class="breadcrumb">
          <li class="breadcrumb-item"><a href="#/orders" class="text-muted">Job-Work Orders</a></li>
          <li class="breadcrumb-item"><a href="#/orders/${order.id}" class="text-muted">Contract #${order.id}</a></li>
          <li class="breadcrumb-item active text-dark fw-semibold" aria-current="page">Final Settlement</li>
        </ol>
      </nav>

      <!-- Page Header -->
      <div class="page-header d-print-none mb-3">
        <div class="row g-2 align-items-center">
          <div class="col">
            <div class="d-flex align-items-center gap-2 mb-1">
              <span class="badge bg-light text-dark font-monospace border">Contract #${order.id}</span>
              ${renderStateBadge(summary?.reconciliation?.status || summary?.status || 'UNKNOWN')}
            </div>
            <h2 class="page-title fs-2 fw-bold text-dark">
              Final Account Settlement & Discharge
            </h2>
            <div class="text-muted fs-4">
              Dual-custody bilateral closure for <strong>${escapeHtml(order.description)}</strong>
            </div>
          </div>

          <div class="col-auto ms-auto d-print-none">
            <button id="create-draft-btn" class="btn btn-outline-primary">
              <svg class="icon me-1" width="18" height="18" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>
              Generate New Settlement Draft
            </button>
          </div>
        </div>
      </div>

      <!-- Conservation Mass Balance Audit Card -->
      <div class="card border shadow-none mb-3">
        <div class="card-header py-3 bg-white border-bottom d-flex justify-content-between align-items-center">
          <div>
            <h3 class="card-title fw-bold text-dark m-0">Mass Balance Accounting Verification</h3>
            <div class="text-xs text-muted">Authoritative fine-gold ledger balance computed by core conservation rules</div>
          </div>
          <div>
            ${renderStateBadge(recon.status || summary?.status || 'BALANCED')}
          </div>
        </div>
        <div class="card-body p-3">
          <div class="row row-cards g-2 text-center">
            <div class="col-sm-6 col-lg-3">
              <div class="card card-sm border bg-light shadow-none">
                <div class="card-body p-3">
                  <div class="text-muted text-xs text-uppercase fw-semibold mb-1">Issued (Fine Gold)</div>
                  <div class="fs-2 fw-bold font-monospace text-dark">${summary?.issued_fine_g || '0.0000'} g</div>
                </div>
              </div>
            </div>

            <div class="col-sm-6 col-lg-3">
              <div class="card card-sm border bg-light shadow-none">
                <div class="card-body p-3">
                  <div class="text-muted text-xs text-uppercase fw-semibold mb-1">Returned (Fine Gold)</div>
                  <div class="fs-2 fw-bold font-monospace text-dark">${summary?.returned_fine_g || '0.0000'} g</div>
                </div>
              </div>
            </div>

            <div class="col-sm-6 col-lg-3">
              <div class="card card-sm border bg-light shadow-none">
                <div class="card-body p-3">
                  <div class="text-muted text-xs text-uppercase fw-semibold mb-1">Recovered Scrap</div>
                  <div class="fs-2 fw-bold font-monospace text-dark">${summary?.recovered_scrap_fine_g || '0.0000'} g</div>
                </div>
              </div>
            </div>

            <div class="col-sm-6 col-lg-3">
              <div class="card card-sm border shadow-none ${isBalanced ? 'bg-success-subtle text-success' : 'bg-warning-subtle text-warning'}">
                <div class="card-body p-3">
                  <div class="text-xs text-uppercase fw-semibold mb-1 ${isBalanced ? 'text-success' : 'text-warning'}">Unexplained Variance</div>
                  <div class="fs-2 fw-bold font-monospace">${gapGrams} g</div>
                </div>
              </div>
            </div>
          </div>

          ${summary?.has_holds ? `
            <div class="alert alert-warning border mt-3 mb-0" role="alert">
              <div class="d-flex align-items-center">
                <svg class="icon alert-icon me-2" width="20" height="20" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <div class="text-xs">
                  <strong>Active Dispute Quarantine:</strong> Part of this contract is held in dispute escrow. A full settlement is blocked by protocol until disputes are resolved. You may approve as a <strong>Partial Settlement</strong> to finalize undisputed quantities while leaving holds safely quarantined.
                </div>
              </div>
            </div>
          ` : ''}
        </div>
      </div>

      <!-- Settlement Agreement & Dual Approval Card -->
      <div class="card border shadow-none">
        <div class="card-header py-3 bg-white border-bottom d-flex justify-content-between align-items-center">
          <div>
            <h3 class="card-title fw-bold text-dark m-0">Dual-Custody Bilateral Approval</h3>
            <div class="text-xs text-muted">Strict human sign-off required from both parties; AI agent cannot approve</div>
          </div>
          <div>
            ${latestDraft ? renderStateBadge(latestDraft.state) : '<span class="badge bg-light text-muted border">No Active Draft</span>'}
          </div>
        </div>

        <div class="card-body p-4">
          ${!latestDraft ? `
            <div class="py-5 text-center text-muted">
              <p class="fs-4 mb-2">No settlement draft has been generated for this contract.</p>
              <button id="create-draft-btn-empty" class="btn btn-primary">
                Generate Settlement Draft
              </button>
            </div>
          ` : `
            <div class="d-flex align-items-center gap-2 mb-3">
              <span class="badge bg-light text-dark font-monospace border">Draft #${latestDraft.id}</span>
              <span class="text-muted text-xs">Generated by User #${latestDraft.created_by} • ${escapeHtml(latestDraft.created_at || 'Recent')}</span>
              ${latestDraft.partial ? `<span class="badge bg-warning-subtle text-warning">Partial Settlement (Excludes Holds)</span>` : ''}
            </div>

            <!-- Dual Approval Cards -->
            <div class="row row-cards g-3 mb-4">
              <!-- Party A: Jeweller -->
              <div class="col-md-6">
                <div class="card card-sm border shadow-none ${jewellerApproved ? 'bg-success-subtle border-success' : 'bg-light'}">
                  <div class="card-body p-3 d-flex align-items-center justify-content-between">
                    <div>
                      <div class="text-muted text-xs text-uppercase fw-semibold">Party A — Jeweller Custodian</div>
                      <div class="fw-bold text-dark fs-3 mt-1">Jeweller Sign-Off</div>
                      <div class="text-xs text-muted">Account #${order.jeweller_id}</div>
                    </div>
                    <div>
                      ${jewellerApproved ? `
                        <span class="badge bg-success text-white px-3 py-2 fw-semibold">
                          <svg class="icon me-1" width="16" height="16" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 12l5 5l10 -10"/></svg>
                          Approved
                        </span>
                      ` : `
                        <span class="badge bg-warning-subtle text-warning px-3 py-2 fw-semibold">
                          <svg class="icon me-1" width="16" height="16" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/></svg>
                          Awaiting Approval
                        </span>
                      `}
                    </div>
                  </div>
                </div>
              </div>

              <!-- Party B: Karigar -->
              <div class="col-md-6">
                <div class="card card-sm border shadow-none ${karigarApproved ? 'bg-success-subtle border-success' : 'bg-light'}">
                  <div class="card-body p-3 d-flex align-items-center justify-content-between">
                    <div>
                      <div class="text-muted text-xs text-uppercase fw-semibold">Party B — Artisan Maker</div>
                      <div class="fw-bold text-dark fs-3 mt-1">Karigar Sign-Off</div>
                      <div class="text-xs text-muted">Account #${order.karigar_id}</div>
                    </div>
                    <div>
                      ${karigarApproved ? `
                        <span class="badge bg-success text-white px-3 py-2 fw-semibold">
                          <svg class="icon me-1" width="16" height="16" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 12l5 5l10 -10"/></svg>
                          Approved
                        </span>
                      ` : `
                        <span class="badge bg-warning-subtle text-warning px-3 py-2 fw-semibold">
                          <svg class="icon me-1" width="16" height="16" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/></svg>
                          Awaiting Approval
                        </span>
                      `}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            ${latestDraft.state === 'DRAFT' ? `
              <div class="d-flex flex-wrap gap-2 justify-content-between align-items-center pt-3 border-top">
                <div class="text-xs text-muted">
                  Approving this settlement commits the discharge into the cryptographic hash chain.
                </div>
                <div class="btn-list">
                  <button id="reject-settlement-btn" class="btn btn-outline-danger">
                    Reject Draft
                  </button>
                  ${summary?.has_holds ? `
                    <button id="approve-partial-btn" class="btn btn-warning px-4">
                      Approve Partial Settlement (Keep Holds Quarantined)
                    </button>
                  ` : `
                    <button id="approve-full-btn" class="btn btn-success px-4">
                      <svg class="icon me-1" width="18" height="18" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 12l5 5l10 -10"/></svg>
                      Approve Full Settlement
                    </button>
                  `}
                </div>
              </div>
            ` : ''}
          `}
        </div>
      </div>
    </div>
  `;
}

renderSettlement.afterRender = () => {
  const hash = window.location.hash;
  const urlParams = new URLSearchParams(hash.includes('?') ? hash.split('?')[1] : '');
  const orderId = urlParams.get('order_id') || '1';

  const attachDraftHandler = (btnId) => {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.addEventListener('click', async () => {
      try {
        await Api.createSettlement(Number(orderId));
        Toast.success('Settlement draft generated successfully.');
        window.location.reload();
      } catch (err) {
        Toast.error(err.message || 'Failed to generate settlement draft.');
      }
    });
  };

  attachDraftHandler('create-draft-btn');
  attachDraftHandler('create-draft-btn-empty');

  const approveFullBtn = document.getElementById('approve-full-btn');
  const approvePartialBtn = document.getElementById('approve-partial-btn');
  const rejectBtn = document.getElementById('reject-settlement-btn');

  const getLatestSid = async () => {
    const list = await Api.getSettlements(orderId);
    return list[list.length - 1]?.id;
  };

  if (approveFullBtn) {
    approveFullBtn.addEventListener('click', async () => {
      try {
        const sid = await getLatestSid();
        await Api.approveSettlement(sid, { accept_partial: false });
        Toast.success('Full settlement approval committed!');
        window.location.reload();
      } catch (err) {
        Toast.error(err.message || 'Approval failed.');
      }
    });
  }

  if (approvePartialBtn) {
    approvePartialBtn.addEventListener('click', async () => {
      try {
        const sid = await getLatestSid();
        await Api.approveSettlement(sid, { accept_partial: true });
        Toast.success('Partial settlement approval committed! Held dispute amounts remain quarantined.');
        window.location.reload();
      } catch (err) {
        Toast.error(err.message || 'Partial approval failed.');
      }
    });
  }

  if (rejectBtn) {
    rejectBtn.addEventListener('click', async () => {
      try {
        const sid = await getLatestSid();
        await Api.rejectSettlement(sid, { reason: 'Accounts re-audit required' });
        Toast.warning('Settlement draft rejected.');
        window.location.reload();
      } catch (err) {
        Toast.error(err.message || 'Rejection failed.');
      }
    });
  }
};
