/**
 * Dashboard Screen
 * Tabler 1.7.4 Enterprise Fintech Redesign
 * Displays authoritative real-time gold accounting metrics from FastAPI backend.
 */

import { Api, request } from '../api.js';
import { Auth } from '../auth.js';
import { State } from '../state.js';
import { renderStatCard } from '../components/stat_card.js';
import { renderStateBadge, renderPurityBadge } from '../components/badge.js';
import { syncQueue } from '../offline/sync.js';
import { Toast } from '../components/toast.js';
import { getAttentionOps, getQueueSummary } from '../offline/queue.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatSyncReason(op) {
  const err = op?.lastError || '';
  const endpoint = op?.endpoint || '';
  const kind = op?.kind || '';
  const label = kind || endpoint || 'operation';
  return err ? `${label}: ${err}` : label;
}

function toNum(v){ const n = Number(String(v ?? '0').replace(/,/g,'')); return Number.isFinite(n) ? n : 0; }
function fmtG(v){ return toNum(v).toFixed(4); }
function renderBarChart(title, subtitle, items){
  const safe = (items||[]).map(i=>({label:String(i.label||''), value:Math.max(0,toNum(i.value)), color:i.color||'#8A6420', suffix:i.suffix||''}));
  const max = Math.max(1, ...safe.map(i=>i.value));
  if (safe.length === 0) return `<div class="text-muted text-sm">No data available.</div>`;
  return `
    <div>
      <div class="fw-semibold text-dark mb-1">${escapeHtml(title)}</div>
      ${subtitle ? `<div class="text-muted text-xs mb-3">${escapeHtml(subtitle)}</div>` : ''}
      <div class="d-flex flex-column gap-2">
        ${safe.map(i=>{
          const pct = Math.max(2, Math.round((i.value/max)*100));
          return `<div>
            <div class="d-flex justify-content-between align-items-center text-xs mb-1">
              <span class="text-muted">${escapeHtml(i.label)}</span>
              <span class="font-monospace text-dark">${fmtG(i.value)}${i.suffix?escapeHtml(i.suffix):''}</span>
            </div>
            <div style="height:10px;background:#efe7d8;border-radius:999px;overflow:hidden;">
              <div style="height:100%;width:${pct}%;background:${i.color};border-radius:999px;"></div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
}
function renderDonutChart(title, subtitle, segments){
  const segs = (segments||[]).map(s=>({label:String(s.label||''), value:Math.max(0,toNum(s.value)), color:s.color||'#8A6420'})).filter(s=>s.value>0);
  const total = segs.reduce((a,b)=>a+b.value,0);
  if (!segs.length || total <= 0) {
    return `<div><div class="fw-semibold text-dark mb-1">${escapeHtml(title)}</div>${subtitle?`<div class="text-muted text-xs mb-2">${escapeHtml(subtitle)}</div>`:''}<div class="text-muted text-sm">No data available yet.</div></div>`;
  }
  const r=42,c=2*Math.PI*r; let off=0;
  const circles = segs.map(s=>{
    const len=(s.value/total)*c; const dash=`${len} ${c-len}`; const el=`<circle cx="60" cy="60" r="${r}" fill="none" stroke="${s.color}" stroke-width="14" stroke-dasharray="${dash}" stroke-dashoffset="${-off}" transform="rotate(-90 60 60)"></circle>`; off+=len; return el;
  }).join('');
  return `
    <div>
      <div class="fw-semibold text-dark mb-1">${escapeHtml(title)}</div>
      ${subtitle ? `<div class="text-muted text-xs mb-3">${escapeHtml(subtitle)}</div>` : ''}
      <div class="d-flex gap-3 align-items-center flex-wrap">
        <div style="position:relative;width:140px;height:140px;flex:0 0 140px;">
          <svg viewBox="0 0 120 120" width="140" height="140" role="img" aria-label="${escapeHtml(title)}">
            <circle cx="60" cy="60" r="${r}" fill="none" stroke="#efe7d8" stroke-width="14"></circle>
            ${circles}
          </svg>
          <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;line-height:1.1;">
            <div class="fw-bold text-dark">${total.toFixed(0)}</div>
            <div class="text-muted text-xs">total</div>
          </div>
        </div>
        <div class="d-flex flex-column gap-1 text-xs">
          ${segs.map(s=>`<div class="d-flex align-items-center gap-2"><span style="width:10px;height:10px;border-radius:2px;background:${s.color};display:inline-block"></span><span class="text-muted">${escapeHtml(s.label)}</span><span class="font-monospace text-dark ms-1">${s.value.toFixed(0)}</span></div>`).join('')}
        </div>
      </div>
    </div>`;
}

