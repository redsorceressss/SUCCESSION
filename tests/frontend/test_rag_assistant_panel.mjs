import assert from 'node:assert/strict';
import { createRagAssistantPanel } from '../../frontend/js/components/rag_assistant_panel.js';

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
    this.dataset = {};
  }
  querySelector(sel) {
    // Support [data-rag-action="..."], [data-rag-form="1"], [data-rag-input="1"], [data-rag-submit="1"]
    const actionM = /^\[data-rag-action="([^"]+)"\]$/.exec(sel);
    if (actionM) {
      const action = actionM[1];
      if (!new RegExp(`data-rag-action="${action}"`).test(this.innerHTML)) return null;
      const el = new El('button');
      el.addEventListener = (ev, cb) => this._listeners.set(`${ev}:action:${action}`, cb);
      el.trigger = (ev, eobj) => this._listeners.get(`${ev}:action:${action}`)?.(eobj || {});
      return el;
    }
    const formM = /^\[data-rag-form="1"\]$/.exec(sel);
    if (formM) {
      if (!/data-rag-form="1"/.test(this.innerHTML)) return null;
      const el = new El('form');
      el.addEventListener = (ev, cb) => { this._listeners.set(`${ev}:form`, cb); };
      el.trigger = (ev, eobj) => this._listeners.get(`${ev}:form`)?.(eobj || { preventDefault(){} });
      return el;
    }
    const inputM = /^\[data-rag-input="1"\]$/.exec(sel);
    if (inputM) {
      if (!/data-rag-input="1"/.test(this.innerHTML)) return null;
      const el = new El('input');
      const m = /data-rag-input="1"[^>]*value="([^"]*)"/.exec(this.innerHTML);
      el.value = m ? m[1].replace(/&quot;/g,'"').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&') : '';
      el.addEventListener = (ev, cb) => this._listeners.set(`${ev}:input`, cb);
      el.focus = () => { el._focused = true; };
      return el;
    }
    const submitM = /^\[data-rag-submit="1"\]$/.exec(sel);
    if (submitM) {
      if (!/data-rag-submit="1"/.test(this.innerHTML)) return null;
      const el = new El('button');
      el.disabled = /data-rag-submit="1"[^>]*disabled/.test(this.innerHTML);
      return el;
    }
    return null;
  }
  querySelectorAll(sel) {
    const actionM = /^\[data-rag-action="([^"]+)"\]$/.exec(sel);
    if (!actionM) return [];
    const action = actionM[1];
    const re = new RegExp(`data-rag-action="${action}"`, 'g');
    const count = (this.innerHTML.match(re) || []).length;
    return Array.from({length: count}, () => this.querySelector(sel)).filter(Boolean);
  }
}

function tick() { return new Promise((r) => setTimeout(r, 0)); }

// Successful submission: answer + citations/sources rendered, no fabricated confidence
{
  const calls = [];
  const container = new El('div');
  const panel = createRagAssistantPanel(container, {
    queryFn: async (q) => {
      calls.push(q);
      return {
        question: q,
        answer: 'Disputes require evidence and review.',
        sources: ['dispute_policy.md'],
        citations: [{ source: 'dispute_policy.md', chunk_id: 2, score: 1.23, shop_id: null }],
        grounded: true,
        injection_detected: false,
        note: 'This assistant explains policies and procedures only. It cannot approve, modify, or confirm any financial record.'
      };
    }
  });
  await panel.submit('How are disputes handled?');
  await tick();
  const html = container.innerHTML;
  assert.deepEqual(calls, ['How are disputes handled?']);
  assert.match(html, /Disputes require evidence and review\./);
  assert.match(html, /dispute_policy\.md/);
  assert.match(html, /chunk/);
  assert.match(html, /1\.23/);
  assert.match(html, /Grounded: yes/);
  assert.match(html, /cannot confirm transactions|cannot approve, modify, or confirm/i);
  assert.doesNotMatch(html, /confidence score|Confidence:/i); // no fabricated confidence
  assert.equal(panel.getState().phase, 'success');
}

