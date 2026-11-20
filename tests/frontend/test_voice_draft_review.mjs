import assert from 'node:assert/strict';
import { createVoiceDraftReview } from '../../frontend/js/components/voice_draft_review.js';

class El {
  constructor(tag = 'div') {
    this.tag = tag;
    this.innerHTML = '';
    this._classes = new Set();
    this.classList = {
      add: (...xs) => xs.forEach((x) => this._classes.add(x)),
      remove: (...xs) => xs.forEach((x) => this._classes.delete(x)),
      contains: (x) => this._classes.has(x),
    };
    this._listeners = new Map();
    this._overrides = {};
  }
  querySelector(sel) {
    const m = /^\[data-voice-action="([^"]+)"\]$/.exec(sel);
    if (!m) return null;
    const action = m[1];
    const re = new RegExp(`data-voice-action="${action}"`);
    if (!re.test(this.innerHTML)) return null;
    const self = this;
    const el = new El('control');
    if (action === 'ack') {
      const initialChecked = /data-voice-action="ack"[^>]*checked/.test(this.innerHTML);
      Object.defineProperty(el, 'checked', {
        get: () => (self._overrides[`${action}:checked`] !== undefined ? self._overrides[`${action}:checked`] : initialChecked),
        set: (v) => { self._overrides[`${action}:checked`] = !!v; },
      });
      el.addEventListener = (ev, cb) => this._listeners.set(`${ev}:${action}`, cb);
      el.trigger = (ev, eventObj) => this._listeners.get(`${ev}:${action}`)?.(eventObj || { target: el });
    } else {
      const initialDisabled = new RegExp(`data-voice-action="${action}"[^>]*disabled`).test(this.innerHTML);
      Object.defineProperty(el, 'disabled', {
        get: () => (self._overrides[`${action}:disabled`] !== undefined ? self._overrides[`${action}:disabled`] : initialDisabled),
        set: (v) => { self._overrides[`${action}:disabled`] = !!v; },
      });
      el.addEventListener = (ev, cb) => this._listeners.set(`${ev}:${action}`, cb);
      el.trigger = (ev, eventObj) => this._listeners.get(`${ev}:${action}`)?.(eventObj || { target: el });
    }
    return el;
  }
}

function makePanel() {
  const container = new El('div');
  const panel = createVoiceDraftReview(container);
  return { container, panel };
}

// Parsing state: draft-only / no save messaging
{
  const { container, panel } = makePanel();
  panel.setParsing('Ravi ko 50 gram 22 karat');
  assert.match(container.innerHTML, /Parsing voice\/text draft/i);
  assert.match(container.innerHTML, /Nothing is saved/i);
  assert.equal(panel.getState().phase, 'parsing');
}

// Successful draft: original input, parsed fields, missing/questions/readback/confidence (if provided), notices
{
  const { container, panel } = makePanel();
  const draft = {
    kind: 'issue',
    fields: { karigar: 'Ravi Kumar', weight_g: '50', karat: 22 },
    missing: ['order'],
    questions: ['Which order contract should this be linked to?'],
    needs_confirmation: ['karigar'],
    confidence: { weight_g: 0.95, karat: 0.95 },
    readback: 'Issue 50.00 g of 22 karat gold to Ravi Kumar. Is this correct?',
    source_text: 'Ravi ko 50 gram 22 karat sona diya',
    note: 'DRAFT only. Nothing is saved until the user reviews and confirms.',
    draft_only: true,
    requires_human_confirmation: true,
  };
  panel.setDraft(draft, draft.source_text);
  const html = container.innerHTML;
  assert.match(html, /AI DRAFT/i);
  assert.match(html, /Original voice\/text input/i);
  assert.match(html, /Ravi ko 50 gram 22 karat sona diya/);
  assert.match(html, /Parsed transaction fields/i);
  assert.match(html, /Ravi Kumar/);
  assert.match(html, /Missing fields/i);
  assert.match(html, /order/);
  assert.match(html, /Parser questions/i);
  assert.match(html, /Which order contract/);
  assert.match(html, /Readback \/ summary/i);
  assert.match(html, /Is this correct\?/);
  assert.match(html, /Parser confidence/i);
  assert.match(html, /0\.95/);
  assert.match(html, /Draft only/i);
  assert.match(html, /Human confirmation required/i);
  assert.match(html, /No transaction is created, confirmed, corrected, disputed, or settled/i);
  assert.equal(panel.getState().requiresAcknowledgement, true);
  assert.equal(panel.getState().canProceedToSubmit, false);
  const ack = container.querySelector('[data-voice-action="ack"]');
  assert.ok(ack, 'acknowledgement checkbox should be present');
  ack.checked = true;
  ack.trigger('change', { target: ack });
  assert.equal(panel.getState().acknowledged, true);
  assert.equal(panel.getState().canProceedToSubmit, true);
}

// Confidence omitted when not provided
{
  const { container, panel } = makePanel();
  panel.setDraft({ fields: { weight_g: '10' }, missing: [], questions: [], readback: null, draft_only: true });
  assert.doesNotMatch(container.innerHTML, /Parser confidence/i);
}

// Editable-form workflow relies on explicit review gate; missing/question states shown
{
  const { container, panel } = makePanel();
  panel.setDraft({ fields: {}, missing: ['weight_g', 'karat'], questions: ['How many grams?'], readback: null });
  assert.match(container.innerHTML, /weight_g/);
  assert.match(container.innerHTML, /How many grams\?/);
  assert.match(container.innerHTML, /Review required/i);
  assert.equal(panel.getState().hasMissing, true);
  assert.equal(panel.getState().hasQuestions, true);
}

// Parser/API failure state: understandable feedback, manual fallback, no save
{
  const { container, panel } = makePanel();
  panel.setError(new Error('Network error: Failed to fetch'), 'typed draft text');
  const html = container.innerHTML;
  assert.match(html, /PARSER ERROR|Draft could not be generated/i);
  assert.match(html, /Network error/i);
  assert.match(html, /No transaction was created or changed/i);
  assert.match(html, /enter .*details manually|manual entry/i);
  assert.match(html, /typed draft text/);
  assert.equal(panel.getState().phase, 'error');
}

// Manual-entry fallback: idle panel hidden
{
  const { container, panel } = makePanel();
  panel.setIdle();
  assert.equal(panel.getState().phase, 'idle');
  assert.equal(container.innerHTML, '');
  assert.ok(container.classList.contains('d-none'));
}

console.log('voice draft review frontend tests passed');
