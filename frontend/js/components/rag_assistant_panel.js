import { Api } from '../api.js';

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

function normalizeCitations(data) {
  const citations = asArray(data?.citations);
  if (citations.length) {
    return citations.map((c) => {
      if (typeof c === 'string') return { source: c };
      if (c && typeof c === 'object') {
        return {
          source: c.source ?? c.doc_id ?? c.name ?? '',
          chunk_id: c.chunk_id ?? c.chunk ?? c.id ?? null,
          score: c.score ?? null,
          shop_id: c.shop_id ?? null,
        };
      }
      return { source: String(c ?? '') };
    }).filter((c) => c.source || c.chunk_id != null);
  }
  const sources = asArray(data?.sources);
  return sources
    .filter((s) => s !== null && s !== undefined && String(s).trim() !== '')
    .map((s) => ({ source: String(s), chunk_id: null, score: null, shop_id: null }));
}

function userErrorMessage(err) {
  const status = err?.status;
  const detail = typeof err?.details?.detail === 'string' ? err.details.detail : (typeof err?.message === 'string' ? err.message : '');
  if (status === 503) return 'The policy assistant is temporarily unavailable. Please try again in a moment.';
  if (status === 401) return 'Your session is no longer valid. Please sign in again.';
  if (status === 422) return detail && detail.length < 160 ? detail : 'Please enter a valid question (3 to 1000 characters).';
  if (status === 400) return detail && detail.length < 160 ? detail : 'The question could not be processed. Please revise and try again.';
  if (status === 0 || /network/i.test(detail)) return 'Network connection issue. Check your connection and try again.';
  return 'Unable to retrieve a policy response right now. Please try again.';
}

