/**
 * Scale photo OCR review panel (assistive witness only).
 * Renders upload/result states and requires explicit human acknowledgement when needed.
 * No financial records are modified by this component.
 */

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtWeight(v) {
  if (v === null || v === undefined || v === '') return 'Not available';
  const s = String(v);
  return s === '' ? 'Not available' : `${esc(s)} g`;
}

function statusMeta(status) {
  const s = String(status || '').toUpperCase();
  if (s === 'MATCH') {
    return {
      label: 'MATCH',
      badge: 'bg-success text-white',
      tone: 'success',
      icon: '✓',
      title: 'Entered weight matches OCR reading',
      explanation: 'The scale-photo OCR reading matches the entered weight within the configured tolerance. This is an assistive witness check only and not an independent financial approval or transaction confirmation.',
    };
  }
  if (s === 'MISMATCH') {
    return {
      label: 'MISMATCH',
      badge: 'bg-danger text-white',
      tone: 'danger',
      icon: '!',
      title: 'OCR reading differs from entered weight',
      explanation: 'The scale display reading differs from the entered weight. Manually inspect the physical scale and verify the correct value. The entered transaction weight is not changed automatically.',
    };
  }
  return {
    label: 'UNREADABLE',
    badge: 'bg-warning text-dark',
    tone: 'warning',
    icon: '?',
    title: 'Scale photo could not be reliably read',
    explanation: 'The image could not be reliably interpreted by OCR. You may retry with a clearer photo or continue with manual verification. No guessed reading is shown.',
  };
}