// Missing citations/sources: show explicit "no source references" (not fabricated)
{
  const container = new El('div');
  const panel = createRagAssistantPanel(container, {
    queryFn: async () => ({ answer: 'General guidance.', sources: [], citations: [], grounded: true, injection_detected: false, note: 'Informational only.' })
  });
  await panel.submit('Tell me something');
  assert.match(container.innerHTML, /No source references were returned/i);
  assert.doesNotMatch(container.innerHTML, /chunk <span/i);
}

// Abstention / insufficient information
{
  const container = new El('div');
  const panel = createRagAssistantPanel(container, {
    queryFn: async () => ({ answer: 'No relevant operational documentation found for your query.', sources: [], citations: [], grounded: false, injection_detected: false, note: 'Informational only.' })
  });
  await panel.submit('Unknown topic');
  const html = container.innerHTML;
  assert.match(html, /Insufficient \/ Ungrounded|Grounded: no/i);
  assert.match(html, /could not provide a sufficiently grounded answer/i);
  assert.match(html, /No relevant operational documentation/i);
}

// Empty question validation (no API call)
{
  let called = 0;
  const container = new El('div');
  const panel = createRagAssistantPanel(container, { queryFn: async () => { called++; return {}; } });
  await panel.submit('   ');
  assert.equal(called, 0);
  assert.equal(panel.getState().phase, 'error');
  assert.match(container.innerHTML, /enter a question|valid question/i);
}

// Network/API failure + retry behavior
{
  let calls = 0;
  const container = new El('div');
  const panel = createRagAssistantPanel(container, {
    queryFn: async (q) => {
      calls++;
      if (calls === 1) {
        const e = new Error('Network error: Failed to fetch');
        e.status = 0;
        throw e;
      }
      return { answer: 'Recovered answer', sources: ['policy.md'], citations: [], grounded: true, injection_detected: false, note: 'ok' };
    }
  });
  await panel.submit('What is settlement?');
  assert.equal(panel.getState().phase, 'error');
  assert.match(container.innerHTML, /Network connection issue|Could not retrieve/i);
  assert.match(container.innerHTML, /No financial action was taken/i);
  const retry = container.querySelector('[data-rag-action="retry"]');
  assert.ok(retry, 'retry button should exist');
  // simulate click by invoking submit with same question (equivalent to retry handler)
  await panel.submit(panel.getState().lastSubmittedQuestion);
  assert.equal(calls, 2);
  assert.equal(panel.getState().phase, 'success');
  assert.match(container.innerHTML, /Recovered answer/);
}

// 503 unavailable handling
{
  const container = new El('div');
  const panel = createRagAssistantPanel(container, {
    queryFn: async () => { const e = new Error('Policy assistant temporarily unavailable.'); e.status = 503; throw e; }
  });
  await panel.submit('Hello');
  assert.match(container.innerHTML, /temporarily unavailable/i);
}

// Unexpected response format handled safely (no fabricated sources)
{
  const container = new El('div');
  const panel = createRagAssistantPanel(container, { queryFn: async () => 'plain text' });
  await panel.submit('test');
  assert.equal(panel.getState().phase, 'success');
  assert.match(container.innerHTML, /plain text/);
  assert.match(container.innerHTML, /No source references were returned|Grounded: no/i);
}

// Informational-only / no financial actions exposed
{
  const container = new El('div');
  const panel = createRagAssistantPanel(container, { queryFn: async () => ({ answer: 'ok', sources: [], citations: [], grounded: true, injection_detected: false, note: '' }) });
  await panel.submit('policy');
  const html = container.innerHTML;
  assert.match(html, /Informational policy assistant/i);
  assert.match(html, /cannot confirm transactions|cannot .* approve weighments|cannot .* correct financial records|resolve disputes|authorise\/execute settlements/i);
  assert.doesNotMatch(html, /<button[^>]*>\s*Approve/i);
  assert.doesNotMatch(html, /<button[^>]*>\s*Reject/i);
  assert.doesNotMatch(html, /<button[^>]*>\s*Settle/i);
  assert.doesNotMatch(html, /data-action="(approve|reject|settle|resolve|confirm)"/i);
}

console.log('rag assistant panel frontend tests passed');
