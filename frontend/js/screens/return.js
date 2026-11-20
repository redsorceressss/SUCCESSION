/**
 * Return Finished Gold & Scrap Screen
 * Tabler 1.7.4 Enterprise Design System
 * Records ornaments returned and scrap metal recovered for mass balance conservation.
 */

import { Api } from '../api.js';
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

export async function renderReturn() {
  const hash = window.location.hash;
  const urlParams = new URLSearchParams(hash.includes('?') ? hash.split('?')[1] : '');
  const prefillOrderId = urlParams.get('order_id') || '';

  let orders = [];
  try {
    orders = await Api.getOrders();
  } catch (e) {
    console.warn('Orders fetch error:', e);
  }

  return `
    <div class="container-tight py-4">
      <!-- Breadcrumbs -->
      <nav aria-label="breadcrumb" class="mb-3">
        <ol class="breadcrumb">
          <li class="breadcrumb-item"><a href="#/orders" class="text-muted">Job-Work Orders</a></li>
          <li class="breadcrumb-item active text-dark fw-semibold" aria-current="page">Return Custody</li>
        </ol>
      </nav>

      <div class="card border shadow-none">
        <div class="card-header py-3 bg-white border-bottom">
          <div>
            <h2 class="card-title fs-2 fw-bold text-dark m-0">
              ${State.t('transactions.return_title') || 'Return Finished Gold & Scrap'}
            </h2>
            <div class="text-muted fs-4">Record finished ornaments and recovered filings/scrap returned to jeweller</div>
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
                <button type="button" id="start-voice-return-btn" class="btn btn-sm btn-outline-primary">
                  <svg class="icon me-1" width="14" height="14" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 1a3 3 0 0 0 -3 3v8a3 3 0 0 0 6 0v-8a3 3 0 0 0 -3 -3z"/><path d="M19 10v2a7 7 0 0 1 -14 0v-2"/></svg>
                  Start Speaking
                </button>
              </div>
              <div class="input-group">
                <input type="text" id="voice-return-input" class="form-control form-control-sm" placeholder="e.g. वापसी 47.1000 ग्राम स्क्रैप 1.4500 ग्राम 22 कैरेट">
                <button type="button" id="parse-voice-return-btn" class="btn btn-sm btn-secondary">Parse Draft</button>
              </div>
              <div class="text-muted text-xs mt-2">Drafts are suggestions only. Review parsed fields, resolve questions/missing information, and edit the form before using the explicit submit action. No transaction is created by parsing.</div>
              <div id="voice-return-feedback" class="mt-2 d-none"></div>
              <div id="voice-return-draft-review" class="d-none"></div>
            </div>
          </div>

          <!-- Return Form -->
          <form id="return-form">
            <!-- Order Selector -->
            <div class="mb-3">
              <label class="form-label required" for="return-order-id">
                ${State.t('transactions.order_id') || 'Associated Contract Order'}
              </label>
              <select id="return-order-id" class="form-select" required>
                <option value="">-- Select Order Contract --</option>
                ${orders.map((o) => `
                  <option value="${o.id}" ${String(o.id) === prefillOrderId ? 'selected' : ''}>
                    #${o.id} - ${escapeHtml(o.description)}
                  </option>
                `).join('')}
              </select>
            </div>

            <!-- Finished Article Weight & Purity -->
            <div class="row">
              <div class="col-md-6 mb-3">
                <label class="form-label required" for="return-weight">
                  Finished Ornament Weight (Grams)
                </label>
                <div class="input-group">
                  <input type="text" id="return-weight" class="form-control font-monospace" required placeholder="47.1000" autocomplete="off">
                  <span class="input-group-text font-monospace">g</span>
                </div>
                <div class="form-hint text-muted">Primary crafted jewellery weight (0.1 mg accuracy).</div>
              </div>

              <div class="col-md-6 mb-3">
                <label class="form-label required" for="return-karat">
                  ${State.t('transactions.karat') || 'Assayed Purity'}
                </label>
                <select id="return-karat" class="form-select" required>
                  <option value="24">24 Karat (99.5% Fine Gold)</option>
                  <option value="22" selected>22 Karat (91.6% Fine Gold)</option>
                  <option value="20">20 Karat (83.3% Fine Gold)</option>
                  <option value="18">18 Karat (75.0% Fine Gold)</option>
                  <option value="14">14 Karat (58.5% Fine Gold)</option>
                </select>
              </div>
            </div>

            <!-- Recovered Scrap / Filings -->
            <div class="mb-3">
              <label class="form-label" for="return-scrap">
                Recovered Scrap / Lemonade / Filings (Grams)
              </label>
              <div class="input-group">
                <input type="text" id="return-scrap" class="form-control font-monospace" value="0.0000" placeholder="0.0000" autocomplete="off">
                <span class="input-group-text font-monospace">g</span>
              </div>
              <div class="form-hint text-muted">Recoverable workshop waste credited back to the jeweller.</div>
            </div>

            <!-- Scale Photo OCR Witness -->
            <div class="card bg-light border mb-3">
              <div class="card-body p-3">
                <div class="d-flex align-items-center gap-2 mb-2">
                  <span class="badge bg-secondary-subtle text-secondary px-2 py-1">
                    <svg class="icon me-1" width="14" height="14" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 7h1a2 2 0 0 0 2 -2a1 1 0 0 1 1 -1h6a1 1 0 0 1 1 1a2 2 0 0 0 2 2h1a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-9a2 2 0 0 1 2 -2"/><circle cx="12" cy="13" r="3"/></svg>
                    Objective Witness
                  </span>
                  <span class="fw-semibold text-dark text-xs">Scale Display Photo (OCR Verification)</span>
                </div>
                <input type="file" id="return-scale-photo-file" accept="image/*" class="form-control form-control-sm">
                <div id="return-scale-ocr-feedback" class="mt-2 text-xs text-muted">Optional: attach a clear photo of the scale display. If attached, OCR runs after the return record is committed and the result will be shown below for manual review. OCR is assistive only and does not change the recorded weight.</div>
                <div id="return-scale-ocr-result" class="d-none"></div>
              </div>
            </div>

            <!-- Note -->
            <div class="mb-4">
              <label class="form-label" for="return-note">
                ${State.t('transactions.note') || 'Handover Remarks / Description'}
              </label>
              <textarea id="return-note" class="form-control" rows="2" placeholder="e.g. Finished bridal necklace delivered with filing sweeps"></textarea>
            </div>

            <!-- Actions -->
            <div class="d-flex justify-content-between align-items-center">
              <a href="#/orders" class="btn btn-outline-secondary">
                ${State.t('common.cancel') || 'Cancel'}
              </a>
              <button type="submit" id="submit-return-btn" class="btn btn-primary px-4">
                <svg class="icon me-1" width="18" height="18" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 12l5 5l10 -10"/></svg>
                ${State.t('transactions.submit_return') || 'Commit Return Record'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
}

renderReturn.afterRender = () => {
  const form = document.getElementById('return-form');
  const voiceBtn = document.getElementById('start-voice-return-btn');
  const parseVoiceBtn = document.getElementById('parse-voice-return-btn');
  const voiceInput = document.getElementById('voice-return-input');
  const voiceFeedback = document.getElementById('voice-return-feedback');
  const voiceDraftReviewEl = document.getElementById('voice-return-draft-review');
  const scaleInput = document.getElementById('return-scale-photo-file');
  const scaleFeedback = document.getElementById('return-scale-ocr-feedback');
  const scaleResultEl = document.getElementById('return-scale-ocr-result');
  const submitBtn = document.getElementById('submit-return-btn');
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
      Toast.error('Return recorded, but scale photo OCR witness could not be processed. Review and retry or continue with manual verification.');
    }
  }

  // 1. Voice Recognition
  if (voiceBtn) {
    voiceBtn.addEventListener('click', () => {
      if (!VoiceService.isSpeechSupported()) {
        Toast.info('Browser speech recognition is not available. Please type the transaction description and use "Parse Draft", or enter details manually.');
        voiceInput?.focus();
        return;
      }
      voiceBtn.innerText = 'Listening...';
      voiceBtn.disabled = true;
      const recognizer = VoiceService.createRecognizer(
        (transcript) => {
          if (voiceInput) voiceInput.value = transcript;
          voiceBtn.innerText = 'Start Speaking';
          voiceBtn.disabled = false;
          parseVoiceReturn(transcript);
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
      const text = voiceInput?.value.trim();
      if (!text) {
        if (voiceFeedback) {
          voiceFeedback.classList.remove('d-none');
          voiceFeedback.innerHTML = '<span class="text-danger text-xs">Please enter or speak a transaction description before parsing.</span>';
        }
        Toast.error('Please enter a transaction description to parse.');
        voiceInput?.focus();
        return;
      }
      parseVoiceReturn(text);
    });
  }

  async function parseVoiceReturn(text) {
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
      const parsedScrap = fields.scrap_g ?? draft.scrap_g;
      const parsedNote = fields.article ?? fields.order_ref ?? draft.article;

      // Pre-fill editable fields for human confirmation (user may edit before submit)
      if (parsedWeight !== undefined && parsedWeight !== null && parsedWeight !== '') {
        const weightInput = document.getElementById('return-weight');
        if (weightInput) {
          try { weightInput.value = Validators.formatWeight4(String(parsedWeight)); } catch { weightInput.value = String(parsedWeight); }
        }
      }
      if (parsedKarat !== undefined && parsedKarat !== null && parsedKarat !== '') {
        const karatInput = document.getElementById('return-karat');
        if (karatInput) karatInput.value = String(parsedKarat);
      }
      if (parsedScrap !== undefined && parsedScrap !== null && parsedScrap !== '') {
        const scrapInput = document.getElementById('return-scrap');
        if (scrapInput) {
          try { scrapInput.value = Validators.formatWeight4(String(parsedScrap)); } catch { scrapInput.value = String(parsedScrap); }
        }
      }
      if (parsedNote !== undefined && parsedNote !== null && String(parsedNote).trim() !== '') {
        const noteInput = document.getElementById('return-note');
        if (noteInput && !String(noteInput.value || '').trim()) noteInput.value = String(parsedNote);
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
          <strong>${escapeHtml(file.name)}</strong> (${(file.size / 1024).toFixed(1)} KB). Optical verification will run after the return record is committed.
        `;
      } else if (scaleFeedback) {
        scaleFeedback.classList.remove('d-none');
        scaleFeedback.innerHTML = 'Optional: attach a clear photo of the scale display. If attached, OCR runs after the return record is committed and the result will be shown below for manual review. OCR is assistive only and does not change the recorded weight.';
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
      const orderId = document.getElementById('return-order-id')?.value;
      const weight = document.getElementById('return-weight')?.value.trim();
      const karat = document.getElementById('return-karat')?.value;
      const scrap = document.getElementById('return-scrap')?.value.trim() || '0.0000';
      const note = document.getElementById('return-note')?.value.trim();

      if (!orderId) {
        Toast.error('Please select an order contract.');
        return;
      }
      if (!Validators.isValidWeight(weight)) {
        Toast.error('Weight must be a positive decimal number with up to 4 decimal places.');
        return;
      }
      if (!Validators.isValidGrams0(scrap)) {
        Toast.error('Scrap weight must be a non-negative decimal (0 or positive).');
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
        const normScrap = Validators.formatWeight4(scrap);

        const res = await Api.returnGold({
          order_id: Number(orderId),
          weight_g: normWeight,
          karat: Number(karat),
          scrap_g: normScrap,
          note,
        });

        if (res && res._offline_queued) {
          Toast.info('Return saved offline in IndexedDB. Will sync when connectivity returns.');
          window.location.hash = `#/orders/${orderId}`;
          return;
        }

        Toast.success('Gold return recorded. Awaiting jeweller confirmation.');

        const file = scaleInput?.files?.[0];
        if (file && res && res.id) {
          await runScaleOcrUpload(res.id, normWeight, file, orderId);
          // Keep user on page to review OCR result and explicitly acknowledge when required.
          return;
        }

        window.location.hash = `#/orders/${orderId}`;
      } catch (err) {
        Toast.error(err.message || 'Failed to record gold return.');
      } finally {
        const awaitingReview = !!(pendingNavigationOrderId && ocrReview && ocrReview.getState().phase !== 'idle');
        if (submitBtn && !awaitingReview) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = `
            <svg class="icon me-1" width="18" height="18" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 12l5 5l10 -10"/></svg>
            ${State.t('transactions.submit_return') || 'Commit Return Record'}
          `;
        } else if (submitBtn && awaitingReview) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = 'Return recorded — review OCR witness below';
        }
      }
    });
  }
};