export function createScaleOcrReview(container, options = {}) {
  const state = {
    phase: 'idle', // idle | uploading | result | error
    enteredWeight: '',
    fileName: '',
    result: null,
    error: null,
    acknowledged: false,
  };

  function needsReview() {
    if (state.phase === 'error') return true;
    if (state.phase !== 'result' || !state.result) return false;
    const st = String(state.result.status || '').toUpperCase();
    return st === 'MISMATCH' || st === 'UNREADABLE' || !!state.result.needsManualConfirm;
  }

  function canContinue() {
    if (state.phase === 'uploading') return false;
    if (state.phase === 'idle') return true;
    if (needsReview()) return !!state.acknowledged;
    return state.phase === 'result';
  }

  function emit() {
    if (typeof options.onStateChange === 'function') {
      options.onStateChange({ ...state, needsReview: needsReview(), canContinue: canContinue() });
    }
  }

  function renderIdle() {
    container.classList.add('d-none');
    container.innerHTML = '';
  }

  function renderUploading() {
    container.classList.remove('d-none');
    container.innerHTML = `
      <div class="card border mt-3" data-ocr-panel="1">
        <div class="card-body p-3">
          <div class="d-flex align-items-center gap-2">
            <span class="spinner-border spinner-border-sm text-primary" role="status" aria-hidden="true"></span>
            <div>
              <div class="fw-semibold text-dark">Uploading scale photo for OCR witness review...</div>
              <div class="text-muted text-xs">Entered weight: <span class="font-monospace">${fmtWeight(state.enteredWeight)}</span>${state.fileName ? ` · File: <strong>${esc(state.fileName)}</strong>` : ''}</div>
            </div>
          </div>
        </div>
      </div>`;
  }

  function renderError() {
    container.classList.remove('d-none');
    const msg = state.error?.message || 'Scale photo could not be processed at this time.';
    container.innerHTML = `
      <div class="card border border-danger-subtle mt-3" data-ocr-panel="1">
        <div class="card-status-top bg-danger"></div>
        <div class="card-body p-3">
          <div class="d-flex align-items-start justify-content-between gap-2 mb-2">
            <div>
              <span class="badge bg-danger text-white me-2">UPLOAD/API ERROR</span>
              <span class="fw-semibold text-dark">Scale photo witness could not be completed</span>
            </div>
          </div>
          <p class="text-muted mb-2 text-sm">${esc(msg)}</p>
          <div class="alert alert-warning border mb-3 py-2 px-3">
            <div class="text-sm mb-0">The transaction record and any previously stored evidence remain unchanged by this review step. You may retry the upload or continue with manual verification.</div>
          </div>
          <div class="row g-2 mb-3">
            <div class="col-sm-6">
              <div class="text-muted text-xs">Entered weight</div>
              <div class="font-monospace fw-semibold">${fmtWeight(state.enteredWeight)}</div>
            </div>
            <div class="col-sm-6">
              <div class="text-muted text-xs">OCR reading</div>
              <div class="font-monospace fw-semibold">Not available</div>
            </div>
          </div>
          ${reviewAckHtml('I will proceed with manual verification because OCR witness upload failed for this attempt.')}
          <div class="d-flex flex-wrap gap-2 mt-3">
            <button type="button" class="btn btn-outline-primary btn-sm" data-ocr-action="retry">Retry upload</button>
            <button type="button" class="btn btn-primary btn-sm" data-ocr-action="continue" ${state.acknowledged ? '' : 'disabled'}>Continue</button>
          </div>
        </div>
      </div>`;
    wireActions();
  }

  function reviewAckHtml(label) {
    if (!needsReview()) return '';
    const checked = state.acknowledged ? 'checked' : '';
    return `
      <div class="border rounded p-2 bg-light">
        <label class="form-check mb-1">
          <input class="form-check-input" type="checkbox" data-ocr-action="ack" ${checked}>
          <span class="form-check-label text-sm fw-semibold text-dark">Manual review acknowledgement (required)</span>
        </label>
        <div class="text-muted text-xs">${esc(label || 'I have manually inspected the physical scale/photo and reviewed this OCR result.')}</div>
      </div>`;
  }

  function renderResult() {
    const r = state.result || {};
    const meta = statusMeta(r.status);
    const reviewRequired = needsReview();
    const ocrReading = (r.ocrReadingG === null || r.ocrReadingG === undefined || r.ocrReadingG === '') ? null : r.ocrReadingG;
    const confidence = (r.confidence === null || r.confidence === undefined || r.confidence === '') ? null : r.confidence;
    const entered = (r.enteredG ?? state.enteredWeight);
    const disclaimer = r.disclaimer || 'OCR reading is assistive evidence only. It does not independently verify purity or approve a financial record.';
    container.classList.remove('d-none');
    container.innerHTML = `
      <div class="card border mt-3" data-ocr-panel="1">
        <div class="card-status-top bg-${meta.tone}"></div>
        <div class="card-body p-3">
          <div class="d-flex flex-wrap align-items-start justify-content-between gap-2 mb-2">
            <div>
              <span class="badge ${meta.badge} me-2">${esc(meta.label)}</span>
              <span class="fw-semibold text-dark">${esc(meta.title)}</span>
            </div>
            ${reviewRequired ? '<span class="badge bg-warning-lt text-warning border border-warning-subtle">Manual review required</span>' : '<span class="badge bg-success-lt text-success border border-success-subtle">Assistive check complete</span>'}
          </div>

          <p class="text-muted text-sm mb-3">${esc(meta.explanation)}</p>

          <div class="row g-2 mb-3">
            <div class="col-sm-4">
              <div class="border rounded p-2 h-100 bg-white">
                <div class="text-muted text-xs mb-1">Entered weight</div>
                <div class="font-monospace fw-bold text-dark">${fmtWeight(entered)}</div>
              </div>
            </div>
            <div class="col-sm-4">
              <div class="border rounded p-2 h-100 bg-white">
                <div class="text-muted text-xs mb-1">OCR-detected weight</div>
                <div class="font-monospace fw-bold text-dark">${ocrReading == null ? 'Not available' : fmtWeight(ocrReading)}</div>
              </div>
            </div>
            <div class="col-sm-4">
              <div class="border rounded p-2 h-100 bg-white">
                <div class="text-muted text-xs mb-1">Comparison status</div>
                <div class="fw-semibold text-dark">${esc(meta.label)}${confidence != null ? ` <span class="text-muted fw-normal">(confidence: ${esc(confidence)})</span>` : ''}</div>
              </div>
            </div>
          </div>

          ${String(r.status || '').toUpperCase() === 'MISMATCH' ? `
            <div class="alert alert-danger border py-2 px-3 mb-3">
              <div class="fw-semibold text-sm mb-1">Discrepancy detected — inspect before relying on this entry</div>
              <div class="text-sm mb-0">Entered: <span class="font-monospace">${fmtWeight(entered)}</span> · OCR: <span class="font-monospace">${fmtWeight(ocrReading)}</span>. Manually inspect and verify the physical scale reading. The entered weight will not be replaced automatically.</div>
            </div>` : ''}

          ${String(r.status || '').toUpperCase() === 'UNREADABLE' ? `
            <div class="alert alert-warning border py-2 px-3 mb-3">
              <div class="fw-semibold text-sm mb-1">Manual verification required</div>
              <div class="text-sm mb-0">No OCR reading is available for this image. Retry with a clearer photo if possible, or continue with manual verification of the physical scale.</div>
            </div>` : ''}

          ${String(r.status || '').toUpperCase() === 'MATCH' ? `
            <div class="alert alert-success border py-2 px-3 mb-3">
              <div class="text-sm mb-0">The assistive OCR check matches the entered weight. Human review remains responsible for the recorded transaction.</div>
            </div>` : ''}

          <div class="alert alert-secondary border py-2 px-3 mb-3">
            <div class="text-xs text-muted mb-0"><strong>Disclaimer:</strong> ${esc(disclaimer)}</div>
          </div>

          ${reviewAckHtml(String(r.status || '').toUpperCase() === 'MISMATCH'
            ? 'I have manually inspected the physical scale/photo and reviewed this discrepancy. I understand the entered transaction weight is unchanged by this OCR witness.'
            : String(r.status || '').toUpperCase() === 'UNREADABLE'
              ? 'I have manually verified the physical scale reading (or will do so through existing authorised workflows). No OCR reading was available.'
              : 'I have manually reviewed this OCR witness result and understand it is assistive only.')}

          <div class="d-flex flex-wrap gap-2 mt-3">
            ${(String(r.status || '').toUpperCase() === 'UNREADABLE' || state.phase === 'error') ? '<button type="button" class="btn btn-outline-primary btn-sm" data-ocr-action="retry">Retry upload</button>' : ''}
            ${String(r.status || '').toUpperCase() === 'MISMATCH' ? '<button type="button" class="btn btn-outline-primary btn-sm" data-ocr-action="retry">Retry upload</button>' : ''}
            <button type="button" class="btn btn-primary btn-sm" data-ocr-action="continue" ${canContinue() ? '' : 'disabled'}>${reviewRequired ? 'Continue after acknowledgement' : 'Continue'}</button>
          </div>
          ${r.evidenceId ? `<div class="text-muted text-xs mt-2">Evidence record: #${esc(r.evidenceId)}${state.fileName ? ` · ${esc(state.fileName)}` : ''}</div>` : ''}
        </div>
      </div>`;
    wireActions();
  }

  function wireActions() {
    const ack = container.querySelector('[data-ocr-action="ack"]');
    if (ack) {
      ack.addEventListener('change', (e) => {
        state.acknowledged = !!e.target.checked;
        const cont = container.querySelector('[data-ocr-action="continue"]');
        if (cont) cont.disabled = !canContinue();
        emit();
      });
    }
    const retry = container.querySelector('[data-ocr-action="retry"]');
    if (retry) {
      retry.addEventListener('click', () => {
        if (typeof options.onRetry === 'function') options.onRetry();
      });
    }
    const cont = container.querySelector('[data-ocr-action="continue"]');
    if (cont) {
      cont.addEventListener('click', () => {
        if (!canContinue()) return;
        if (typeof options.onContinue === 'function') options.onContinue();
      });
    }
  }

  function render() {
    if (state.phase === 'idle') return renderIdle();
    if (state.phase === 'uploading') return renderUploading();
    if (state.phase === 'error') return renderError();
    if (state.phase === 'result') return renderResult();
    return renderIdle();
  }

  return {
    getState() { return { ...state, needsReview: needsReview(), canContinue: canContinue() }; },
    setIdle() { state.phase = 'idle'; state.result = null; state.error = null; state.acknowledged = false; render(); emit(); },
    setUploading({ enteredWeight = '', fileName = '' } = {}) {
      state.phase = 'uploading'; state.enteredWeight = enteredWeight; state.fileName = fileName; state.result = null; state.error = null; state.acknowledged = false; render(); emit();
    },
    setResult(result, meta = {}) {
      if (meta.enteredWeight != null) state.enteredWeight = meta.enteredWeight;
      if (meta.fileName != null) state.fileName = meta.fileName;
      state.phase = 'result'; state.result = result || null; state.error = null; state.acknowledged = false; render(); emit();
    },
    setError(error, meta = {}) {
      if (meta.enteredWeight != null) state.enteredWeight = meta.enteredWeight;
      if (meta.fileName != null) state.fileName = meta.fileName;
      state.phase = 'error'; state.error = error || new Error('Upload failed'); state.result = null; state.acknowledged = false; render(); emit();
    },
  };
}
