/**
 * Voice/text draft review panel (assistive, draft-only).
 * Displays parser output for human review. Never creates/confirms transactions.
 */

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function asArray(v) {
  return Array.isArray(v) ? v : [];
}

function fmtVal(v) {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'object') return esc(JSON.stringify(v));
  return esc(String(v));
}

function renderList(items, emptyText, tone = 'muted') {
  const arr = asArray(items).filter((x) => String(x ?? '').trim() !== '');
  if (!arr.length) return `<div class="text-muted text-xs">${esc(emptyText)}</div>`;
  return `<ul class="mb-0 ps-3 text-sm">${arr.map((x) => `<li class="text-${tone === 'danger' ? 'danger' : tone === 'warning' ? 'dark' : 'dark'}">${esc(String(x))}</li>`).join('')}</ul>`;
}

function renderParsedFields(fields) {
  const f = (fields && typeof fields === 'object') ? fields : {};
  const entries = Object.entries(f);
  if (!entries.length) return `<div class="text-muted text-xs">No transaction fields were parsed. Please enter details manually in the form below.</div>`;
  return `
    <div class="table-responsive">
      <table class="table table-sm table-bordered mb-0 bg-white">
        <thead><tr><th style="width:40%">Field</th><th>Parsed suggestion</th></tr></thead>
        <tbody>
          ${entries.map(([k, v]) => `<tr><td class="text-muted text-xs text-uppercase">${esc(k)}</td><td class="font-monospace text-sm">${fmtVal(v)}</td></tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

function renderConfidence(conf) {
  if (!conf || typeof conf !== 'object') return '';
  const entries = Object.entries(conf);
  if (!entries.length) return '';
  return `
    <div class="mt-2">
      <div class="text-muted text-xs mb-1">Parser confidence (as provided)</div>
      <div class="d-flex flex-wrap gap-1">
        ${entries.map(([k, v]) => `<span class="badge bg-white text-dark border">${esc(k)}: <strong>${fmtVal(v)}</strong></span>`).join('')}
      </div>
    </div>`;
}

export function createVoiceDraftReview(container, options = {}) {
  const state = {
    phase: 'idle', // idle | parsing | draft | error
    draft: null,
    originalText: '',
    error: null,
    acknowledged: false,
  };

  function hasQuestions() { return asArray(state.draft?.questions).length > 0; }
  function hasMissing() { return asArray(state.draft?.missing).length > 0; }
  function hasNeedsConfirmation() { return asArray(state.draft?.needs_confirmation || state.draft?.needsConfirmation).length > 0; }
  function requiresAcknowledgement() {
    if (state.phase !== 'draft' || !state.draft) return false;
    // Drafts always require explicit human review before submit; stronger when parser flags issues.
    return true;
  }

  function canProceedToSubmit() {
    if (state.phase === 'parsing') return false;
    if (state.phase === 'draft' && requiresAcknowledgement()) return !!state.acknowledged;
    return true;
  }

  function emit() {
    if (typeof options.onStateChange === 'function') {
      options.onStateChange({
        ...state,
        hasQuestions: hasQuestions(),
        hasMissing: hasMissing(),
        requiresAcknowledgement: requiresAcknowledgement(),
        canProceedToSubmit: canProceedToSubmit(),
      });
    }
  }

  function wire() {
    const ack = container.querySelector('[data-voice-action="ack"]');
    if (ack) {
      ack.addEventListener('change', (e) => {
        state.acknowledged = !!e.target.checked;
        emit();
      });
    }
  }

  function render() {
    if (state.phase === 'idle') {
      container.classList.add('d-none');
      container.innerHTML = '';
      return;
    }
    container.classList.remove('d-none');

    if (state.phase === 'parsing') {
      container.innerHTML = `
        <div class="card border mt-2" data-voice-panel="1">
          <div class="card-body p-3">
            <div class="d-flex align-items-center gap-2">
              <span class="spinner-border spinner-border-sm text-primary" role="status" aria-hidden="true"></span>
              <div>
                <div class="fw-semibold text-dark">Parsing voice/text draft...</div>
                <div class="text-muted text-xs">Generating a draft suggestion for human review. Nothing is saved.</div>
              </div>
            </div>
            ${state.originalText ? `<div class="mt-2 text-xs text-muted"><strong>Input:</strong> ${esc(state.originalText)}</div>` : ''}
          </div>
        </div>`;
      emit();
      return;
    }

    if (state.phase === 'error') {
      const msg = state.error?.message || 'Voice/text parsing could not be completed.';
      container.innerHTML = `
        <div class="card border border-danger-subtle mt-2" data-voice-panel="1">
          <div class="card-status-top bg-danger"></div>
          <div class="card-body p-3">
            <div class="d-flex align-items-center gap-2 mb-2">
              <span class="badge bg-danger text-white">PARSER ERROR</span>
              <span class="fw-semibold text-dark">Draft could not be generated</span>
            </div>
            <p class="text-muted text-sm mb-2">${esc(msg)}</p>
            <div class="alert alert-warning border py-2 px-3 mb-2">
              <div class="text-sm mb-0">No transaction was created or changed. You can correct the text and parse again, or enter all required details manually in the form below.</div>
            </div>
            ${state.originalText ? `<div class="text-xs text-muted"><strong>Original input:</strong> ${esc(state.originalText)}</div>` : ''}
          </div>
        </div>`;
      emit();
      return;
    }

    // draft
    const d = state.draft || {};
    const fields = d.fields && typeof d.fields === 'object' ? d.fields : {};
    const missing = asArray(d.missing);
    const questions = asArray(d.questions);
    const needsConf = asArray(d.needs_confirmation || d.needsConfirmation);
    const readback = d.readback || d.summary || '';
    const note = d.note || 'Draft only. Nothing is saved until the user reviews and explicitly submits.';
    const source = d.source_text || state.originalText || '';
    const draftOnly = d.draft_only !== false;
    const needsHuman = d.requires_human_confirmation !== false;
    const hasIssues = missing.length > 0 || questions.length > 0 || needsConf.length > 0;

    container.innerHTML = `
      <div class="card border mt-2" data-voice-panel="1">
        <div class="card-status-top bg-warning"></div>
        <div class="card-body p-3">
          <div class="d-flex flex-wrap align-items-start justify-content-between gap-2 mb-2">
            <div>
              <span class="badge bg-warning text-dark me-2">AI DRAFT — NOT VERIFIED</span>
              <span class="fw-semibold text-dark">Voice/text draft review</span>
            </div>
            <div class="d-flex flex-wrap gap-1">
              ${draftOnly ? '<span class="badge bg-white text-dark border">Draft only</span>' : ''}
              ${needsHuman ? '<span class="badge bg-white text-dark border">Human confirmation required</span>' : ''}
            </div>
          </div>

          <div class="alert alert-warning border py-2 px-3 mb-3">
            <div class="text-sm mb-1"><strong>Suggestion only:</strong> Parsed values are assistive and may be incomplete or incorrect. Review and edit the transaction form fields before submitting.</div>
            <div class="text-xs mb-0">${esc(note)} No transaction is created, confirmed, corrected, disputed, or settled by parsing.</div>
          </div>

          <div class="mb-3">
            <div class="text-muted text-xs mb-1">Original voice/text input</div>
            <div class="border rounded p-2 bg-light text-sm">${source ? esc(source) : '<span class="text-muted">Not provided</span>'}</div>
          </div>

          <div class="mb-3">
            <div class="text-muted text-xs mb-1">Parsed transaction fields (suggestions)</div>
            ${renderParsedFields(fields)}
            ${renderConfidence(d.confidence)}
          </div>

          <div class="row g-2 mb-3">
            <div class="col-md-4">
              <div class="border rounded p-2 h-100 ${missing.length ? 'border-danger-subtle' : ''}">
                <div class="fw-semibold text-xs mb-1 ${missing.length ? 'text-danger' : 'text-muted'}">Missing fields ${missing.length ? `<span class="badge bg-danger ms-1">${missing.length}</span>` : ''}</div>
                ${renderList(missing, 'No missing fields reported by parser.', 'danger')}
              </div>
            </div>
            <div class="col-md-4">
              <div class="border rounded p-2 h-100 ${questions.length ? 'border-warning-subtle' : ''}">
                <div class="fw-semibold text-xs mb-1 ${questions.length ? 'text-dark' : 'text-muted'}">Parser questions / ambiguities ${questions.length ? `<span class="badge bg-warning text-dark ms-1">${questions.length}</span>` : ''}</div>
                ${renderList(questions, 'No parser questions.', 'warning')}
              </div>
            </div>
            <div class="col-md-4">
              <div class="border rounded p-2 h-100">
                <div class="fw-semibold text-xs mb-1 text-muted">Needs confirmation ${needsConf.length ? `<span class="badge bg-secondary ms-1">${needsConf.length}</span>` : ''}</div>
                ${renderList(needsConf, 'No additional confirmation flags.', 'muted')}
              </div>
            </div>
          </div>

          <div class="mb-3">
            <div class="text-muted text-xs mb-1">Readback / summary</div>
            <div class="border rounded p-2 bg-white text-sm">${readback ? esc(readback) : '<span class="text-muted">No readback available (draft may be incomplete or ambiguous). Please verify all form fields manually.</span>'}</div>
          </div>

          ${hasIssues ? `
            <div class="alert alert-danger border py-2 px-3 mb-3">
              <div class="text-sm mb-0"><strong>Review required:</strong> Resolve missing/ambiguous information by editing the form fields below. Submission is blocked until genuinely required form fields are complete/valid and you explicitly acknowledge this draft review.</div>
            </div>` : `
            <div class="alert alert-info border py-2 px-3 mb-3">
              <div class="text-sm mb-0"><strong>Review required:</strong> Even when the draft looks complete, verify and edit the form fields below before using the explicit submit action.</div>
            </div>`}

          <div class="border rounded p-2 bg-light">
            <label class="form-check mb-1">
              <input class="form-check-input" type="checkbox" data-voice-action="ack" ${state.acknowledged ? 'checked' : ''}>
              <span class="form-check-label text-sm fw-semibold text-dark">I have reviewed this AI draft, resolved questions/ambiguities as applicable, and verified the editable form fields before submitting.</span>
            </label>
            <div class="text-muted text-xs">This acknowledgement does not create, confirm, correct, dispute, or settle any transaction.</div>
          </div>
        </div>
      </div>`;
    wire();
    emit();
  }

  return {
    setIdle() { state.phase = 'idle'; state.draft = null; state.error = null; state.originalText = ''; state.acknowledged = false; render(); },
    setParsing(originalText = '') { state.phase = 'parsing'; state.originalText = originalText; state.draft = null; state.error = null; state.acknowledged = false; render(); },
    setDraft(draft, originalText = '') { state.phase = 'draft'; state.draft = draft || {}; state.originalText = originalText || draft?.source_text || ''; state.error = null; state.acknowledged = false; render(); },
    setError(error, originalText = '') { state.phase = 'error'; state.error = error || new Error('Parse failed'); state.draft = null; state.originalText = originalText || ''; state.acknowledged = false; render(); },
    getState() {
      return {
        ...state,
        hasQuestions: hasQuestions(),
        hasMissing: hasMissing(),
        requiresAcknowledgement: requiresAcknowledgement(),
        canProceedToSubmit: canProceedToSubmit(),
      };
    },
  };
}
