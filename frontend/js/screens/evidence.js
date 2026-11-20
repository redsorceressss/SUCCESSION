/**
 * Dispute Evidence & Resolution / Assayer Verification Workflow Screen
 * Tabler 1.7.4 Enterprise Design System
 * - Parties: notes, evidence upload, reweigh request, resolution proposals/decisions
 * - Assayers (assigned): view scoped dispute/transaction/evidence, add notes/evidence,
 *   record reweigh result, submit independent verification (with notes)
 * - No assayer/AI financial settlement authority; original transactions immutable
 */

import { Api, API_BASE } from '../api.js';
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

function fmtDate(v) {
  if (!v) return '—';
  try { return new Date(v).toLocaleString(); } catch { return String(v); }
}

function verificationStatus(dispute, user) {
  const reqs = Array.isArray(dispute?.reweigh_requests) ? dispute.reweigh_requests : [];
  const latest = reqs[reqs.length - 1] || null;
  if (!latest) return { label: 'Pending Reweigh Request', badge: 'bg-secondary-lt text-secondary', latest: null };
  if (latest.assayer_verified) {
    const mine = user?.id && latest.assayer_user_id === user.id;
    return { label: mine ? 'Completed (You Verified)' : 'Completed', badge: 'bg-success-lt text-success', latest };
  }
  if (latest.status === 'DONE') {
    if (user?.id && latest.result_by === user.id) {
      return { label: 'Result Submitted (Awaiting Verification)', badge: 'bg-primary-lt text-primary', latest };
    }
    return { label: 'Pending Independent Verification', badge: 'bg-info-lt text-info', latest };
  }
  return { label: 'Pending Reweigh Result', badge: 'bg-warning-lt text-warning', latest };
}