export async function renderDashboard() {
  const user = Auth.getUser();
  const isJeweller = Auth.isJeweller();
  const isAssayer = Auth.isAssayer && Auth.isAssayer();

  // Assayer-specific dashboard: assigned verification tasks only
  if (isAssayer) {
    let tasksPayload = { tasks: [], count: 0 };
    let loadError = null;
    try {
      tasksPayload = await Api.getAssayerTasks();
    } catch (e) {
      loadError = e?.message || 'Failed to load assigned verification tasks';
    }
    const tasks = Array.isArray(tasksPayload?.tasks) ? tasksPayload.tasks : [];
    const pending = tasks.filter((t) => ['PENDING_REWEIGH_REQUEST', 'PENDING_RESULT', 'PENDING_VERIFICATION'].includes(t.verification_status)).length;
    const submitted = tasks.filter((t) => t.verification_status === 'SUBMITTED_RESULT').length;
    const completed = tasks.filter((t) => t.verification_status === 'COMPLETED').length;

    return `
      <div class="page-container py-3">
        <div class="page-header d-print-none mb-3">
          <div class="container-xl">
            <div class="row g-2 align-items-center">
              <div class="col">
                <div class="metric-subheader">Assayer Dashboard</div>
                <h2 class="page-title text-dark d-flex align-items-center gap-2">
                  <span>Independent Verification Workspace</span>
                  <span class="badge badge-gold fs-6">ASSAYER</span>
                </h2>
                <div class="text-muted">View and complete only disputes explicitly assigned to you. Access is scoped and auditable.</div>
              </div>
              <div class="col-auto ms-auto d-print-none">
                <a href="#/assayer/tasks" class="btn btn-primary">Open Verification Tasks</a>
              </div>
            </div>
          </div>
        </div>

        <div class="container-xl">
          ${loadError ? `
            <div class="alert alert-danger" role="alert">
              <h4 class="alert-title">Unable to load assayer tasks</h4>
              <div class="text-secondary">${escapeHtml(loadError)}</div>
            </div>
          ` : ''}

          <div class="row row-cards mb-3">
            <div class="col-sm-6 col-lg-3">${renderStatCard({ title: 'Assigned Tasks', value: String(tasks.length), unit: '', subtitle: 'Active assignments', icon: '🧪', color: 'gold' })}</div>
            <div class="col-sm-6 col-lg-3">${renderStatCard({ title: 'Pending Actions', value: String(pending), unit: '', subtitle: 'Awaiting result/verification', icon: '⏳', color: pending > 0 ? 'warning' : 'forest' })}</div>
            <div class="col-sm-6 col-lg-3">${renderStatCard({ title: 'Submitted', value: String(submitted), unit: '', subtitle: 'Results submitted by you', icon: '📤', color: 'info' })}</div>
            <div class="col-sm-6 col-lg-3">${renderStatCard({ title: 'Completed', value: String(completed), unit: '', subtitle: 'Independent verifications done', icon: '✅', color: 'forest' })}</div>
          </div>

          <div class="card border shadow-none">
            <div class="card-header bg-white border-bottom d-flex justify-content-between align-items-center">
              <h3 class="card-title mb-0">Recent Assigned Tasks</h3>
              <a href="#/assayer/tasks" class="btn btn-sm btn-outline-primary">View All</a>
            </div>
            ${tasks.length === 0 ? `
              <div class="card-body"><div class="empty py-4"><p class="empty-title">No assigned verification tasks</p><p class="empty-subtitle text-muted">Assignments from authorized parties will appear here.</p></div></div>
            ` : `
              <div class="table-responsive">
                <table class="table table-vcenter card-table">
                  <thead><tr><th>Dispute</th><th>Transaction</th><th>Order</th><th>Verification Status</th><th>Action</th></tr></thead>
                  <tbody>
                    ${tasks.slice(0, 8).map((t) => `
                      <tr>
                        <td><span class="badge bg-light text-dark border font-monospace">#${escapeHtml(t?.dispute?.id)}</span></td>
                        <td class="font-monospace">#${escapeHtml(t?.dispute?.transaction_id ?? '-')}</td>
                        <td>${escapeHtml(t?.order?.description || `Order #${t?.order?.id || '-'}`)}</td>
                        <td><span class="badge bg-secondary-lt text-secondary">${escapeHtml((t?.verification_status || '').replace(/_/g, ' '))}</span></td>
                        <td><a href="#/disputes/${escapeHtml(t?.dispute?.id)}" class="btn btn-sm btn-outline-primary">Open</a></td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            `}
          </div>
          <div class="card border shadow-none mt-3">
            <div class="card-header bg-white border-bottom">
              <h3 class="card-title mb-0">Verification Task Analytics</h3>
              <div class="text-muted text-xs">Derived from assigned tasks loaded from backend</div>
            </div>
            <div class="card-body">
              ${renderBarChart('Task Status Distribution', 'Counts by verification status (real assigned tasks)', (() => {
                const counts = {};
                (tasks || []).forEach((t) => { const k = t?.verification_status || 'UNKNOWN'; counts[k] = (counts[k] || 0) + 1; });
                const palette = ['#d97706','#0ea5e9','#14532d','#8A6420','#64748b','#b91c1c'];
                return Object.keys(counts).map((k, i) => ({ label: k.replace(/_/g,' '), value: counts[k], color: palette[i % palette.length], suffix: '' }));
              })())}
            </div>
          </div>

          <div class="alert alert-info border mt-3 mb-0">
            <div class="text-xs"><strong>Role boundaries:</strong> Assayers may review assigned dispute details, access permitted evidence, record reweigh results, and submit independent verification notes. Assayers cannot modify original transactions or approve/settle disputed amounts.</div>
          </div>
        </div>
      </div>
    `;
  }

  // 1. Fetch live orders
  let orders = [];
  try {
    orders = await Api.getOrders();
  } catch (e) {
    console.warn('Orders fetch note:', e.message);
  }

  // 2. Fetch live disputes
  let disputes = [];
  try {
    disputes = await Api.getDisputes();
  } catch (e) {
    console.warn('Disputes fetch note:', e.message);
  }

  // 3. Fetch passbook if karigar, or calculate exact totals from order summaries if jeweller
  let passbook = null;
  let issuedGoldG = '0.0000';
  let returnedGoldG = '0.0000';
  let outstandingGoldG = '0.0000';
  let totalHeldDisputeG = '0.0000';
  let pendingConfirmations = 0;

  if (user?.role === 'karigar' && user?.id) {
    try {
      passbook = await Api.getPassbook(user.id);
      if (passbook?.totals) {
        issuedGoldG = passbook.totals.issued_fine_g || '0.0000';
        returnedGoldG = passbook.totals.returned_fine_g || '0.0000';
        outstandingGoldG = passbook.totals.gold_in_hand_fine_g || '0.0000';
        totalHeldDisputeG = passbook.totals.held_in_dispute_g || '0.0000';
      }
      if (Array.isArray(passbook?.pending_confirmations)) {
        pendingConfirmations = passbook.pending_confirmations.length;
      }
    } catch (e) {
      console.warn('Karigar passbook fetch note:', e.message);
    }
  } else if (isJeweller && orders.length > 0) {
    try {
      let sumIssued = 0;
      let sumReturned = 0;
      let sumHeld = 0;
      for (const order of orders) {
        try {
          const summary = await Api.getOrderSummary(order.id);
          if (summary) {
            sumIssued += parseFloat(summary.issued_fine_g) || 0;
            sumReturned += parseFloat(summary.returned_fine_g) || 0;
            sumHeld += parseFloat(summary.held_g_total) || 0;
          }
        } catch {
          // ignore individual order summary failure
        }
      }
      issuedGoldG = sumIssued.toFixed(4);
      returnedGoldG = sumReturned.toFixed(4);
      outstandingGoldG = Math.max(0, sumIssued - sumReturned).toFixed(4);
      totalHeldDisputeG = sumHeld.toFixed(4);
    } catch (e) {
      console.warn('Jeweller order summaries calculation note:', e.message);
    }
  }

  // 4. Fetch recent transactions across available orders
  let recentTransactions = [];
  if (orders.length > 0) {
    try {
      for (const order of orders.slice(0, 3)) {
        try {
          const txs = await Api.getTransactions(order.id);
          if (Array.isArray(txs)) {
            recentTransactions.push(...txs);
          }
        } catch {
          // continue with other orders
        }
      }
      // Sort newest first
      recentTransactions.sort((a, b) => b.id - a.id);
      if (!passbook) {
        pendingConfirmations = recentTransactions.filter((tx) => tx.state === 'AWAITING_CONFIRMATION').length;
      }
    } catch (e) {
      console.warn('Transactions fetch note:', e.message);
    }
  }

  // 5. Offline queue visibility (local IndexedDB state)
  let queueSummary = { total: 0, autoReplayable: 0, pending: 0, retrying: 0, retryingScheduled: 0, conflict: 0, failed: 0, authRequired: 0, attention: 0, acknowledged: 0, acknowledgedAvailable: true };
  let attentionOps = [];
  try {
    queueSummary = await getQueueSummary();
    attentionOps = await getAttentionOps();
  } catch (e) {
    console.warn('Queue summary fetch note:', e.message);
  }
  const attentionPreview = attentionOps.slice(0, 3);
  const ackText = (queueSummary.acknowledgedAvailable && typeof queueSummary.acknowledged === 'number')
    ? `${State.t('sync.synced_ack')}: ${queueSummary.acknowledged}`
    : State.t('sync.all_clear');

  // Financial aggregates (using exact API values, never fabricated)
  const activeOrdersCount = orders.filter((o) => o.status === 'ACTIVE' || o.status === 'OPEN').length;
  const activeDisputesCount = disputes.filter((d) => d.state === 'OPEN').length;

  return `
    <div class="page-container py-3">
      <!-- Page Header -->
      <div class="page-header d-print-none mb-3">
        <div class="container-xl">
          <div class="row g-2 align-items-center">
            <div class="col">
              <div class="metric-subheader">${State.t('nav.dashboard')}</div>
              <h2 class="page-title text-dark d-flex align-items-center gap-2">
                <span>Enterprise Gold Ledger</span>
                <span class="badge badge-gold fs-6">${user?.role?.toUpperCase() || 'USER'}</span>
              </h2>
            </div>
            <div class="col-auto ms-auto d-print-none d-flex gap-2 align-items-center">
              <button id="manual-sync-btn" class="btn btn-outline-secondary" title="${escapeHtml(State.t('sync.auto_only'))}">
                <span id="manual-sync-btn-label">🔄 ${State.t('sync.manual_sync')}</span>
              </button>
              ${isJeweller ? `
                <a href="#/orders?new=true" class="btn btn-primary">+ ${State.t('orders.create_order')}</a>
              ` : ''}
            </div>
          </div>
        </div>
      </div>

      <div class="container-xl">
        <!-- Offline Sync Queue Status -->
        <div class="row row-cards mb-3">
          <div class="col-12">
            <div class="card" id="sync-status-card">
              <div class="card-header d-flex justify-content-between align-items-center">
                <div>
                  <h3 class="card-title mb-0">${State.t('sync.queue')}</h3>
                  <div class="text-muted text-xs">${State.t('sync.auto_only')}</div>
                </div>
                <span class="badge ${queueSummary.attention > 0 ? 'bg-warning-lt text-warning' : 'bg-success-lt text-success'}" id="sync-attention-badge">
                  ${queueSummary.attention > 0 ? State.t('sync.attention_notice') : State.t('sync.all_clear')}
                </span>
              </div>
              <div class="card-body">
                <div class="row g-2">
                  <div class="col-6 col-md-3">
                    <div class="p-2 border rounded bg-light">
                      <div class="metric-subheader">${State.t('sync.pending')}</div>
                      <div class="h3 mb-0" id="sync-pending-count">${queueSummary.autoReplayable}</div>
                      <div class="text-muted text-xs">PENDING ${queueSummary.pending} / RETRYING ${queueSummary.retrying}${queueSummary.retryingScheduled ? ` (scheduled ${queueSummary.retryingScheduled})` : ''}</div>
                    </div>
                  </div>
                  <div class="col-6 col-md-3">
                    <div class="p-2 border rounded ${queueSummary.conflict > 0 ? 'bg-warning-lt' : 'bg-light'}">
                      <div class="metric-subheader">${State.t('sync.conflicts')}</div>
                      <div class="h3 mb-0" id="sync-conflict-count">${queueSummary.conflict}</div>
                      <div class="text-muted text-xs">${State.t('sync.conflict_hint')}</div>
                    </div>
                  </div>
                  <div class="col-6 col-md-3">
                    <div class="p-2 border rounded ${queueSummary.failed > 0 ? 'bg-danger-lt' : 'bg-light'}">
                      <div class="metric-subheader">${State.t('sync.failed')}</div>
                      <div class="h3 mb-0" id="sync-failed-count">${queueSummary.failed}</div>
                      <div class="text-muted text-xs">${State.t('sync.failed_hint')}</div>
                    </div>
                  </div>
                  <div class="col-6 col-md-3">
                    <div class="p-2 border rounded ${queueSummary.authRequired > 0 ? 'bg-warning-lt' : 'bg-light'}">
                      <div class="metric-subheader">${State.t('sync.auth_required')}</div>
                      <div class="h3 mb-0" id="sync-auth-count">${queueSummary.authRequired}</div>
                      <div class="text-muted text-xs">${queueSummary.authRequired > 0 ? State.t('sync.paused_auth') : ackText}</div>
                    </div>
                  </div>
                </div>
                ${attentionPreview.length > 0 ? `
                  <div class="mt-3">
                    <div class="metric-subheader mb-1">${State.t('sync.attention_notice')}</div>
                    <ul class="mb-0 ps-3 text-xs">
                      ${attentionPreview.map((op) => `<li><strong>${escapeHtml(op.status)}</strong> â€” ${escapeHtml(formatSyncReason(op))}</li>`).join('')}
                    </ul>
                  </div>
                ` : ''}
              </div>
            </div>
          </div>
        </div>

        <!-- Top 4 Priority Financial Metrics Row -->
        <div class="row row-cards mb-3">
          <div class="col-sm-6 col-lg-3">
            ${renderStatCard({
              title: 'Total Issued Gold',
              value: issuedGoldG,
              unit: 'g',
              subtitle: 'Fine gold issued',
              icon: 'âš–ï¸',
              color: 'gold',
            })}
          </div>
          <div class="col-sm-6 col-lg-3">
            ${renderStatCard({
              title: 'Total Returned Gold',
              value: returnedGoldG,
              unit: 'g',
              subtitle: 'Fine gold returned',
              icon: 'ðŸ”„',
              color: 'forest',
            })}
          </div>
          <div class="col-sm-6 col-lg-3">
            ${renderStatCard({
              title: 'Outstanding Gold',
              value: outstandingGoldG,
              unit: 'g',
              subtitle: 'In-custody balance',
              icon: 'ðŸ“¦',
              color: 'gold',
            })}
          </div>
          <div class="col-sm-6 col-lg-3">
            ${renderStatCard({
              title: 'Escrow Dispute Hold',
              value: totalHeldDisputeG,
              unit: 'g',
              subtitle: `${activeDisputesCount} active disputes`,
              icon: 'ðŸ›¡ï¸',
              color: totalHeldDisputeG !== '0.0000' && totalHeldDisputeG !== '0' ? 'warning' : 'forest',
            })}
          </div>
        </div>

        <!-- Operational Status Tiles -->
        <div class="row row-cards mb-3">
          <div class="col-sm-6 col-lg-4">
            <div class="card card-sm">
              <div class="card-body">
                <div class="d-flex align-items-center justify-content-between">
                  <div>
                    <div class="metric-subheader">Pending Confirmations</div>
                    <div class="metric-number">${pendingConfirmations}</div>
                  </div>
                  <span class="avatar avatar-md bg-warning-lt rounded fs-3">â³</span>
                </div>
                <div class="text-muted text-xs mt-2">Requires counterparty dual-custody verification</div>
              </div>
            </div>
          </div>
          <div class="col-sm-6 col-lg-4">
            <div class="card card-sm">
              <div class="card-body">
                <div class="d-flex align-items-center justify-content-between">
                  <div>
                    <div class="metric-subheader">Active Disputes</div>
                    <div class="metric-number ${activeDisputesCount > 0 ? 'text-danger' : ''}">${activeDisputesCount}</div>
                  </div>
                  <span class="avatar avatar-md bg-danger-lt rounded fs-3">âš ï¸</span>
                </div>
                <div class="text-muted text-xs mt-2">Weight / purity disagreements under review</div>
              </div>
            </div>
          </div>
          <div class="col-sm-6 col-lg-4">
            <div class="card card-sm">
              <div class="card-body">
                <div class="d-flex align-items-center justify-content-between">
                  <div>
                    <div class="metric-subheader">Active Orders</div>
                    <div class="metric-number">${activeOrdersCount}</div>
                  </div>
                  <span class="avatar avatar-md bg-info-lt rounded fs-3">ðŸ“‹</span>
                </div>
                <div class="text-muted text-xs mt-2">Manufacturing orders currently open</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Main Content Grid -->
        <div class="row row-deck row-cards">
          <!-- Recent Transactions Ledger Table -->
          <div class="col-12 col-xl-8">
            <div class="card">
              <div class="card-header d-flex justify-content-between align-items-center">
                <div>
                  <h3 class="card-title mb-0">Recent Transactions & Ledger Entries</h3>
                  <div class="text-muted text-xs">Immutable versioned events protected by hash chains</div>
                </div>
                ${orders.length > 0 ? `
                  <a href="#/orders/${orders[0].id}" class="btn btn-sm btn-outline-primary">View Ledger</a>
                ` : ''}
              </div>
              <div class="card-body p-0">
                ${recentTransactions.length === 0 ? `
                  <div class="p-4 text-center text-muted">
                    <p class="mb-2">No transactions recorded yet.</p>
                    <span class="text-xs">Issue gold from an order to begin recording dual-custody entries.</span>
                  </div>
                ` : `
                  <div class="table-responsive">
                    <table class="table table-vcenter card-table table-striped">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Type</th>
                          <th>Weight</th>
                          <th>Purity</th>
                          <th>Status</th>
                          <th>Timestamp</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${recentTransactions.slice(0, 5).map((tx) => `
                          <tr>
                            <td><strong>#${tx.id}</strong></td>
                            <td class="text-capitalize">${tx.kind}</td>
                            <td><strong>${tx.current_version?.weight_g || tx.weight_g || 'â€”'} g</strong></td>
                            <td>${renderPurityBadge(tx.current_version?.karat || 22)}</td>
                            <td>${renderStateBadge(tx.state)}</td>
                            <td><span class="text-muted text-xs">${tx.created_at ? new Date(tx.created_at).toLocaleString() : 'â€”'}</span></td>
                            <td>
                              <a href="#/transactions/${tx.id}" class="btn btn-sm btn-outline-secondary">Inspect</a>
                            </td>
                          </tr>
                        `).join('')}
                      </tbody>
                    </table>
                  </div>
                `}
              </div>
            </div>
          </div>

          <!-- Charts & Analytics (real backend-derived data) -->
          <div class="col-12">
            <div class="card border shadow-none">
              <div class="card-header bg-white border-bottom d-flex justify-content-between align-items-center">
                <div>
                  <h3 class="card-title mb-0">Charts & Analytics</h3>
                  <div class="text-muted text-xs">Derived from live backend records currently loaded in this dashboard view</div>
                </div>
              </div>
              <div class="card-body">
                <div class="row g-4">
                  <div class="col-lg-6">
                    ${renderBarChart(
                      'Gold Movement (Fine Gold)',
                      'Issued, returned, outstanding, and disputed-held quantities from authoritative ledger data',
                      [
                        { label: 'Issued', value: issuedGoldG, color: '#C9A24A', suffix: ' g' },
                        { label: 'Returned', value: returnedGoldG, color: '#14532d', suffix: ' g' },
                        { label: 'Outstanding', value: outstandingGoldG, color: '#8A6420', suffix: ' g' },
                        { label: 'Dispute Hold', value: totalHeldDisputeG, color: '#b91c1c', suffix: ' g' },
                      ]
                    )}
                  </div>
                  <div class="col-lg-6">
                    ${renderDonutChart(
                      'Operational Status Distribution',
                      'Counts from orders, disputes, and transactions loaded for this view',
                      [
                        { label: 'Active Orders', value: activeOrdersCount, color: '#0ea5e9' },
                        { label: 'Active Disputes', value: activeDisputesCount, color: '#b91c1c' },
                        { label: 'Pending Confirmations', value: pendingConfirmations, color: '#d97706' },
                        { label: 'Recent Tx (sample)', value: recentTransactions.length, color: '#14532d' },
                      ]
                    )}
                  </div>
                  <div class="col-lg-6">
                    ${renderBarChart(
                      'Transaction States (Recent Sample)',
                      'State counts from recent transactions fetched across available orders',
                      (() => {
                        const counts = {};
                        (recentTransactions || []).forEach(tx => { const k = tx?.state || 'UNKNOWN'; counts[k] = (counts[k] || 0) + 1; });
                        const palette = ['#8A6420','#14532d','#b91c1c','#d97706','#64748b','#0ea5e9'];
                        return Object.keys(counts).map((k,i)=>({ label: k.replace(/_/g,' '), value: counts[k], color: palette[i % palette.length], suffix: '' }));
                      })()
                    )}
                  </div>
                  <div class="col-lg-6">
                    ${renderBarChart(
                      'Transaction Types (Recent Sample)',
                      'Issue vs return distribution from recent transactions fetched across available orders',
                      (() => {
                        const counts = {};
                        (recentTransactions || []).forEach(tx => { const k = (tx?.kind || 'unknown').toString(); counts[k] = (counts[k] || 0) + 1; });
                        const palette = { issue:'#C9A24A', return:'#14532d' };
                        return Object.keys(counts).map(k=>({ label: k.charAt(0).toUpperCase()+k.slice(1), value: counts[k], color: palette[k] || '#8A6420', suffix: '' }));
                      })()
                    )}
                    <div class="text-muted text-xs mt-3">If metrics are unavailable for a role or dataset, charts show only available real values and no fabricated data.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <!-- Active Manufacturing Orders -->
          <div class="col-12 col-xl-4">
            <div class="card">
              <div class="card-header d-flex justify-content-between align-items-center">
                <div>
                  <h3 class="card-title mb-0">Active Orders</h3>
                  <div class="text-muted text-xs">Assigned jobs</div>
                </div>
                <a href="#/orders" class="btn btn-sm btn-outline-secondary">All Orders</a>
              </div>
              <div class="card-body p-0">
                ${orders.length === 0 ? `
                  <div class="p-4 text-center text-muted">
                    <p class="mb-0">No active orders found.</p>
                  </div>
                ` : `
                  <div class="list-group list-group-flush">
                    ${orders.slice(0, 4).map((o) => `
                      <a href="#/orders/${o.id}" class="list-group-item list-group-item-action p-3">
                        <div class="d-flex justify-content-between align-items-start mb-1">
                          <strong class="text-dark">#${o.id} â€” ${o.description}</strong>
                          ${renderStateBadge(o.status)}
                        </div>
                        <div class="d-flex justify-content-between text-xs text-muted">
                          <span>Karigar #${o.karigar_id} â€¢ Wastage: ${o.wastage_pct}%</span>
                          <span>Due: ${o.due_date || 'Open'}</span>
                        </div>
                      </a>
                    `).join('')}
                  </div>
                `}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

renderDashboard.afterRender = () => {
  const syncBtn = document.getElementById('manual-sync-btn');
  const syncLabel = document.getElementById('manual-sync-btn-label');
  if (!syncBtn) return;

  syncBtn.addEventListener('click', async () => {
    if (syncBtn.dataset.syncing === '1') return;
    syncBtn.dataset.syncing = '1';
    syncBtn.disabled = true;
    const originalLabel = syncLabel ? syncLabel.textContent : `🔄 ${State.t('sync.manual_sync')}`;
    if (syncLabel) syncLabel.textContent = State.t('common.syncing');
    else syncBtn.textContent = State.t('common.syncing');

    try {
      const res = await syncQueue(request);
      const status = res?.status || 'completed';
      const summary = res?.summary || await getQueueSummary();
      const successCount = res?.successCount || 0;
      const failCount = res?.failCount || 0;
      const conflictCount = res?.conflictCount || 0;
      const autoPending = summary.autoReplayable ?? (res?.pendingCount || 0);
      const attention = summary.attention ?? ((summary.conflict || 0) + (summary.failed || 0) + (summary.authRequired || 0));

      if (status === 'offline') {
        Toast.info(`${State.t('common.offline')}. ${State.t('sync.pending')}: ${autoPending}.`);
      } else if (status === 'already_running') {
        Toast.info('Sync is already in progress.');
      } else if (status === 'auth_required') {
        if ((summary.authRequired || 0) > 0) {
          Toast.warning(`${State.t('sync.paused_auth')} (${State.t('sync.auth_required')}: ${summary.authRequired})`);
        } else {
          Toast.warning(State.t('sync.paused_authz'));
        }
      } else if (successCount === 0 && failCount === 0 && conflictCount === 0) {
        if (autoPending > 0) {
          Toast.info(`${State.t('sync.pending')}: ${autoPending}.`);
        } else if (attention > 0) {
          Toast.warning(`${State.t('sync.attention_notice')} (${State.t('sync.conflicts')}: ${summary.conflict || 0}, ${State.t('sync.failed')}: ${summary.failed || 0}, ${State.t('sync.auth_required')}: ${summary.authRequired || 0})`);
        } else {
          Toast.info(State.t('sync.none_pending'));
        }
      } else if (attention === 0 && failCount === 0 && conflictCount === 0) {
        Toast.success(`${State.t('sync.synced_ack')}: ${successCount}.`);
      } else {
        Toast.warning(`${State.t('sync.synced_ack')}: ${successCount}, ${State.t('sync.conflicts')}: ${summary.conflict || conflictCount}, ${State.t('sync.failed')}: ${summary.failed || failCount}, ${State.t('sync.auth_required')}: ${summary.authRequired || 0}.`);
      }

      // Refresh dashboard data/counts. Dispatch hashchange to re-render via router (avoids full page reload).
      window.location.hash = '#/dashboard';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      return;
    } catch (e) {
      Toast.error('Sync failed: ' + (e?.message || 'Unknown error'));
    } finally {
      syncBtn.dataset.syncing = '0';
      syncBtn.disabled = false;
      if (syncLabel) syncLabel.textContent = originalLabel;
      else syncBtn.textContent = originalLabel;
    }
  });
};

