/**
 * Settings & Offline Device Configuration Screen
 * Tabler 1.7.4 Enterprise Design System
 * Features:
 * - Vernacular language selection (EN, HI, KN)
 * - Cryptographic keypair inspector (NIST P-256 Web Crypto)
 * - Offline queue inspector & sync diagnostics
 * - Configurable API Base URL
 * - SUCCESSION Policy Assistant (Grounded RAG query interface)
 */

import { State } from '../state.js';
import { Auth } from '../auth.js';
import { Api, request, API_BASE } from '../api.js';
import { getAllOps, clearCompleted } from '../offline/queue.js';
import { getOrCreateSigningKey } from '../offline/signing.js';
import { Toast } from '../components/toast.js';
import { createRagAssistantPanel } from '../components/rag_assistant_panel.js';

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function renderSettings() {
  const user = Auth.getUser();
  const currentLang = State.get('lang') || 'en';

  let pendingOps = [];
  try {
    pendingOps = await getAllOps();
  } catch (e) {
    console.warn(e);
  }

  let keyInfo = 'Not initialized';
  try {
    const { publicKeyJwk } = await getOrCreateSigningKey();
    keyInfo = `ECDSA ${publicKeyJwk.crv} (${publicKeyJwk.kty})`;
  } catch (e) {
    keyInfo = 'Web Crypto unavailable';
  }

  return `
    <div class="container-xl py-3">
      <!-- Page Header -->
      <div class="page-header d-print-none mb-3">
        <div class="row g-2 align-items-center">
          <div class="col">
            <div class="page-pretitle text-uppercase tracking-wider text-muted fs-5">System Preferences</div>
            <h2 class="page-title fs-2 fw-bold text-dark">
              ${State.t('nav.settings') || 'Settings & Device Diagnostics'}
            </h2>
            <div class="text-muted fs-4">Language localization, device cryptography, offline synchronization, and operational policy assistant</div>
          </div>
        </div>
      </div>

      <div class="row row-cards g-3">
        <!-- 1. Language Preferences Card -->
        <div class="col-md-6">
          <div class="card border shadow-none h-100">
            <div class="card-header py-3 bg-white border-bottom">
              <h3 class="card-title fw-bold text-dark m-0">Vernacular Localization</h3>
            </div>
            <div class="card-body p-4">
              <p class="text-secondary mb-3">
                Select your operational language across all screens, voice assistants, and verification certificates:
              </p>
              <div class="btn-group w-100" role="group">
                <button type="button" class="btn ${currentLang === 'en' ? 'btn-primary' : 'btn-outline-secondary'} set-lang-btn" data-lang="en">
                  English
                </button>
                <button type="button" class="btn ${currentLang === 'hi' ? 'btn-primary' : 'btn-outline-secondary'} set-lang-btn" data-lang="hi">
                  हिंदी (Hindi)
                </button>
                <button type="button" class="btn ${currentLang === 'kn' ? 'btn-primary' : 'btn-outline-secondary'} set-lang-btn" data-lang="kn">
                  ಕನ್ನಡ (Kannada)
                </button>
              </div>
              <div class="text-xs text-muted mt-3">
                Translations are 100% synchronized across English, Hindi, and Kannada.
              </div>
            </div>
          </div>
        </div>

        <!-- 2. Security & Web Crypto Keys Card -->
        <div class="col-md-6">
          <div class="card border shadow-none h-100">
            <div class="card-header py-3 bg-white border-bottom">
              <h3 class="card-title fw-bold text-dark m-0">Cryptographic Signing Hardware</h3>
            </div>
            <div class="card-body p-4">
              <div class="d-flex align-items-center justify-content-between mb-3">
                <span class="text-muted fw-semibold">Local On-Device Key:</span>
                <span class="badge bg-success-subtle text-success font-monospace px-3 py-2 fs-5">
                  ${escapeHtml(keyInfo)}
                </span>
              </div>
              <p class="text-secondary text-xs mb-3">
                Non-repudiation guarantee: Every offline custody handover, signature hash, and dispute note is signed on-device with NIST P-256 Web Crypto before network submission.
              </p>
              <div class="form-group">
                <label class="form-label text-xs text-muted" for="settings-api-base">Backend Node Endpoint</label>
                <div class="input-group">
                  <input type="text" id="settings-api-base" class="form-control font-monospace form-control-sm" value="${escapeHtml(API_BASE)}">
                  <button type="button" id="save-api-base-btn" class="btn btn-sm btn-outline-secondary">Save</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 3. SUCCESSION Operational Policy Assistant (RAG Engine) -->
        <div class="col-12">
          <div class="card border shadow-none">
            <div class="card-header py-3 bg-white border-bottom d-flex justify-content-between align-items-center">
              <div>
                <h3 class="card-title fw-bold text-dark m-0">
                  <svg class="icon text-primary me-1" width="20" height="20" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12.01" y2="8"/><polyline points="11 12 12 12 12 16 13 16"/></svg>
                  Operational Policy Assistant (RAG Engine)
                </h3>
                <div class="text-xs text-muted">Grounded policy and workflow guidance from indexed SUCCESSION documentation (global-only). Informational only.</div>
              </div>
              <span class="badge bg-primary-subtle text-primary">Local Knowledge Index</span>
            </div>
            <div class="card-body p-4">
              <div id="rag-assistant-root"></div>
            </div>
          </div>
        </div>

        <!-- 4. Offline Sync Queue Diagnostics Card -->
        <div class="col-12">
          <div class="card border shadow-none">
            <div class="card-header py-3 bg-white border-bottom d-flex justify-content-between align-items-center">
              <div>
                <h3 class="card-title fw-bold text-dark m-0">Offline Synchronization Queue (IndexedDB)</h3>
                <div class="text-xs text-muted">Local durable queue storing transactions, dispute notes, and signatures created while disconnected</div>
              </div>
              <span class="badge bg-secondary-subtle text-secondary font-monospace px-2 py-1">
                ${pendingOps.length} ${pendingOps.length === 1 ? 'Operation' : 'Operations'} Queued
              </span>
            </div>
            <div class="card-body p-0">
              ${pendingOps.length === 0 ? `
                <div class="py-5 text-center text-muted">
                  <svg class="icon text-success mb-2" width="32" height="32" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 12l5 5l10 -10"/></svg>
                  <p class="fs-4 mb-0">Offline queue is clear. All mutations are synchronized with the central ledger.</p>
                </div>
              ` : `
                <div class="table-responsive">
                  <table class="table table-vcenter card-table table-hover table-striped">
                    <thead>
                      <tr>
                        <th class="w-1 text-muted text-uppercase text-xs tracking-wider">Operation ID</th>
                        <th class="text-muted text-uppercase text-xs tracking-wider">Target Endpoint</th>
                        <th class="text-muted text-uppercase text-xs tracking-wider">Method</th>
                        <th class="text-muted text-uppercase text-xs tracking-wider">Status</th>
                        <th class="text-muted text-uppercase text-xs tracking-wider">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${pendingOps.map((op) => `
                        <tr>
                          <td>
                            <code class="text-xs font-monospace text-dark">${op.id ? op.id.slice(0, 12) + '...' : '—'}</code>
                          </td>
                          <td class="font-monospace text-xs text-dark">${escapeHtml(op.endpoint)}</td>
                          <td>
                            <span class="badge bg-light text-dark font-monospace text-uppercase border">${escapeHtml(op.method)}</span>
                          </td>
                          <td>
                            <span class="badge ${op.status === 'PENDING' ? 'bg-warning-subtle text-warning' : op.status === 'CONFLICT' ? 'bg-danger-subtle text-danger' : 'bg-secondary-subtle text-secondary'} font-monospace">
                              ${escapeHtml(op.status)}
                            </span>
                          </td>
                          <td class="text-muted text-xs font-monospace">${escapeHtml(op.timestamp || '—')}</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              `}
              <div class="card-footer py-2 bg-light d-flex justify-content-between align-items-center">
                <span class="text-xs text-muted">Operations retry with exponential backoff and Web Locks mutual exclusion.</span>
                <button id="clear-queue-btn" class="btn btn-sm btn-outline-danger">
                  Clear Stale Queue
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

renderSettings.afterRender = () => {
  // 1. Language Buttons
  const langBtns = document.querySelectorAll('.set-lang-btn');
  langBtns.forEach((btn) => {
    btn.addEventListener('click', async () => {
      const newLang = btn.dataset.lang;
      localStorage.setItem('swarn_lang', newLang);
      State.set('lang', newLang);

      try {
        const res = await fetch(`js/i18n/${newLang}.json`);
        const json = await res.json();
        State.set('translations', json);
      } catch (e) {
        console.warn('Failed to load language json:', e);
      }
      Toast.success(`Language set to ${newLang.toUpperCase()}`);
      window.location.reload();
    });
  });

  // 2. Clear Queue
  const clearQueueBtn = document.getElementById('clear-queue-btn');
  if (clearQueueBtn) {
    clearQueueBtn.addEventListener('click', async () => {
      if (confirm('Clear stale and failed queue entries? Active pending operations will be preserved.')) {
        const removed = await clearCompleted();
        Toast.info(`Removed ${removed} stale entr${removed === 1 ? 'y' : 'ies'} from the offline queue.`);
        window.location.reload();
      }
    });
  }

  // 3. Save API Base
  const saveApiBaseBtn = document.getElementById('save-api-base-btn');
  if (saveApiBaseBtn) {
    saveApiBaseBtn.addEventListener('click', () => {
      const newBase = document.getElementById('settings-api-base')?.value.trim();
      if (newBase) {
        localStorage.setItem('succession_api_base', newBase);
        Toast.success('API Base URL updated. Reloading...');
        setTimeout(() => window.location.reload(), 600);
      }
    });
  }

  // 4. Policy Assistant Query Panel (RAG)
  const ragRoot = document.getElementById('rag-assistant-root');
  if (ragRoot) {
    createRagAssistantPanel(ragRoot);
  }
};