async function fetchEvidenceBlobUrl(evidenceId) {
  const token = Auth.getToken();
  const res = await fetch(`${API_BASE}/evidence/${evidenceId}/file`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    let msg = `Failed to open evidence (${res.status})`;
    try { const j = await res.json(); msg = j.detail || j.message || msg; } catch {}
    throw new Error(msg);
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export async function renderEvidence(params) {
  const disputeId = params.id;
  const user = Auth.getUser();
  const isAssayer = Auth.isAssayer && Auth.isAssayer();

  let dispute = null;
  let tx = null;
  let loadError = null;

  try {
    dispute = await Api.getDispute(disputeId);
  } catch (err) {
    loadError = err?.message || 'Could not load dispute';
  }

  if (!loadError && dispute?.transaction_id) {
    try {
      tx = await Api.getTransaction(dispute.transaction_id);
    } catch {
      // Assayer/party may not need full tx payload to proceed; dispute detail is primary
      tx = null;
    }
  }

  if (loadError || !dispute) {
    return `
      <div class="container-xl py-4">
        <div class="alert alert-danger border shadow-none" role="alert">
          <h4 class="alert-title">Dispute Record Error</h4>
          <div class="text-secondary">${escapeHtml(loadError || 'Dispute not found')}</div>
          <div class="mt-3">
            <a href="#/disputes" class="btn btn-outline-danger btn-sm">Return to ${isAssayer ? 'Assigned Tasks' : 'Disputes'}</a>
          </div>
        </div>
      </div>
    `;
  }

  const heldGrams = dispute.held_g || dispute.held_weight_g || '0.0000';
  const pendingProposal = (dispute.resolutions || []).find((r) => r.status === 'PROPOSED');
  const canDecideProposal = !isAssayer && pendingProposal && pendingProposal.proposed_by !== user?.id;
  const vStatus = verificationStatus(dispute, user);
  const latestReq = vStatus.latest;
  const activeAssignment = dispute.active_assignment || null;
  const assignedToMe = isAssayer && activeAssignment && activeAssignment.assayer_user_id === user?.id && activeAssignment.status === 'ACTIVE';
  const canRecordResult = assignedToMe && latestReq && latestReq.status === 'REQUESTED' && latestReq.requested_by !== user?.id;
  const canVerifyResult = assignedToMe && latestReq && latestReq.status === 'DONE' && !latestReq.assayer_verified && latestReq.result_by !== user?.id;
  const canAddNotesOrEvidence = !isAssayer || assignedToMe;

  const txCv = tx?.current_version && typeof tx.current_version === 'object' ? tx.current_version : null;

  return `
    <div class="container-xl py-3">
      <nav aria-label="breadcrumb" class="mb-3">
        <ol class="breadcrumb">
          <li class="breadcrumb-item"><a href="${isAssayer ? '#/assayer/tasks' : '#/disputes'}" class="text-muted">${isAssayer ? 'Verification Tasks' : 'Dispute Registry'}</a></li>
          <li class="breadcrumb-item active text-dark fw-semibold" aria-current="page">Case #${escapeHtml(dispute.id)}</li>
        </ol>
      </nav>

      <div class="page-header d-print-none mb-3">
        <div class="row g-2 align-items-center">
          <div class="col">
            <div class="d-flex align-items-center gap-2 mb-1 flex-wrap">
              <span class="badge bg-light text-dark font-monospace border">Dispute #${escapeHtml(dispute.id)}</span>
              ${renderStateBadge(dispute.state || dispute.status)}
              <span class="badge ${vStatus.badge}">${escapeHtml(vStatus.label)}</span>
            </div>
            <h2 class="page-title fs-2 fw-bold text-dark">Disputed Handover #${escapeHtml(dispute.transaction_id)}</h2>
            <div class="text-muted fs-4">
              Disputed Parameter: <strong class="text-dark text-capitalize">${escapeHtml(dispute.field)}</strong>
              <span class="mx-2">•</span>
              Protected Escrow: <strong class="text-danger font-monospace">${escapeHtml(heldGrams)} g</strong>
            </div>
          </div>
          <div class="col-auto ms-auto d-print-none">
            <div class="btn-list">
              ${tx ? `<a href="#/transactions/${escapeHtml(dispute.transaction_id)}" class="btn btn-outline-secondary">View Transaction</a>` : ''}
              ${!isAssayer ? `
                <button id="open-reweigh-modal" class="btn btn-outline-dark">Request Reweighing</button>
                <button id="open-assign-assayer-modal" class="btn btn-outline-primary">Assign Assayer</button>
                <button id="open-resolution-modal" class="btn btn-primary">Propose Resolution</button>
              ` : ''}
            </div>
          </div>
        </div>
      </div>

      ${canDecideProposal ? `
        <div class="alert alert-warning border shadow-none mb-3" role="alert">
          <div class="d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div>
              <h4 class="alert-title mb-0">Pending Resolution Proposal from Counterparty</h4>
              <div class="text-secondary text-xs">
                Proposed Outcome: <strong>${escapeHtml(pendingProposal.outcome)}</strong>
                ${pendingProposal.agreed_value ? ` | Agreed Value: <strong>${escapeHtml(pendingProposal.agreed_value)} g</strong>` : ''}
                ${pendingProposal.note ? ` — "${escapeHtml(pendingProposal.note)}"` : ''}
              </div>
            </div>
            <div class="btn-list">
              <button class="btn btn-sm btn-success" id="accept-resolution-btn" data-rid="${pendingProposal.id}">Accept & Settle</button>
              <button class="btn btn-sm btn-outline-danger" id="reject-resolution-btn" data-rid="${pendingProposal.id}">Reject</button>
            </div>
          </div>
        </div>
      ` : ''}

      ${isAssayer ? `
        <div class="card border shadow-none mb-3">
          <div class="card-header bg-white border-bottom d-flex justify-content-between align-items-center">
            <h3 class="card-title mb-0">Assayer Assignment & Verification</h3>
            <span class="badge ${assignedToMe ? 'bg-success-lt text-success' : 'bg-secondary-lt text-secondary'}">${assignedToMe ? 'Active Assignment' : 'Read-only / Not Assigned'}</span>
          </div>
          <div class="card-body">
            <div class="row g-3">
              <div class="col-md-4">
                <div class="text-muted text-xs text-uppercase fw-semibold mb-1">Assignment Status</div>
                <div class="fw-medium">${escapeHtml(activeAssignment?.status || 'None')}</div>
                <div class="text-muted text-xs">Assigned: ${escapeHtml(fmtDate(activeAssignment?.created_at))}</div>
                ${activeAssignment?.note ? `<div class="text-muted text-xs mt-1">Note: ${escapeHtml(activeAssignment.note)}</div>` : ''}
              </div>
              <div class="col-md-4">
                <div class="text-muted text-xs text-uppercase fw-semibold mb-1">Verification Status</div>
                <div>${verificationBadgeSpan(vStatus.label, vStatus.badge)}</div>
                <div class="text-muted text-xs mt-1">Assayers cannot modify original transactions or settle disputed amounts.</div>
              </div>
              <div class="col-md-4">
                <div class="text-muted text-xs text-uppercase fw-semibold mb-1">Relevant Transaction</div>
                <div class="font-monospace">#${escapeHtml(dispute.transaction_id)} ${tx?.kind ? `(${escapeHtml(tx.kind)})` : ''}</div>
                <div class="text-muted text-xs">State: ${escapeHtml(tx?.state || '—')} • Version: ${escapeHtml(tx?.current_version?.version_no || '—')}</div>
              </div>
            </div>
          </div>
        </div>
      ` : ''}

      <div class="card border shadow-none mb-4">
        <div class="card-header py-3 bg-white border-bottom">
          <h3 class="card-title fw-bold text-dark m-0">Dispute Details & Escrow Isolation</h3>
        </div>
        <div class="card-body p-3">
          <div class="row row-cards g-2 text-center mb-3">
            <div class="col-md-4"><div class="card card-sm border bg-light shadow-none"><div class="card-body p-3"><div class="text-muted text-xs text-uppercase fw-semibold mb-1">Original Recorded</div><div class="fs-2 fw-bold font-monospace text-dark">${escapeHtml(dispute.original_value)} g</div></div></div></div>
            <div class="col-md-4"><div class="card card-sm border bg-light shadow-none"><div class="card-body p-3"><div class="text-muted text-xs text-uppercase fw-semibold mb-1">Claimed Physical Value</div><div class="fs-2 fw-bold font-monospace text-primary">${escapeHtml(dispute.claimed_value)} g</div></div></div></div>
            <div class="col-md-4"><div class="card card-sm border bg-danger-subtle shadow-none"><div class="card-body p-3"><div class="text-danger text-xs text-uppercase fw-semibold mb-1">Frozen Held Quantity</div><div class="fs-2 fw-bold font-monospace text-danger">${escapeHtml(heldGrams)} g</div></div></div></div>
          </div>
          ${txCv ? `
          <div class="alert alert-secondary border mb-0">
            <div class="text-xs"><strong>Relevant transaction (current version):</strong> Weight ${escapeHtml(txCv.weight_g)} g, Karat ${escapeHtml(txCv.karat)}, Fine ${escapeHtml(txCv.fine_g)} g, Scrap ${escapeHtml(txCv.scrap_g || '0')} g. Original values remain immutable; corrections/resolutions create new versions only through authorized party workflows.</div>
          </div>` : `
          <div class="alert alert-info border mb-0"><div class="text-xs"><strong>Invariant:</strong> Disputed variance is held in escrow and cannot be settled without authorized party resolution/approvals.</div></div>`}
        </div>
      </div>

      ${Array.isArray(dispute.reweigh_requests) && dispute.reweigh_requests.length > 0 ? `
      <div class="card border shadow-none mb-4">
        <div class="card-header py-3 bg-white border-bottom">
          <h3 class="card-title fw-bold text-dark m-0">Reweigh Requests & Independent Verification</h3>
        </div>
        <div class="card-body">
          ${dispute.reweigh_requests.map((r) => `
            <div class="border rounded p-3 mb-3 bg-light">
              <div class="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-2">
                <div>
                  <div class="fw-semibold">Reweigh Request #${escapeHtml(r.id)} <span class="badge ${r.status === 'DONE' ? 'bg-primary-lt text-primary' : 'bg-warning-lt text-warning'} ms-1">${escapeHtml(r.status)}</span></div>
                  <div class="text-muted text-xs">Requested by User #${escapeHtml(r.requested_by)}${r.note ? ` • ${escapeHtml(r.note)}` : ''}</div>
                </div>
                <div class="text-end">
                  <div class="text-xs text-muted">Result</div>
                  <div class="font-monospace fw-bold">${escapeHtml(r.result_weight_g || '—')}</div>
                  <div class="text-xs">${r.assayer_verified ? '<span class="badge bg-success-lt text-success">Assayer Verified</span>' : '<span class="badge bg-secondary-lt text-secondary">Not Verified</span>'}</div>
                </div>
              </div>
              ${isAssayer ? `
                <div class="row g-2 mt-2">
                  <div class="col-md-6">
                    <div class="card card-sm border shadow-none"><div class="card-body">
                      <div class="fw-semibold mb-2">Record Reweigh Result</div>
                      <form class="assayer-record-result-form" data-rid="${escapeHtml(r.id)}">
                        <label class="form-label text-xs">Measured Weight (g)</label>
                        <input type="text" name="weight_g" class="form-control form-control-sm font-monospace mb-2" placeholder="e.g. 49.8500" ${canRecordResult && latestReq?.id === r.id ? '' : 'disabled'}>
                        <button type="submit" class="btn btn-sm btn-primary" ${canRecordResult && latestReq?.id === r.id ? '' : 'disabled'}>Submit Result</button>
                        ${!(canRecordResult && latestReq?.id === r.id) ? `<div class="form-hint text-muted mt-1">Available only for your actively assigned request when pending and you are not the requester.</div>` : ''}
                      </form>
                    </div></div>
                  </div>
                  <div class="col-md-6">
                    <div class="card card-sm border shadow-none"><div class="card-body">
                      <div class="fw-semibold mb-2">Independent Verification</div>
                      <form class="assayer-verify-result-form" data-rid="${escapeHtml(r.id)}">
                        <label class="form-label text-xs">Verified Weight (g)</label>
                        <input type="text" name="verified_weight_g" class="form-control form-control-sm font-monospace mb-2" placeholder="e.g. 49.8500" ${canVerifyResult && latestReq?.id === r.id ? '' : 'disabled'}>
                        <label class="form-label text-xs">Verification Notes</label>
                        <textarea name="note" class="form-control form-control-sm mb-2" rows="2" placeholder="Calibration, method, observations" ${canVerifyResult && latestReq?.id === r.id ? '' : 'disabled'}></textarea>
                        <button type="submit" class="btn btn-sm btn-success" ${canVerifyResult && latestReq?.id === r.id ? '' : 'disabled'}>Submit Verification</button>
                        ${!(canVerifyResult && latestReq?.id === r.id) ? `<div class="form-hint text-muted mt-1">Available after result submission, only for your active assignment, and not for the measurement operator.</div>` : ''}
                      </form>
                    </div></div>
                  </div>
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>
      </div>` : ''}

      <div class="row row-cards g-3">
        <div class="col-lg-7">
          <div class="card border shadow-none h-100">
            <div class="card-header py-3 bg-white border-bottom d-flex justify-content-between align-items-center">
              <h3 class="card-title fw-bold text-dark m-0">Cryptographic Evidence & Photos</h3>
              ${canAddNotesOrEvidence ? `<label class="btn btn-sm btn-outline-primary m-0 cursor-pointer">Attach Evidence<input type="file" id="evidence-file-input" class="d-none" accept="image/*,application/pdf"></label>` : ''}
            </div>
            <div class="card-body p-0">
              ${!dispute.evidence || dispute.evidence.length === 0 ? `
                <div class="py-5 text-center text-muted"><p class="fs-4 mb-0">No evidence files attached yet.</p><div class="text-xs text-muted mt-1">Upload scale photos, assay slips, or calibration certificates.</div></div>
              ` : `
                <div class="table-responsive">
                  <table class="table table-vcenter card-table table-hover table-striped">
                    <thead><tr><th>#</th><th>Type</th><th>SHA-256</th><th>Uploaded</th><th class="text-end">Action</th></tr></thead>
                    <tbody>
                      ${dispute.evidence.map((ev) => `
                        <tr>
                          <td><span class="badge bg-light text-dark font-monospace border">#${escapeHtml(ev.id)}</span></td>
                          <td class="text-muted text-xs font-monospace">${escapeHtml(ev.mime || '—')}</td>
                          <td><code class="font-monospace text-xs text-muted" title="${escapeHtml(ev.sha256 || '')}">${ev.sha256 ? escapeHtml(ev.sha256.slice(0, 16) + '...') : '—'}</code></td>
                          <td class="text-muted text-xs">${escapeHtml(fmtDate(ev.created_at))}</td>
                          <td class="text-end"><button class="btn btn-sm btn-outline-secondary evidence-open-btn" data-eid="${escapeHtml(ev.id)}">View</button></td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              `}
            </div>
          </div>
        </div>

        <div class="col-lg-5">
          <div class="card border shadow-none h-100">
            <div class="card-header py-3 bg-white border-bottom"><h3 class="card-title fw-bold text-dark m-0">Discussion & Audit Notes</h3></div>
            <div class="card-body p-3 d-flex flex-column" style="min-height: 280px;">
              <div class="flex-grow-1 overflow-auto mb-3" style="max-height: 320px;">
                ${!dispute.notes || dispute.notes.length === 0 ? `
                  <div class="py-4 text-center text-muted"><p class="fs-4 mb-0">No discussion notes recorded yet.</p></div>
                ` : `
                  <div class="timeline timeline-simple">
                    ${dispute.notes.map((n) => `
                      <div class="timeline-event mb-3 pb-2 border-bottom">
                        <div class="d-flex justify-content-between align-items-center mb-1">
                          <span class="badge bg-light text-dark border fw-medium">User #${escapeHtml(n.user_id)}</span>
                          <span class="text-muted text-xs">${escapeHtml(fmtDate(n.created_at || n.at))}</span>
                        </div>
                        <div class="text-dark fs-4">${escapeHtml(n.text)}</div>
                      </div>
                    `).join('')}
                  </div>
                `}
              </div>
              ${canAddNotesOrEvidence ? `
              <form id="add-note-form" class="mt-auto">
                <label class="form-label text-xs">Add ${isAssayer ? 'verification ' : ''}note</label>
                <div class="input-group">
                  <input type="text" id="note-input" class="form-control form-control-sm" required placeholder="Type note or explanation..." autocomplete="off">
                  <button type="submit" class="btn btn-sm btn-primary">Post Note</button>
                </div>
              </form>` : `<div class="text-muted text-xs">Notes are read-only for your current access level.</div>`}
            </div>
          </div>
        </div>
      </div>

      ${dispute.resolutions && dispute.resolutions.length ? `
      <div class="card border shadow-none mt-4">
        <div class="card-header bg-white border-bottom"><h3 class="card-title mb-0">Resolution Proposals & Audit History</h3></div>
        <div class="table-responsive">
          <table class="table table-vcenter card-table">
            <thead><tr><th>ID</th><th>Outcome</th><th>Status</th><th>Proposed By</th><th>Decided By</th><th>Note</th></tr></thead>
            <tbody>
              ${dispute.resolutions.map((r) => `
                <tr>
                  <td class="font-monospace">#${escapeHtml(r.id)}</td>
                  <td>${escapeHtml(r.outcome)}${r.agreed_value ? ` (${escapeHtml(r.agreed_value)})` : ''}</td>
                  <td>${renderStateBadge(r.status)}</td>
                  <td>#${escapeHtml(r.proposed_by)}</td>
                  <td>${r.decided_by ? `#${escapeHtml(r.decided_by)}` : '—'}</td>
                  <td class="text-muted text-xs">${escapeHtml(r.note || '')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>` : ''}
    </div>
  `;
}

function verificationBadgeSpan(label, cls) {
  return `<span class="badge ${cls}">${escapeHtml(label)}</span>`;
}

renderEvidence.afterRender = (params) => {
  const disputeId = params.id;
  const fileInput = document.getElementById('evidence-file-input');
  const noteForm = document.getElementById('add-note-form');
  const reweighBtn = document.getElementById('open-reweigh-modal');
  const assignAssayerBtn = document.getElementById('open-assign-assayer-modal');
  const resolutionBtn = document.getElementById('open-resolution-modal');
  const acceptResBtn = document.getElementById('accept-resolution-btn');
  const rejectResBtn = document.getElementById('reject-resolution-btn');

  // Evidence view (authenticated blob fetch)
  document.querySelectorAll('.evidence-open-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const eid = btn.getAttribute('data-eid');
      if (!eid) return;
      const orig = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Opening...';
      try {
        const url = await fetchEvidenceBlobUrl(eid);
        window.open(url, '_blank', 'noopener,noreferrer');
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      } catch (e) {
        Toast.error(e?.message || 'Unable to open evidence file.');
      } finally {
        btn.disabled = false;
        btn.textContent = orig;
      }
    });
  });

  // File Upload (party or assigned assayer)
  if (fileInput) {
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files[0];
      if (!file) return;
      try {
        Toast.info('Uploading evidence and computing SHA-256 digest...');
        await Api.uploadDisputeEvidence(disputeId, file);
        Toast.success('Evidence uploaded successfully.');
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      } catch (err) {
        Toast.error(err?.message || 'Evidence upload failed.');
      } finally {
        fileInput.value = '';
      }
    });
  }

  // Note Posting (party or assigned assayer)
  if (noteForm) {
    noteForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = document.getElementById('note-input');
      const text = input?.value.trim();
      if (!text) return;
      try {
        const res = await Api.addDisputeNote(disputeId, text);
        if (res && res._offline_queued) {
          Toast.info('Note queued offline in IndexedDB. Will sync when connectivity returns.');
          input.value = '';
          return;
        }
        Toast.success('Note posted to dispute ledger.');
        input.value = '';
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      } catch (err) {
        Toast.error(err?.message || 'Failed to post note.');
      }
    });
  }

  // Assayer: record reweigh result
  document.querySelectorAll('.assayer-record-result-form').forEach((form) => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const rid = form.getAttribute('data-rid');
      const weight = form.querySelector('[name="weight_g"]')?.value?.trim();
      if (!rid || !weight) return;
      if (!Validators.isValidWeight(weight)) {
        Toast.error('Enter a valid positive weight (up to 4 decimals).');
        return;
      }
      const btn = form.querySelector('button[type="submit"]');
      try {
        if (btn) { btn.disabled = true; btn.textContent = 'Submitting...'; }
        await Api.submitReweighResult(rid, Validators.formatWeight4(weight));
        Toast.success('Reweigh result submitted.');
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      } catch (err) {
        Toast.error(err?.message || 'Failed to submit reweigh result.');
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Submit Result'; }
      }
    });
  });

  // Assayer: independent verification
  document.querySelectorAll('.assayer-verify-result-form').forEach((form) => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const rid = form.getAttribute('data-rid');
      const weight = form.querySelector('[name="verified_weight_g"]')?.value?.trim();
      const note = form.querySelector('[name="note"]')?.value?.trim() || '';
      if (!rid || !weight) return;
      if (!Validators.isValidWeight(weight)) {
        Toast.error('Enter a valid verified weight (up to 4 decimals).');
        return;
      }
      const btn = form.querySelector('button[type="submit"]');
      try {
        if (btn) { btn.disabled = true; btn.textContent = 'Submitting...'; }
        await Api.verifyReweighResult(rid, Validators.formatWeight4(weight), note);
        Toast.success('Independent verification submitted successfully.');
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      } catch (err) {
        Toast.error(err?.message || 'Failed to submit verification.');
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Submit Verification'; }
      }
    });
  });

  // Party-only: Assign/reassign assayer (explicit authorization)
  if (assignAssayerBtn) {
    assignAssayerBtn.addEventListener('click', () => {
      Modal.open({
        title: 'Assign Independent Assayer',
        confirmText: 'Assign Assayer',
        contentHtml: `
          <div class="mb-3">
            <label class="form-label required" for="assign-assayer-login">Assayer Login ID</label>
            <input type="text" id="assign-assayer-login" class="form-control" placeholder="e.g. assayer1" autocomplete="off">
            <div class="form-hint text-muted">Only registered assayers can be assigned. Assayers may access this dispute's permitted evidence and verification workflow while assigned.</div>
          </div>
          <div class="mb-3">
            <label class="form-label" for="assign-assayer-note">Assignment Note (optional)</label>
            <textarea id="assign-assayer-note" class="form-control" rows="2" placeholder="Reason for assignment, scope, or instructions"></textarea>
          </div>
        `,
        onConfirm: async () => {
          const login = document.getElementById('assign-assayer-login')?.value.trim();
          const note = document.getElementById('assign-assayer-note')?.value.trim() || '';
          if (!login) {
            Toast.error('Assayer login is required.');
            return false;
          }
          try {
            await Api.assignAssayer(disputeId, login, note);
            Toast.success('Assayer assignment updated (server-confirmed).');
            window.dispatchEvent(new HashChangeEvent('hashchange'));
            return true;
          } catch (e) {
            Toast.error(e?.message || 'Failed to assign assayer.');
            return false;
          }
        },
      });
    });
  }

  // Party-only: Request Reweighing
  if (reweighBtn) {
    reweighBtn.addEventListener('click', () => {
      Modal.open({
        title: 'Request Joint Reweighing Verification',
        confirmText: 'Submit Request',
        contentHtml: `
          <div class="mb-3">
            <label class="form-label" for="reweigh-note">Measurement Operator & Scale Instructions</label>
            <input type="text" id="reweigh-note" class="form-control" placeholder="e.g. Please reweigh on certified scale">
            <div class="form-hint text-muted">A reweigh request record will be opened on the ledger.</div>
          </div>
        `,
        onConfirm: async () => {
          const note = document.getElementById('reweigh-note')?.value.trim();
          try {
            await Api.requestReweigh(disputeId, note);
            Toast.success('Reweighing request submitted.');
            window.dispatchEvent(new HashChangeEvent('hashchange'));
            return true;
          } catch (e) {
            Toast.error(e?.message || 'Failed to request reweighing.');
            return false;
          }
        },
      });
    });
  }

  // Party-only: Propose Resolution
  if (resolutionBtn) {
    resolutionBtn.addEventListener('click', () => {
      Modal.open({
        title: 'Propose Dispute Resolution',
        confirmText: 'Submit Proposal',
        contentHtml: `
          <div class="mb-3">
            <label class="form-label required" for="res-outcome">Proposed Settlement Basis</label>
            <select id="res-outcome" class="form-select">
              <option value="AGREED_VALUE">Agreed Compromise Value (Adjust ledger to agreed weight)</option>
              <option value="ORIGINAL_STANDS">Original Recorded Value Stands (Dismiss claim)</option>
            </select>
          </div>
          <div class="mb-3" id="res-val-group">
            <label class="form-label required" for="res-val">Agreed Weight (Grams)</label>
            <div class="input-group">
              <input type="text" id="res-val" class="form-control font-monospace" placeholder="49.9250" autocomplete="off">
              <span class="input-group-text font-monospace">g</span>
            </div>
          </div>
          <div class="mb-3">
            <label class="form-label" for="res-note">Mutual Basis / Remarks</label>
            <textarea id="res-note" class="form-control" rows="2" placeholder="e.g. Agreed after independent reweigh verification"></textarea>
          </div>
        `,
        onConfirm: async () => {
          const outcome = document.getElementById('res-outcome')?.value;
          const agreedVal = document.getElementById('res-val')?.value.trim();
          const note = document.getElementById('res-note')?.value.trim();
          if (outcome === 'AGREED_VALUE' && !agreedVal) {
            Toast.error('Agreed weight is required for AGREED_VALUE.');
            return false;
          }
          try {
            await Api.proposeResolution(disputeId, {
              outcome,
              agreed_value: outcome === 'AGREED_VALUE' ? Validators.formatWeight4(agreedVal) : null,
              note,
            });
            Toast.success('Resolution proposal submitted. Awaiting counterparty acceptance.');
            window.dispatchEvent(new HashChangeEvent('hashchange'));
            return true;
          } catch (e) {
            Toast.error(e?.message || 'Failed to propose resolution.');
            return false;
          }
        },
      });
    });
  }

  if (acceptResBtn) {
    acceptResBtn.addEventListener('click', async () => {
      const rid = acceptResBtn.getAttribute('data-rid');
      try {
        await Api.decideResolution(rid, 'accept');
        Toast.success('Dispute resolved and settlement hold released (server-confirmed).');
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      } catch (e) {
        Toast.error(e?.message || 'Failed to accept resolution.');
      }
    });
  }

  if (rejectResBtn) {
    rejectResBtn.addEventListener('click', async () => {
      const rid = rejectResBtn.getAttribute('data-rid');
      try {
        await Api.decideResolution(rid, 'reject');
        Toast.warning('Resolution proposal rejected. Dispute and hold remain active.');
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      } catch (e) {
        Toast.error(e?.message || 'Failed to reject resolution.');
      }
    });
  }
};