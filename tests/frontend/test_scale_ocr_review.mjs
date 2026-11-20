import assert from 'node:assert/strict';
import { createScaleOcrReview } from '../../frontend/js/components/scale_ocr_review.js';

class El {
  constructor(tag = 'div') {
    this.tag = tag;
    this.children = [];
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
    // Minimal selector support for data-ocr-action used by component.
    const m = /^\[data-ocr-action="([^"]+)"\]$/.exec(sel);
    if (!m) return null;
    const action = m[1];
    const re = new RegExp(`data-ocr-action="${action}"`);
    if (!re.test(this.innerHTML)) return null;
    const self = this;
    const el = new El('control');
    if (action === 'ack') {
      el.type = 'checkbox';
      let checked = /data-ocr-action="ack"[^>]*checked/.test(this.innerHTML);
      if (self._overrides[`${action}:checked`] !== undefined) checked = self._overrides[`${action}:checked`];
      Object.defineProperty(el, 'checked', {
        get: () => checked,
        set: (v) => { checked = !!v; self._overrides[`${action}:checked`] = checked; },
      });
      el.addEventListener = (ev, cb) => this._listeners.set(`${ev}:${action}`, cb);
      el.trigger = (ev, eventObj) => this._listeners.get(`${ev}:${action}`)?.(eventObj || { target: el });
    } else {
      const initialDisabled = new RegExp(`data-ocr-action="${action}"[^>]*disabled`).test(this.innerHTML);
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
  let continued = 0;
  let retried = 0;
  const panel = createScaleOcrReview(container, {
    onContinue: () => { continued += 1; },
    onRetry: () => { retried += 1; },
  });
  return { container, panel, get continued() { return continued; }, get retried() { return retried; } };
}

// MATCH: assistive, no acknowledgement required, continue enabled.
{
  const { container, panel } = makePanel();
  panel.setResult({
    evidenceId: 1, ocrReadingG: '50.0000', enteredG: '50.0000', status: 'MATCH',
    needsManualConfirm: false, disclaimer: 'SIMPLIFIED reading. Assistive only.'
  }, { enteredWeight: '50.0000', fileName: 'scale.png' });
  const html = container.innerHTML;
  assert.match(html, /MATCH/);
  assert.match(html, /50\.0000 g/);
  assert.match(html, /assistive/i);
  assert.match(html, /SIMPLIFIED reading/);
  assert.doesNotMatch(html, /Manual review acknowledgement \(required\)/);
  assert.equal(panel.getState().canContinue, true);
  assert.equal(panel.getState().needsReview, false);
  const cont = container.querySelector('[data-ocr-action="continue"]');
  assert.ok(cont && cont.disabled === false);
}

// MISMATCH: shows both values, requires acknowledgement, no auto-correction implied.
{
  const { container, panel, continued } = makePanel();
  panel.setResult({
    evidenceId: 2, ocrReadingG: '49.8500', enteredG: '50.0000', status: 'MISMATCH',
    needsManualConfirm: true, disclaimer: 'SIMPLIFIED reading.'
  }, { enteredWeight: '50.0000' });
  const html = container.innerHTML;
  assert.match(html, /MISMATCH/);
  assert.match(html, /49\.8500/);
  assert.match(html, /50\.0000/);
  assert.match(html, /not changed automatically|not be replaced automatically/i);
  assert.match(html, /Manual review acknowledgement \(required\)/);
  assert.equal(panel.getState().canContinue, false);
  const ack = container.querySelector('[data-ocr-action="ack"]');
  const cont = container.querySelector('[data-ocr-action="continue"]');
  assert.ok(ack && cont);
  assert.equal(cont.disabled, true);
  ack.checked = true;
  ack.trigger('change', { target: ack });
  assert.equal(panel.getState().acknowledged, true);
  assert.equal(panel.getState().canContinue, true);
  assert.equal(cont.disabled, false);
}

// UNREADABLE: missing OCR reading, no guessed value, retry + acknowledgement.
{
  const ctx = makePanel();
  ctx.panel.setResult({
    evidenceId: 3, ocrReadingG: null, enteredG: '50.0000', status: 'UNREADABLE',
    needsManualConfirm: true, disclaimer: 'SIMPLIFIED reading.'
  }, { enteredWeight: '50.0000' });
  const html = ctx.container.innerHTML;
  assert.match(html, /UNREADABLE/);
  assert.match(html, /OCR-detected weight/);
  assert.match(html, /Not available/);
  assert.match(html, /No OCR reading is available|not be reliably read/i); // explicit, no invented value
  assert.match(html, /Retry upload/);
  assert.match(html, /Manual review acknowledgement \(required\)/);
  assert.equal(ctx.panel.getState().canContinue, false);
  const retry = ctx.container.querySelector('[data-ocr-action="retry"]');
  assert.ok(retry);
  retry.trigger('click');
  assert.equal(ctx.retried, 1);
  const ack = ctx.container.querySelector('[data-ocr-action="ack"]');
  ack.checked = true;
  ack.trigger('change', { target: ack });
  assert.equal(ctx.panel.getState().canContinue, true);
}

// API/upload failure: understandable error, retry allowed, acknowledgement required to continue.
{
  const ctx = makePanel();
  ctx.panel.setError(new Error('Network error: Failed to fetch'), { enteredWeight: '50.0000', fileName: 'x.png' });
  const html = ctx.container.innerHTML;
  assert.match(html, /UPLOAD\/API ERROR|could not be completed/i);
  assert.match(html, /Network error/);
  assert.match(html, /Retry upload/);
  assert.match(html, /transaction record .* unchanged|unchanged by this review step/i);
  assert.match(html, /Manual review acknowledgement \(required\)/);
  assert.equal(ctx.panel.getState().needsReview, true);
  assert.equal(ctx.panel.getState().canContinue, false);
  const retry = ctx.container.querySelector('[data-ocr-action="retry"]');
  retry.trigger('click');
  assert.equal(ctx.retried, 1);
  const ack = ctx.container.querySelector('[data-ocr-action="ack"]');
  ack.checked = true;
  ack.trigger('change', { target: ack });
  assert.equal(ctx.panel.getState().canContinue, true);
}

// Missing OCR reading display safety (empty string/undefined treated as unavailable)
{
  const { container, panel } = makePanel();
  panel.setResult({ status: 'UNREADABLE', needsManualConfirm: true, ocrReadingG: '', enteredG: '10.0000', disclaimer: 'd' });
  assert.match(container.innerHTML, /Not available/);
}

console.log('scale OCR review frontend tests passed');