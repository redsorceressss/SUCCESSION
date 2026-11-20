/**
 * Order Detail & Metal Conservation Screen
 * Tabler 1.7.4 Enterprise Design System
 * Displays real-time mass-balance conservation and custody history for an order contract.
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

export async function renderOrderDetail(params) {
  const orderId = params.id;
  let order = null;
  let summary = null;
  let transactions = [];
  let loadError = null;

  try {
    order = await Api.getOrder(orderId);
    summary = await Api.getOrderSummary(orderId);
    transactions = await Api.getTransactions(orderId);
  } catch (err) {
    loadError = err.message || 'Could not load order details';
    return `
      <div class="container-xl py-4">
        <div class="alert alert-danger border shadow-none" role="alert">
          <div class="d-flex">
            <div>
              <svg class="icon alert-icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>
            <div>
              <h4 class="alert-title">Contract Load Error</h4>
              <div class="text-secondary">${escapeHtml(loadError)}</div>
              <div class="mt-3">
                <a href="#/orders" class="btn btn-outline-danger btn-sm">Return to Orders</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  const isJeweller = Auth.isJeweller();
  const recon = summary?.reconciliation || {};
  const gapGrams = recon.unexplained_gap_g || summary?.unexplained_gap_g || '0.0000';
  const isBalanced = gapGrams === '0.0000';

  return `
    <div class="container-xl py-3">
      <!-- Breadcrumb Navigation -->
      <nav aria-label="breadcrumb" class="mb-3">
        <ol class="breadcrumb">
          <li class="breadcrumb-item"><a href="#/orders" class="text-muted">Job-Work Orders</a></li>
          <li class="breadcrumb-item active text-dark fw-semibold" aria-current="page">Contract #${order.id}</li>
        </ol>
      </nav>

      <!-- Page Header -->
      <div class="page-header d-print-none mb-3">
        <div class="row g-2 align-items-center">
          <div class="col">
            <div class="d-flex align-items-center gap-2 mb-1">
              <span class="badge bg-light text-dark font-monospace border">#${order.id}</span>
              ${renderStateBadge(order.status)}
            </div>
            <h2 class="page-title fs-2 fw-bold text-dark">
              ${escapeHtml(order.description)}
            </h2>
            <div class="text-muted fs-4 mt-1">
              Agreed Wastage Allowance: <strong class="text-dark font-monospace">${Number(order.wastage_pct || 0).toFixed(3)}%</strong>
              <span class="mx-2">•</span>
              Target Due Date: <strong class="text-dark">${escapeHtml(order.due_date || 'None specified')}</strong>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="col-auto ms-auto d-print-none">
            <div class="btn-list">
              ${isJeweller ? `
                <a href="#/issue?order_id=${order.id}" class="btn btn-primary">
                  <svg class="icon me-1" width="18" height="18" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Issue Raw Gold
                </a>
              ` : ''}
              <a href="#/return?order_id=${order.id}" class="btn btn-outline-secondary">
                <svg class="icon me-1" width="18" height="18" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M9 11l-4 4l4 4m-4 -4h11a4 4 0 0 0 0 -8h-1"/></svg>
                Return Ornaments / Scrap
              </a>
              <a href="#/settlement?order_id=${order.id}" class="btn btn-outline-dark">
                <svg class="icon me-1" width="18" height="18" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z"/><line x1="9" y1="14" x2="15" y2="14"/></svg>
                Settlement
              </a>
            </div>
          </div>
        </div>
      </div>

      <!-- Metal Conservation Reconciliation Card -->
      <div class="card border shadow-none mb-3">
        <div class="card-header py-3 bg-white border-bottom d-flex justify-content-between align-items-center">
          <div>
            <h3 class="card-title fw-bold text-dark m-0">Mass Balance & Metal Conservation</h3>
            <div class="text-xs text-muted">First law of thermodynamics applied to gold ledger custody</div>
          </div>
          <div>
            ${renderStateBadge(recon.status || summary?.status || 'BALANCED')}
          </div>
        </div>
        <div class="card-body p-3">
          <div class="row row-cards g-2">
            <!-- Issued Fine Gold -->
            <div class="col-sm-6 col-lg-3">
              <div class="card card-sm border bg-light shadow-none">
                <div class="card-body p-3">
                  <div class="d-flex align-items-center">
                    <div class="subheader text-muted text-uppercase text-xs fw-semibold">Issued (Fine Gold)</div>
                  </div>
                  <div class="h2 mb-0 font-monospace fw-bold text-dark mt-1">
                    ${summary?.issued_fine_g || '0.0000'} <span class="fs-4 fw-normal text-muted">g</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Returned Fine Gold -->
            <div class="col-sm-6 col-lg-3">
              <div class="card card-sm border bg-light shadow-none">
                <div class="card-body p-3">
                  <div class="d-flex align-items-center">
                    <div class="subheader text-muted text-uppercase text-xs fw-semibold">Returned (Fine Gold)</div>
                  </div>
                  <div class="h2 mb-0 font-monospace fw-bold text-dark mt-1">
                    ${summary?.returned_fine_g || '0.0000'} <span class="fs-4 fw-normal text-muted">g</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Scrap Recovered -->
            <div class="col-sm-6 col-lg-3">
              <div class="card card-sm border bg-light shadow-none">
                <div class="card-body p-3">
                  <div class="d-flex align-items-center">
                    <div class="subheader text-muted text-uppercase text-xs fw-semibold">Scrap Recovered</div>
                  </div>
                  <div class="h2 mb-0 font-monospace fw-bold text-dark mt-1">
                    ${summary?.recovered_scrap_fine_g || '0.0000'} <span class="fs-4 fw-normal text-muted">g</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Unexplained Gap -->
            <div class="col-sm-6 col-lg-3">
              <div class="card card-sm border shadow-none ${isBalanced ? 'bg-success-subtle text-success' : 'bg-warning-subtle text-warning'}">
                <div class="card-body p-3">
                  <div class="d-flex align-items-center">
                    <div class="subheader text-uppercase text-xs fw-semibold ${isBalanced ? 'text-success' : 'text-warning'}">Unexplained Variance</div>
                  </div>
                  <div class="h2 mb-0 font-monospace fw-bold mt-1">
                    ${gapGrams} <span class="fs-4 fw-normal">g</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          ${summary?.has_holds ? `
            <div class="alert alert-warning border mt-3 mb-0" role="alert">
              <div class="d-flex align-items-center">
                <svg class="icon alert-icon me-2" width="20" height="20" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <div class="text-xs">
                  <strong>Active Dispute Hold:</strong> Disputed quantities on this contract are isolated in <code>SettlementHold</code> records. Held gold is legally excluded from settlement until counterparty resolution approval.
                </div>
              </div>
            </div>
          ` : ''}
        </div>
      </div>

      <!-- Custody & Handover Ledger -->
      <div class="card border shadow-none">
        <div class="card-header py-3 bg-white border-bottom d-flex justify-content-between align-items-center">
          <h3 class="card-title fw-bold text-dark m-0">Custody Handover Ledger</h3>
          <span class="badge bg-secondary-subtle text-secondary fw-medium px-2 py-1">
            ${transactions.length} ${transactions.length === 1 ? 'Transaction' : 'Transactions'}
          </span>
        </div>

        ${transactions.length === 0 ? `
          <div class="card-body py-5 text-center text-muted">
            <p class="fs-4 mb-2">No custody handovers recorded yet for this contract.</p>
            ${isJeweller ? `
              <a href="#/issue?order_id=${order.id}" class="btn btn-outline-primary btn-sm">
                Record First Gold Issue
              </a>
            ` : ''}
          </div>
        ` : `
          <div class="table-responsive">
            <table class="table table-vcenter card-table table-hover table-striped">
              <thead>
                <tr>
                  <th class="w-1 text-muted text-uppercase text-xs tracking-wider">Tx #</th>
                  <th class="text-muted text-uppercase text-xs tracking-wider">Type</th>
                  <th class="text-muted text-uppercase text-xs tracking-wider">Gross Weight</th>
                  <th class="text-muted text-uppercase text-xs tracking-wider">Purity</th>
                  <th class="text-muted text-uppercase text-xs tracking-wider">Scrap Return</th>
                  <th class="text-muted text-uppercase text-xs tracking-wider">Status</th>
                  <th class="text-muted text-uppercase text-xs tracking-wider">Version</th>
                  <th class="w-1 text-end text-muted text-uppercase text-xs tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody>
                ${transactions.map((t) => {
                  const curVer = t.current_version && typeof t.current_version === 'object' ? t.current_version : {};
                  const weight = curVer.weight_g ?? t.weight_g;
                  const karat = curVer.karat ?? t.karat;
                  const scrap = curVer.scrap_g ?? t.scrap_g;
                  const vNo = curVer.version_no ?? t.current_version;
                  const isPendingReview = t.state === 'AWAITING_CONFIRMATION';

                  return `
                    <tr>
                      <td class="text-nowrap">
                        <span class="badge bg-light text-dark font-monospace border">#${t.id}</span>
                      </td>
                      <td>
                        <span class="badge ${t.kind === 'issue' ? 'bg-primary-subtle text-primary' : 'bg-warning-subtle text-warning'} fw-semibold text-uppercase px-2 py-1">
                          ${t.kind}
                        </span>
                      </td>
                      <td class="font-monospace fw-bold text-dark">
                        ${weight} g
                      </td>
                      <td>
                        ${renderPurityBadge(karat)}
                      </td>
                      <td class="font-monospace text-muted">
                        ${scrap && scrap !== '0.0000' ? `${scrap} g` : '—'}
                      </td>
                      <td>
                        ${renderStateBadge(t.state)}
                      </td>
                      <td class="text-muted text-xs font-monospace">
                        v${vNo}
                      </td>
                      <td class="text-end text-nowrap">
                        <a href="#/transactions/${t.id}" class="btn btn-sm btn-outline-secondary">
                          Details
                        </a>
                        ${isPendingReview ? `
                          <a href="#/transactions/${t.id}/confirm" class="btn btn-sm btn-primary ms-1">
                            Review & Sign
                          </a>
                        ` : ''}
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    </div>
  `;
}