export function createRagAssistantPanel(container, options = {}) {
  const queryFn = typeof options.queryFn === 'function' ? options.queryFn : (q) => Api.queryAI(q);
  const state = {
    phase: 'idle', // idle | loading | success | error
    question: '',
    lastSubmittedQuestion: '',
    response: null,
    error: null,
  };

  function emit() {
    if (typeof options.onStateChange === 'function') options.onStateChange({ ...state });
  }

  function renderQuestionBlock(q, label = 'Question') {
    if (!q) return '';
    return `
      <div class="mb-3">
        <div class="text-muted text-xs mb-1">${esc(label)}</div>
        <div class="border rounded p-2 bg-white text-sm">${esc(q)}</div>
      </div>`;
  }

  function renderCitations(data) {
    const citations = normalizeCitations(data);
    if (!citations.length) {
      return `<div class="text-xs text-muted"><em>No source references were returned for this response.</em></div>`;
    }
    return `
      <div class="text-xs text-muted mb-1"><strong>Source references / citations</strong></div>
      <ul class="mb-0 ps-3 text-xs">
        ${citations.map((c) => {
          const parts = [];
          if (c.source) parts.push(`<span class="fw-semibold text-dark">${esc(c.source)}</span>`);
          if (c.chunk_id !== null && c.chunk_id !== undefined && c.chunk_id !== '') parts.push(`chunk <span class="font-monospace">${esc(c.chunk_id)}</span>`);
          if (c.score !== null && c.score !== undefined && c.score !== '') parts.push(`score <span class="font-monospace">${esc(c.score)}</span>`);
          return `<li class="mb-1">${parts.join(' · ') || '<span class="text-muted">Reference unavailable</span>'}</li>`;
        }).join('')}
      </ul>`;
  }

  function renderSuccess() {
    const data = (state.response && typeof state.response === 'object') ? state.response : {};
    const answerRaw = data.answer;
    const hasAnswer = typeof answerRaw === 'string' ? answerRaw.trim().length > 0 : (answerRaw !== null && answerRaw !== undefined);
    const answer = hasAnswer ? String(answerRaw) : 'No answer text was returned.';
    const grounded = data.grounded === true;
    const injection = data.injection_detected === true;
    const note = typeof data.note === 'string' ? data.note : '';
    const citations = normalizeCitations(data);
    const insufficient = !grounded || !hasAnswer;

    return `
      <div class="card border mt-3" data-rag-panel="1">
        <div class="card-status-top bg-${insufficient ? 'warning' : 'primary'}"></div>
        <div class="card-body p-3 p-md-4">
          <div class="d-flex flex-wrap align-items-start justify-content-between gap-2 mb-2">
            <div>
              <span class="badge ${insufficient ? 'bg-warning text-dark' : 'bg-primary text-white'} me-2">${insufficient ? 'Insufficient / Ungrounded' : 'Grounded guidance'}</span>
              <span class="fw-semibold text-dark">Policy assistant response</span>
            </div>
            <div class="d-flex flex-wrap gap-1">
              ${injection ? '<span class="badge bg-warning-lt text-warning border border-warning-subtle">Adversarial content neutralized</span>' : ''}
              ${grounded ? '<span class="badge bg-success-lt text-success border border-success-subtle">Grounded: yes</span>' : '<span class="badge bg-secondary-lt text-secondary border">Grounded: no</span>'}
            </div>
          </div>

          ${renderQuestionBlock(state.lastSubmittedQuestion)}

          <div class="mb-3">
            <div class="text-muted text-xs mb-1">Answer (informational)</div>
            <div class="border rounded p-3 bg-light text-sm text-dark" style="white-space: pre-wrap;">${esc(answer)}</div>
          </div>

          ${insufficient ? `
            <div class="alert alert-warning border py-2 px-3 mb-3">
              <div class="text-sm mb-0">The assistant could not provide a sufficiently grounded answer from available documentation. Treat this as informational guidance only and consult authorised procedures or staff if needed.</div>
            </div>` : ''}

          ${note ? `
            <div class="alert alert-secondary border py-2 px-3 mb-3">
              <div class="text-xs mb-0"><strong>Notice:</strong> ${esc(note)}</div>
            </div>` : `
            <div class="alert alert-secondary border py-2 px-3 mb-3">
              <div class="text-xs mb-0"><strong>Notice:</strong> Informational guidance only. This assistant cannot confirm transactions, approve weighments, correct records, resolve disputes, or authorise/execute settlements.</div>
            </div>`}

          <div class="border rounded p-2 bg-white">
            ${renderCitations(data)}
          </div>

          <div class="d-flex flex-wrap gap-2 mt-3">
            <button type="button" class="btn btn-outline-primary btn-sm" data-rag-action="retry">Ask again / retry</button>
            <button type="button" class="btn btn-outline-secondary btn-sm" data-rag-action="clear">Clear response</button>
          </div>
        </div>
      </div>`;
  }

  function renderError() {
    const msg = userErrorMessage(state.error);
    return `
      <div class="card border border-danger-subtle mt-3" data-rag-panel="1">
        <div class="card-status-top bg-danger"></div>
        <div class="card-body p-3 p-md-4">
          <div class="d-flex align-items-center gap-2 mb-2">
            <span class="badge bg-danger text-white">REQUEST ERROR</span>
            <span class="fw-semibold text-dark">Could not retrieve policy guidance</span>
          </div>
          ${renderQuestionBlock(state.lastSubmittedQuestion)}
          <div class="alert alert-danger border py-2 px-3 mb-3">
            <div class="text-sm mb-0">${esc(msg)}</div>
          </div>
          <div class="text-xs text-muted mb-3">No financial action was taken. You can retry the same question or ask a different one.</div>
          <div class="d-flex flex-wrap gap-2">
            <button type="button" class="btn btn-primary btn-sm" data-rag-action="retry">Retry</button>
            <button type="button" class="btn btn-outline-secondary btn-sm" data-rag-action="clear">Clear</button>
          </div>
        </div>
      </div>`;
  }

  function wire() {
    const form = container.querySelector('[data-rag-form="1"]');
    const input = container.querySelector('[data-rag-input="1"]');
    const submitBtn = container.querySelector('[data-rag-submit="1"]');
    if (form && !form.dataset.bound) {
      form.dataset.bound = '1';
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const q = String(input?.value ?? '').trim();
        await submit(q);
      });
    }
    container.querySelectorAll('[data-rag-action="retry"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const q = state.lastSubmittedQuestion || String(input?.value ?? '').trim();
        if (input && state.lastSubmittedQuestion) input.value = state.lastSubmittedQuestion;
        await submit(q);
      });
    });
    container.querySelectorAll('[data-rag-action="clear"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.phase = 'idle';
        state.response = null;
        state.error = null;
        state.lastSubmittedQuestion = '';
        render();
      });
    });
    // keep input value synced for convenience
    if (input && !input.dataset.bound) {
      input.dataset.bound = '1';
      input.addEventListener('input', () => { state.question = input.value; });
    }
    // avoid double-bind on rerender: mark bound elements and rely on full rerender resetting innerHTML
    if (submitBtn) submitBtn.disabled = state.phase === 'loading';
  }

  async function submit(question) {
    const q = String(question ?? '').trim();
    const input = container.querySelector('[data-rag-input="1"]');
    if (!q) {
      state.phase = 'error';
      state.error = { status: 422, message: 'Please enter a question before submitting.' };
      state.lastSubmittedQuestion = '';
      state.response = null;
      render();
      input?.focus();
      return;
    }
    if (q.length > 1000) {
      state.phase = 'error';
      state.error = { status: 422, message: 'Questions must be 1000 characters or fewer.' };
      state.lastSubmittedQuestion = q;
      state.response = null;
      render();
      return;
    }
    state.phase = 'loading';
    state.lastSubmittedQuestion = q;
    state.error = null;
    state.response = null;
    render();
    try {
      const data = await queryFn(q);
      // handle unexpected formats safely
      state.response = (data && typeof data === 'object') ? data : { answer: String(data ?? ''), sources: [], citations: [], grounded: false, injection_detected: false, note: '' };
      if (typeof state.response.answer !== 'string') {
        state.response = { ...state.response, answer: state.response.answer == null ? '' : String(state.response.answer) };
      }
      if (!Array.isArray(state.response.sources) && !Array.isArray(state.response.citations)) {
        state.response = { ...state.response, sources: [], citations: [] };
      }
      state.phase = 'success';
    } catch (err) {
      state.error = err || new Error('Request failed');
      state.phase = 'error';
    }
    render();
  }

  function render() {
    const loading = state.phase === 'loading';
    const qVal = esc(state.question || state.lastSubmittedQuestion || '');
    const submitLabel = loading
      ? '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Searching policies...'
      : '<svg class="icon me-1" width="18" height="18" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><circle cx="10" cy="10" r="7"/><line x1="21" y1="21" x2="15" y2="15"/></svg>Ask Assistant';

    container.innerHTML = `
      <div class="rag-assistant" data-rag-root="1">
        <div class="alert alert-info border py-2 px-3 mb-3">
          <div class="text-sm mb-1"><strong>Informational policy assistant</strong> — grounded in indexed SUCCESSION documentation (global-only).</div>
          <div class="text-xs mb-0">It cannot confirm transactions, approve weighments, correct financial records, resolve disputes, or authorise/execute settlements.</div>
        </div>

        <form data-rag-form="1" class="mb-0">
          <label class="form-label text-muted text-xs mb-1" for="rag-question-input">Ask a policy or workflow question</label>
          <div class="input-group">
            <input id="rag-question-input" data-rag-input="1" type="text" class="form-control" maxlength="1000" placeholder="e.g. How are gold disputes handled? What is the settlement approval process?" value="${qVal}" autocomplete="off" ${loading ? 'disabled' : ''}>
            <button type="submit" data-rag-submit="1" class="btn btn-primary" ${loading ? 'disabled' : ''}>${submitLabel}</button>
          </div>
          <div class="text-muted text-xs mt-2">Responses may be grounded excerpts or generated summaries from retrieved documentation. Citations/source references are shown when provided. Backend tenant scope and protections remain enforced server-side.</div>
        </form>

        ${state.phase === 'success' ? renderSuccess() : ''}
        ${state.phase === 'error' ? renderError() : ''}
      </div>`;
    wire();
    emit();
  }

  render();
  return {
    submit,
    getState() { return { ...state, citations: normalizeCitations(state.response) }; },
    setQuestion(q) { state.question = String(q ?? ''); render(); },
  };
}
