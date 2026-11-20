/**
 * Dual-Custody Digital Passbook Screen
 * Tabler 1.7.4 Enterprise Design System
 * Displays cumulative fine gold balance, issued vs returned totals,
 * disputed held quantities, and exportable ledger.
 */

import { Api } from '../api.js';
import { Auth } from '../auth.js';
import { State } from '../state.js';
import { renderStatCard } from '../components/stat_card.js';
import { ExportService } from '../services/export_service.js';
import { Toast } from '../components/toast.js';

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function renderPassbook() {
  const user = Auth.getUser();
  const karigarId = user?.role === 'karigar' ? user.id : 2;

  let passbookData = null;
  let loadError = null;

  try {
    passbookData = await Api.getPassbook(karigarId);
  } catch (err) {
    loadError = err.message || 'Could not load passbook ledger';
    return `
      <div class="container-xl py-4">
        <div class="alert alert-danger border shadow-none" role="alert">
          <div class="d-flex">
            <div>
              <svg class="icon alert-icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>
            <div>
              <h4 class="alert-title">Passbook Load Error</h4>
              <div class="text-secondary">${escapeHtml(loadError)}</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  const { totals = {}, orders = [] } = passbookData || {};

  return `
    <div class="container-xl py-3">
      <!-- Page Header -->
      <div class="page-header d-print-none mb-3">
        <div class="row g-2 align-items-center">
          <div class="col">
            <div class="page-pretitle text-uppercase tracking-wider text-muted fs-5">Artisan Account</div>
            <h2 class="page-title fs-2 fw-bold text-dark">
              ${State.t('passbook.title') || 'Digital Gold Passbook'}
            </h2>
            <div class="text-muted fs-4">
              Dual-Custody Ledger for Artisan #${karigarId} <span class="badge bg-light text-dark font-monospace border ms-1">Active Ledger</span>
            </div>
          </div>

          <!-- Export Actions -->
          <div class="col-auto ms-auto d-print-none">
            <div class="btn-list">
              <button id="export-csv-btn" class="btn btn-outline-secondary">
                <svg class="icon me-1" width="18" height="18" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z"/><path d="M10 12l4 4m0 -4l-4 4"/></svg>
                Export CSV
              </button>
              <button id="export-json-btn" class="btn btn-outline-dark">
                <svg class="icon me-1" width="18" height="18" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
                Export JSON
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Stat Cards Grid -->
      <div class="row row-cards g-3 mb-4">
        <div class="col-sm-6 col-lg-3">
          ${renderStatCard({
            title: 'Fine Gold Balance',
            value: totals.gold_in_hand_fine_g || '0.0000',
            unit: State.t('common.grams') || 'g',
            subtitle: 'Active metal in artisan custody',
            icon: `<svg class="icon icon-lg" width="24" height="24" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" fill="none"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><line x1="12" y1="3" x2="12" y2="21"/><path d="M9 8l6 0"/><path d="M6 15l12 0"/></svg>`,
            color: 'gold',
          })}
        </div>

        <div class="col-sm-6 col-lg-3">
          ${renderStatCard({
            title: 'Fine Gold Issued',
            value: totals.issued_fine_g || '0.0000',
            unit: State.t('common.grams') || 'g',
            subtitle: 'Total fine gold handed over',
            icon: `<svg class="icon icon-lg" width="24" height="24" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" fill="none"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><line x1="12" y1="5" x2="12" y2="19"/><line x1="18" y1="11" x2="12" y2="5"/><line x1="6" y1="11" x2="12" y2="5"/></svg>`,
            color: 'info',
          })}
        </div>

        <div class="col-sm-6 col-lg-3">
          ${renderStatCard({
            title: 'Fine Gold Returned',
            value: totals.returned_fine_g || '0.0000',
            unit: State.t('common.grams') || 'g',
            subtitle: 'Articles + recovered scrap',
            icon: `<svg class="icon icon-lg" width="24" height="24" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" fill="none"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><line x1="12" y1="5" x2="12" y2="19"/><line x1="18" y1="13" x2="12" y2="19"/><line x1="6" y1="13" x2="12" y2="19"/></svg>`,
            color: 'success',
          })}
        </div>

        <div class="col-sm-6 col-lg-3">
          ${renderStatCard({
            title: State.t('passbook.held_gold') || 'Held in Dispute',
            value: totals.held_in_dispute_g || '0.0000',
            unit: State.t('common.grams') || 'g',
            subtitle: 'Frozen in active dispute escrow',
            icon: `<svg class="icon icon-lg" width="24" height="24" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" fill="none"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 3a12 12 0 0 0 8.5 3a12 12 0 0 1 -8.5 15a12 12 0 0 1 -8.5 -15a12 12 0 0 0 8.5 -3"/></svg>`,
            color: 'warning',
          })}
        </div>
      </div>

      <!-- Orders Account Ledger Table -->
      <div class="card border shadow-none">
        <div class="card-header py-3 bg-white border-bottom d-flex justify-content-between align-items-center">
          <h3 class="card-title fw-bold text-dark m-0">Contract Account Ledger</h3>
          <span class="badge bg-secondary-subtle text-secondary fw-medium px-2 py-1">
            ${orders.length} ${orders.length === 1 ? 'Contract' : 'Contracts'}
          </span>
        </div>

        ${orders.length === 0 ? `
          <div class="card-body py-5 text-center text-muted">
            <p class="fs-4 mb-0">No order history available for this account.</p>
          </div>
        ` : `
          <div class="table-responsive">
            <table class="table table-vcenter card-table table-hover table-striped">
              <thead>
                <tr>
                  <th class="w-1 text-muted text-uppercase text-xs tracking-wider">Order ID</th>
                  <th class="text-muted text-uppercase text-xs tracking-wider">Contract Description</th>
                  <th class="text-muted text-uppercase text-xs tracking-wider">Target Due Date</th>
                  <th class="text-muted text-uppercase text-xs tracking-wider">Ledger Status</th>
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
                      ${escapeHtml(o.description || '')}
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
                      <span class="badge bg-light text-dark border font-monospace text-uppercase px-2 py-1">
                        ${escapeHtml(o.status || 'OPEN')}
                      </span>
                    </td>
                    <td class="text-end text-nowrap">
                      <a href="#/orders/${o.id}" class="btn btn-sm btn-outline-secondary">
                        View Contract
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

renderPassbook.afterRender = () => {
  const csvBtn = document.getElementById('export-csv-btn');
  const jsonBtn = document.getElementById('export-json-btn');

  if (csvBtn) {
    csvBtn.addEventListener('click', async () => {
      try {
        const user = Auth.getUser();
        const karigarId = user?.role === 'karigar' ? user.id : 2;
        const data = await Api.getPassbook(karigarId);
        const headers = ['Order_ID', 'Description', 'Due_Date', 'Status'];
        const rows = (data.orders || []).map((o) => [
          o.id,
          o.description || '',
          o.due_date || '',
          o.status || '',
        ]);
        ExportService.downloadCsv(`passbook_karigar_${karigarId}.csv`, headers, rows);
        Toast.success('Passbook CSV exported successfully.');
      } catch (e) {
        Toast.error('Export failed: ' + e.message);
      }
    });
  }

  if (jsonBtn) {
    jsonBtn.addEventListener('click', async () => {
      try {
        const user = Auth.getUser();
        const karigarId = user?.role === 'karigar' ? user.id : 2;
        const data = await Api.getPassbook(karigarId);
        ExportService.downloadJson(`passbook_karigar_${karigarId}.json`, data);
        Toast.success('Passbook JSON exported successfully.');
      } catch (e) {
        Toast.error('Export failed: ' + e.message);
      }
    });
  }
};
