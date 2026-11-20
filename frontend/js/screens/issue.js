/**
 * Issue Raw Gold Screen
 * Tabler 1.7.4 Enterprise Design System
 * Supports vernacular voice assistant, scale display photo OCR, and manual weight entry.
 * AI predictions are strictly DRAFTS; human confirmation is mandatory.
 */

import { Api } from '../api.js';
import { Auth } from '../auth.js';
import { State } from '../state.js';
import { Validators } from '../validators.js';
import { Toast } from '../components/toast.js';
import { VoiceService } from '../services/voice_service.js';
import { OcrService } from '../services/ocr_service.js';
import { createScaleOcrReview } from '../components/scale_ocr_review.js';
import { createVoiceDraftReview } from '../components/voice_draft_review.js';

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function renderIssue() {
  const hash = window.location.hash;
  const urlParams = new URLSearchParams(hash.includes('?') ? hash.split('?')[1] : '');
  const prefillOrderId = urlParams.get('order_id') || '';

  let orders = [];
  try {
    orders = await Api.getOrders();
  } catch (e) {
    console.warn('Orders fetch failed:', e);
  }

  return `
    <div class="container-tight py-4">
      <!-- Breadcrumbs -->
      <nav aria-label="breadcrumb" class="mb-3">
        <ol class="breadcrumb">
          <li class="breadcrumb-item"><a href="#/orders" class="text-muted">Job-Work Orders</a></li>
          <li class="breadcrumb-item active text-dark fw-semibold" aria-current="page">Issue Raw Gold</li>
        </ol>
      </nav>

      <div class="card border shadow-none">
        <div class="card-header py-3 bg-white border-bottom">
          <div>
            <h2 class="card-title fs-2 fw-bold text-dark m-0">
              ${State.t('transactions.issue_title') || 'Issue Raw Gold'}
            </h2>
            <div class="text-muted fs-4">Record raw bullion transferred from jeweller custody to artisan</div>
          </div>
        </div>

        <div class="card-body p-4">
          <!-- Voice Assistance Card -->
          <div class="card bg-light border mb-4">
            <div class="card-body p-3">
              <div class="d-flex align-items-center justify-content-between mb-2">
                <div class="d-flex align-items-center gap-2">
                  <span class="badge bg-primary text-white px-2 py-1">
                    <svg class="icon me-1" width="14" height="14" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><rect x="9" y="2" width="6" height="11" rx="3"/><path d="M5 10a7 7 0 0 0 14 0"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                    AI Assistant
                  </span>
                  <span class="fw-semibold text-dark text-xs">Vernacular Voice/Text Draft (Hindi / Kannada / English)</span>
                </div>
                <button type="button" id="start-voice-btn" class="btn btn-sm btn-outline-primary">
                  <svg class="icon me-1" width="14" height="14" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 1a3 3 0 0 0 -3 3v8a3 3 0 0 0 6 0v-8a3 3 0 0 0 -3 -3z"/><path d="M19 10v2a7 7 0 0 1 -14 0v-2"/></svg>
                  Start Speaking
                </button>
              </div>
              <div class="input-group">
                <input type="text" id="voice-text-input" class="form-control form-control-sm" placeholder="e.g. रवि को 50 ग्राम 22 कैरेट सोना जारी करो">
                <button type="button" id="parse-voice-btn" class="btn btn-sm btn-secondary">Parse Draft</button>
              </div>
              <div class="text-muted text-xs mt-2">Drafts are suggestions only. Review parsed fields, resolve questions/missing information, and edit the form before using the explicit submit action. No transaction is created by parsing.</div>
              <div id="voice-feedback" class="mt-2 d-none"></div>
              <div id="voice-draft-review" class="d-none"></div>
            </div>
          </div>

          <!-- Transaction Form -->
          <form id="issue-form">
            <!-- Order Selector -->
            <div class="mb-3">
              <label class="form-label required" for="issue-order-id">
                ${State.t('transactions.order_id') || 'Associated Contract Order'}
              </label>
              <select id="issue-order-id" class="form-select" required>
                <option value="">-- Select Order Contract --</option>
                ${orders.map((o) => `
                  <option value="${o.id}" ${String(o.id) === prefillOrderId ? 'selected' : ''}>
                    #${o.id} - ${escapeHtml(o.description)} (Wastage: ${o.wastage_pct}%)
                  </option>
                `).join('')}
              </select>
            </div>

            <!-- Weight & Purity -->
            <div class="row">
              <div class="col-md-6 mb-3">
                <label class="form-label required" for="issue-weight">
                  ${State.t('transactions.weight_g') || 'Gross Weight (Grams)'}
                </label>
                <div class="input-group">
                  <input type="text" id="issue-weight" class="form-control font-monospace" required placeholder="50.0000" autocomplete="off">
                  <span class="input-group-text font-monospace">g</span>
                </div>
                <div class="form-hint text-muted">4 decimal precision (0.1 mg calibrated accuracy).</div>
              </div>

              <div class="col-md-6 mb-3">
                <label class="form-label required" for="issue-karat">
                  ${State.t('transactions.karat') || 'Assayed Purity'}
                </label>
                <select id="issue-karat" class="form-select" required>
                  <option value="24">24 Karat (99.5% Fine Gold)</option>
                  <option value="22" selected>22 Karat (91.6% Fine Gold)</option>
                  <option value="20">20 Karat (83.3% Fine Gold)</option>
                  <option value="18">18 Karat (75.0% Fine Gold)</option>
                  <option value="14">14 Karat (58.5% Fine Gold)</option>
                </select>
              </div>
            </div>

            <!-- Scale Photo OCR Section -->
            <div class="card bg-light border mb-3">
              <div class="card-body p-3">
                <div class="d-flex align-items-center gap-2 mb-2">
                  <span class="badge bg-secondary-subtle text-secondary px-2 py-1">
                    <svg class="icon me-1" width="14" height="14" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 7h1a2 2 0 0 0 2 -2a1 1 0 0 1 1 -1h6a1 1 0 0 1 1 1a2 2 0 0 0 2 2h1a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-9a2 2 0 0 1 2 -2"/><circle cx="12" cy="13" r="3"/></svg>
                    Objective Witness
                  </span>
                  <span class="fw-semibold text-dark text-xs">Scale Display Photo (OCR Verification)</span>
                </div>
                <input type="file" id="scale-photo-file" accept="image/*" class="form-control form-control-sm">
                <div id="scale-ocr-feedback" class="mt-2 text-xs text-muted">Optional: attach a clear photo of the scale display. If attached, OCR runs after the issue record is committed and the result will be shown below for manual review. OCR is assistive only and does not change the recorded weight.</div>
                <div id="scale-ocr-result" class="d-none"></div>
              </div>
            </div>

            <!-- Note -->
            <div class="mb-4">
              <label class="form-label" for="issue-note">
                ${State.t('transactions.note') || 'Bullion Batch / Markings / Remarks'}
              </label>
              <textarea id="issue-note" class="form-control" rows="2" placeholder="e.g. 50g bar stamped MMTC-PAMP Serial #9281"></textarea>
            </div>

            <!-- Actions -->
            <div class="d-flex justify-content-between align-items-center">
              <a href="#/orders" class="btn btn-outline-secondary">
                ${State.t('common.cancel') || 'Cancel'}
              </a>
              <button type="submit" id="submit-issue-btn" class="btn btn-primary px-4">
                <svg class="icon me-1" width="18" height="18" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 12l5 5l10 -10"/></svg>
                ${State.t('transactions.submit_issue') || 'Commit Issue Record'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
}

renderIssue.afterRender = () => {
  const form = document.getElementById('issue-form');
  const voiceBtn = document.getElementById('start-voice-btn');
  const parseVoiceBtn = document.getElementById('parse-voice-btn');
  const voiceTextInput = document.getElementById('voice-text-input');
  const voiceFeedback = document.getElementById('voice-feedback');
  const voiceDraftReviewEl = document.getElementById('voice-draft-review');
  const scaleInput = document.getElementById('scale-photo-file');
  const scaleFeedback = document.getElementById('scale-ocr-feedback');
  const scaleResultEl = document.getElementById('scale-ocr-result');
  const submitBtn = document.getElementById('submit-issue-btn');
  let pendingNavigationOrderId = null;
  let lastOcrTx = null; // { txId, normWeight, orderId }
  const voiceReview = voiceDraftReviewEl ? createVoiceDraftReview(voiceDraftReviewEl) : null;

  const ocrReview = scaleResultEl ? createScaleOcrReview(scaleResultEl, {
    onRetry: async () => {
      const file = scaleInput?.files?.[0];
      if (!lastOcrTx || !lastOcrTx.txId) {
        Toast.error('No committed transaction is available for OCR retry. Please submit the form again if needed.');
        return;
      }
      if (!file) {
        Toast.error('Please select a scale photo file to retry the OCR upload.');
        scaleInput?.focus();
        return;
      }
      await runScaleOcrUpload(lastOcrTx.txId, lastOcrTx.normWeight, file, lastOcrTx.orderId);
    },
    onContinue: () => {
      if (pendingNavigationOrderId != null) {
        window.location.hash = `#/orders/${pendingNavigationOrderId}`;
      }
    },
  }) : null;

  async function runScaleOcrUpload(txId, normWeight, file, orderId) {
    pendingNavigationOrderId = orderId;
    lastOcrTx = { txId, normWeight, orderId };
    try {
      ocrReview?.setUploading({ enteredWeight: normWeight, fileName: file?.name || '' });
      if (scaleFeedback) {
        scaleFeedback.classList.remove('d-none');
        scaleFeedback.innerHTML = `<span class="spinner-border spinner-border-sm text-primary me-2" role="status" aria-hidden="true"></span><span class="text-muted">Uploading scale photo and running OCR witness check...</span>`;
      }
      const result = await OcrService.processScalePhoto(txId, normWeight, file);
      ocrReview?.setResult(result, { enteredWeight: normWeight, fileName: file?.name || '' });
      const status = String(result?.status || '').toUpperCase();
      if (status === 'MATCH') {
        Toast.success('Scale photo OCR witness uploaded. Reading matches the entered weight (assistive check).');
      } else if (status === 'MISMATCH') {
        Toast.warning('Scale photo OCR witness uploaded. Mismatch detected — manual review is required.');
      } else {
        Toast.warning('Scale photo OCR witness uploaded. Image unreadable — manual review is required.');
      }
      if (scaleFeedback) {
        scaleFeedback.classList.remove('d-none');
        scaleFeedback.innerHTML = `<span class="badge bg-secondary-subtle text-secondary me-1">Witness uploaded</span> Review the OCR result below before continuing.`;
      }
    } catch (err) {
      console.warn('Scale photo attachment warning:', err);
      ocrReview?.setError(err, { enteredWeight: normWeight, fileName: file?.name || '' });
      if (scaleFeedback) {
        scaleFeedback.classList.remove('d-none');
        scaleFeedback.innerHTML = `<span class="badge bg-danger-subtle text-danger me-1">Upload issue</span> OCR witness could not be completed. Review the message below; the transaction record remains unchanged.`;
      }
      Toast.error('Issue recorded, but scale photo OCR witness could not be processed. Review and retry or continue with manual verification.');
    }
  }

  // 1. Voice Recognition Handling
  if (voiceBtn) {
    let recognizer = null;
    voiceBtn.addEventListener('click', () => {
      if (!VoiceService.isSpeechSupported()) {
        Toast.info('Browser speech recognition is not available. Please type the transaction description and use "Parse Draft", or enter details manually.');
        voiceTextInput?.focus();
        return;
      }
      voiceBtn.innerText = 'Listening...';
      voiceBtn.disabled = true;
      recognizer = VoiceService.createRecognizer(
        (transcript) => {
          if (voiceTextInput) voiceTextInput.value = transcript;
          voiceBtn.innerText = 'Start Speaking';
          voiceBtn.disabled = false;
          parseVoiceText(transcript);
        },
        (err) => {
          voiceBtn.innerText = 'Start Speaking';
          voiceBtn.disabled = false;
          if (voiceFeedback) {
            voiceFeedback.classList.remove('d-none');
            voiceFeedback.innerHTML = `<span class="text-warning text-xs">Speech recognition could not capture input (${escapeHtml(String(err || 'unknown error'))}). Please type the description and parse again, or enter details manually.</span>`;
          }
          Toast.error('Speech recognition error. You can type the transaction description and parse it as text.');
        }
      );
      if (recognizer) {
        try {
          recognizer.start();
        } catch (err) {
          voiceBtn.innerText = 'Start Speaking';
          voiceBtn.disabled = false;
          Toast.error('Could not start speech recognition. Please type the description and parse it as text.');
        }
      } else {
        voiceBtn.innerText = 'Start Speaking';
        voiceBtn.disabled = false;
      }
    });
  }

  if (parseVoiceBtn) {
    parseVoiceBtn.addEventListener('click', () => {
      const text = voiceTextInput?.value.trim();
      if (!text) {
        if (voiceFeedback) {
          voiceFeedback.classList.remove('d-none');
          voiceFeedback.innerHTML = '<span class="text-danger text-xs">Please enter or speak a transaction description before parsing.</span>';
        }
        Toast.error('Please enter a transaction description to parse.');
        voiceTextInput?.focus();
        return;
      }
      parseVoiceText(text);
    });
  }

  async function parseVoiceText(text) {
    const inputText = String(text || '').trim();
    if (!inputText) {
      if (voiceFeedback) {
        voiceFeedback.classList.remove('d-none');
        voiceFeedback.innerHTML = '<span class="text-danger text-xs">Please enter or speak a transaction description before parsing.</span>';
      }
      return;
    }
    try {
      if (voiceFeedback) {
        voiceFeedback.classList.remove('d-none');
        voiceFeedback.innerHTML = '<span class="spinner-border spinner-border-sm text-primary me-2"></span><span class="text-muted text-xs">Parsing draft for human review (no transaction is saved)...</span>';
      }
      voiceReview?.setParsing(inputText);

      const draft = await VoiceService.parseVoiceText(inputText);
      voiceReview?.setDraft(draft, inputText);

      if (voiceFeedback) {
        const missingCount = Array.isArray(draft?.missing) ? draft.missing.length : 0;
        const questionCount = Array.isArray(draft?.questions) ? draft.questions.length : 0;
        voiceFeedback.classList.remove('d-none');
        voiceFeedback.innerHTML = `<div class="alert alert-info border py-2 px-3 mb-0"><div class="text-sm fw-semibold mb-1">Draft parsed for review</div><div class="text-xs text-muted mb-0">Review the draft panel below, edit form fields as needed, and explicitly submit when ready.${missingCount || questionCount ? ` Missing: ${missingCount}, questions: ${questionCount}.` : ''}</div></div>`;
      }

      const fields = (draft && typeof draft.fields === 'object' && draft.fields) ? draft.fields : {};
      const parsedWeight = fields.weight_g ?? draft.weight_g;
      const parsedKarat = fields.karat ?? draft.karat;
      const parsedNote = fields.article ?? fields.order_ref ?? draft.article;
      const parsedScrap = fields.scrap_g ?? draft.scrap_g;

      // Pre-fill editable fields for human confirmation (user may edit before submit)
      if (parsedWeight !== undefined && parsedWeight !== null && parsedWeight !== '') {
        const weightInput = document.getElementById('issue-weight');
        if (weightInput) {
          try { weightInput.value = Validators.formatWeight4(String(parsedWeight)); } catch { weightInput.value = String(parsedWeight); }
        }
      }
      if (parsedKarat !== undefined && parsedKarat !== null && parsedKarat !== '') {
        const karatInput = document.getElementById('issue-karat');
        if (karatInput) karatInput.value = String(parsedKarat);
      }
      if (parsedNote !== undefined && parsedNote !== null && String(parsedNote).trim() !== '') {
        const noteInput = document.getElementById('issue-note');
        if (noteInput && !String(noteInput.value || '').trim()) noteInput.value = String(parsedNote);
      }
      if (parsedScrap !== undefined && parsedScrap !== null && String(parsedScrap).trim() !== '') {
        const scrapInput = document.getElementById('issue-scrap'); // no-op for issue form; kept for parity/extensibility
        if (scrapInput) {
          try { scrapInput.value = Validators.formatWeight4(String(parsedScrap)); } catch { scrapInput.value = String(parsedScrap); }
        }
      }

      Toast.success('Voice/text draft parsed. Review the draft, edit fields if needed, and submit explicitly.');
    } catch (e) {
      voiceReview?.setError(e, inputText);
      if (voiceFeedback) {
        voiceFeedback.classList.remove('d-none');
        voiceFeedback.innerHTML = `<span class="text-danger text-xs">Failed to parse draft: ${escapeHtml(e?.message || 'Unknown error')}. You can edit the text and retry, or enter details manually.</span>`;
      }
      Toast.error('Could not parse voice/text draft. Manual entry is still available.');
    }
  }

  // 2. Scale Photo File Selection
  if (scaleInput) {
    scaleInput.addEventListener('change', () => {
      const file = scaleInput.files[0];
      if (file && scaleFeedback) {
        scaleFeedback.classList.remove('d-none');
        scaleFeedback.innerHTML = `
          <span class="badge bg-success-subtle text-success me-1">Photo Attached</span>
          <strong>${escapeHtml(file.name)}</strong> (${(file.size / 1024).toFixed(1)} KB). Optical recognition will run after the issue record is committed.
        `;
      } else if (scaleFeedback) {
        scaleFeedback.classList.remove('d-none');
        scaleFeedback.innerHTML = 'Optional: attach a clear photo of the scale display. If attached, OCR runs after the issue record is committed and the result will be shown below for manual review. OCR is assistive only and does not change the recorded weight.';
      }
      if (ocrReview && !pendingNavigationOrderId) {
        ocrReview.setIdle();
      }
    });
  }

  // 3. Form Submit
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const orderId = document.getElementById('issue-order-id')?.value;
      const weight = document.getElementById('issue-weight')?.value.trim();
      const karat = document.getElementById('issue-karat')?.value;
      const note = document.getElementById('issue-note')?.value.trim();

      if (!orderId) {
        Toast.error('Please select an order contract.');
        return;
      }
      if (!Validators.isValidWeight(weight)) {
        Toast.error('Weight must be a positive decimal number with up to 4 decimal places.');
        return;
      }

      const voiceState = voiceReview?.getState?.();
      if (voiceState?.phase === 'parsing') {
        Toast.error('Please wait for the voice/text draft parsing to complete, then review it before submitting.');
        return;
      }
      if (voiceState?.phase === 'draft' && voiceState.requiresAcknowledgement && !voiceState.acknowledged) {
        Toast.error('Please review the AI draft and tick the acknowledgement checkbox before submitting.');
        voiceDraftReviewEl?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
        return;
      }

      try {
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Committing Record...';
        }

        const normWeight = Validators.formatWeight4(weight);
        const res = await Api.issueGold({
          order_id: Number(orderId),
          weight_g: normWeight,
          karat: Number(karat),
          note,
        });

        if (res && res._offline_queued) {
          Toast.info('Gold issue saved offline in IndexedDB. Will sync when connectivity returns.');
          window.location.hash = `#/orders/${orderId}`;
          return;
        }

        Toast.success('Gold issue recorded on ledger. Awaiting karigar confirmation.');

        // If scale photo was attached, upload it for OCR comparison and require post-upload review in UI.
        const file = scaleInput?.files?.[0];
        if (file && res && res.id) {
          await runScaleOcrUpload(res.id, normWeight, file, orderId);
          // Keep user on page to review OCR result and explicitly acknowledge when required.
          return;
        }

        window.location.hash = `#/orders/${orderId}`;
      } catch (err) {
        Toast.error(err.message || 'Failed to record gold issue.');
      } finally {
        // Keep submit disabled while OCR review panel is awaiting explicit continuation after upload/result.
        const awaitingReview = !!(pendingNavigationOrderId && ocrReview && ocrReview.getState().phase !== 'idle');
        if (submitBtn && !awaitingReview) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = `
            <svg class="icon me-1" width="18" height="18" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 12l5 5l10 -10"/></svg>
            ${State.t('transactions.submit_issue') || 'Commit Issue Record'}
          `;
        } else if (submitBtn && awaitingReview) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = 'Issue recorded — review OCR witness below';
        }
      }
    });
  }
};
