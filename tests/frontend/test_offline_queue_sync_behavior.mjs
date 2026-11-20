import assert from 'assert/strict';

// Minimal browser globals
if (!globalThis.window) globalThis.window = globalThis;
try { globalThis.navigator = { onLine: true }; } catch { Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true }); }
if (!globalThis.structuredClone) globalThis.structuredClone = (v) => JSON.parse(JSON.stringify(v));
if (!globalThis.crypto?.subtle) {
  const { webcrypto } = await import('crypto');
  globalThis.crypto = webcrypto;
}
if (!globalThis.TextEncoder) {
  const { TextEncoder } = await import('util');
  globalThis.TextEncoder = TextEncoder;
}

// Minimal in-memory IndexedDB mock sufficient for frontend/js/offline/db.js usage
function createFakeIndexedDB() {
  const dbs = new Map();
  class FakeRequest {
    constructor() { this.onsuccess = null; this.onerror = null; this.onupgradeneeded = null; this.result = null; this.error = null; }
    succeed(result) { this.result = result; queueMicrotask(() => this.onsuccess && this.onsuccess({ target: this })); }
    fail(err) { this.error = err; queueMicrotask(() => this.onerror && this.onerror({ target: this })); }
  }
  class FakeObjectStore {
    constructor(map) { this.map = map; this.keyPath = 'id'; }
    createIndex() {}
    put(value) { const req = new FakeRequest(); const key = value[this.keyPath] ?? (this.map.size + 1); if (value[this.keyPath] == null) value[this.keyPath] = key; this.map.set(key, structuredClone(value)); req.succeed(key); return req; }
    get(id) { const req = new FakeRequest(); const v = this.map.get(id); req.succeed(v ? structuredClone(v) : undefined); return req; }
    getAll() { const req = new FakeRequest(); req.succeed([...this.map.values()].map(v => structuredClone(v))); return req; }
    delete(id) { const req = new FakeRequest(); this.map.delete(id); req.succeed(undefined); return req; }
    clear() { const req = new FakeRequest(); this.map.clear(); req.succeed(undefined); return req; }
    index() { return { getAll: () => { const req = new FakeRequest(); req.succeed([]); return req; } }; }
  }
  class FakeTransaction {
    constructor(stores) { this.stores = stores; this.oncomplete = null; this.onerror = null; }
    objectStore(name) { return this.stores[name]; }
    done() { queueMicrotask(() => this.oncomplete && this.oncomplete()); }
  }
  class FakeDB {
    constructor() { this.version = 0; this.objectStoreNames = { contains: (n) => !!this.stores[n] }; this.storeMaps = {}; this.stores = {}; }
    createObjectStore(name, opts) { this.storeMaps[name] = new Map(); const os = new FakeObjectStore(this.storeMaps[name]); os.keyPath = opts?.keyPath || 'id'; this.stores[name] = os; this.objectStoreNames[name] = true; return os; }
    transaction(name) { const names = Array.isArray(name) ? name : [name]; const txStores = {}; for (const n of names) txStores[n] = this.stores[n]; const tx = new FakeTransaction(txStores); queueMicrotask(() => tx.done()); return tx; }
    close() {}
  }
  return {
    open(name, version) {
      const req = new FakeRequest();
      queueMicrotask(() => {
        let db = dbs.get(name);
        const isNew = !db || (version && version > db.version);
        if (!db) { db = new FakeDB(); dbs.set(name, db); }
        req.result = db;
        if (isNew) {
          db.version = version;
          if (req.onupgradeneeded) req.onupgradeneeded({ target: req });
        }
        req.succeed(db);
      });
      return req;
    },
    _dbs: dbs,
  };
}

globalThis.indexedDB = createFakeIndexedDB();

const queue = await import('../../frontend/js/offline/queue.js');
const sync = await import('../../frontend/js/offline/sync.js');
const db = await import('../../frontend/js/offline/db.js');

function ok(cond, msg) { assert.ok(cond, msg); }
function eq(a,b,msg){ assert.equal(a,b,msg); }

async function resetDB() {
  const all = await queue.getAllOps();
  for (const op of all) await queue.removeOp(op.id);
  const fake = globalThis.indexedDB._dbs.get('succession_offline_v1');
  if (fake?.storeMaps?.sync_log) fake.storeMaps.sync_log.clear();
}

const realNow = Date.now;
let passed = 0; let failed = 0;
async function test(name, fn) {
  try { await resetDB(); Date.now = realNow; await fn(); console.log('PASS', name); passed++; }
  catch (e) { console.error('FAIL', name); console.error(e); failed++; }
  finally { Date.now = realNow; }
}

const baseTx = (kind='tx_issue') => ({ endpoint: kind === 'tx_return' ? '/transactions/return' : '/transactions/issue', method:'POST', payload:{order_id:1, weight_g:'1.0000', karat:22, scrap_g:'0.0000', note:'n', client_id:null}, kind });

await test('PENDING operations are returned for automatic replay; CONFLICT/FAILED/AUTH_REQUIRED excluded', async () => {
  const p = await queue.enqueueOp(baseTx());
  const c = await queue.enqueueOp(baseTx()); await queue.updateOpStatus(c.id,'CONFLICT','conflict', {clearNextAttemptAt:true});
  const f = await queue.enqueueOp(baseTx()); await queue.updateOpStatus(f.id,'FAILED','fail', {clearNextAttemptAt:true});
  const a = await queue.enqueueOp(baseTx()); await queue.updateOpStatus(a.id,'AUTH_REQUIRED','auth', {clearNextAttemptAt:true});
  const auto = await queue.getPendingOps();
  eq(auto.length, 1); eq(auto[0].id, p.id);
  const summary = await queue.getQueueSummary();
  eq(summary.autoReplayable,1); eq(summary.conflict,1); eq(summary.failed,1); eq(summary.authRequired,1); eq(summary.attention,3);
});

await test('CONFLICT remains unchanged after sync (no auto replay)', async () => {
  const op = await queue.enqueueOp(baseTx());
  await queue.updateOpStatus(op.id, 'CONFLICT', 'existing conflict', {clearNextAttemptAt:true});
  let called = 0;
  const res = await sync.syncQueue(async () => { called++; return {}; });
  eq(called, 0);
  const all = await queue.getAllOps();
  eq(all.length, 1); eq(all[0].status, 'CONFLICT'); eq(all[0].lastError, 'existing conflict');
  eq(all[0].payload.client_id, all[0].id);
  ok(res.summary.conflict === 1);
});

await test('FAILED retained and excluded from auto replay', async () => {
  const op = await queue.enqueueOp(baseTx());
  await queue.updateOpStatus(op.id, 'FAILED', 'permanent', {clearNextAttemptAt:true});
  let called=0;
  await sync.syncQueue(async ()=>{called++; return {};});
  eq(called,0);
  eq((await queue.getAllOps())[0].status,'FAILED');
});

await test('AUTH_REQUIRED retained/excluded and 401 pauses sync without deleting operation', async () => {
  await queue.enqueueOp(baseTx('tx_issue'));
  await queue.enqueueOp(baseTx('tx_return'));
  let calls=0;
  const res = await sync.syncQueue(async () => { calls++; const e = new Error('Session expired'); e.status=401; throw e; });
  eq(calls,1); eq(res.status,'auth_required');
  const statuses = (await queue.getAllOps()).map(o=>o.status).sort();
  ok(statuses.includes('AUTH_REQUIRED')); ok(statuses.includes('PENDING'));
});

await test('403 authorization failure is not classified as AUTH_REQUIRED recovery state', async () => {
  await queue.enqueueOp(baseTx());
  await sync.syncQueue(async () => { const e = new Error('Forbidden'); e.status=403; throw e; });
  const all = await queue.getAllOps();
  eq(all[0].status,'FAILED');
  ok(String(all[0].lastError).includes('Forbidden'));
});

await test('clearCompleted cannot delete unresolved operations', async () => {
  await queue.enqueueOp(baseTx());
  const c = await queue.enqueueOp(baseTx()); await queue.updateOpStatus(c.id,'CONFLICT','x', {clearNextAttemptAt:true});
  const f = await queue.enqueueOp(baseTx()); await queue.updateOpStatus(f.id,'FAILED','x', {clearNextAttemptAt:true});
  const a = await queue.enqueueOp(baseTx()); await queue.updateOpStatus(a.id,'AUTH_REQUIRED','x', {clearNextAttemptAt:true});
  const removed = await queue.clearCompleted();
  eq(removed,0);
  eq((await queue.getAllOps()).length,4);
});

await test('resumeAuthRequiredOps is dedicated AUTH_REQUIRED recovery and does not affect other statuses', async () => {
  const p = await queue.enqueueOp(baseTx());
  const c = await queue.enqueueOp(baseTx()); await queue.updateOpStatus(c.id,'CONFLICT','conflict', {clearNextAttemptAt:true});
  const f = await queue.enqueueOp(baseTx()); await queue.updateOpStatus(f.id,'FAILED','failed', {clearNextAttemptAt:true});
  const a = await queue.enqueueOp(baseTx()); await queue.updateOpStatus(a.id,'AUTH_REQUIRED','auth', {clearNextAttemptAt:true});
  const before = new Map((await queue.getAllOps()).map(o => [o.id, structuredClone(o)]));
  const resumed = await queue.resumeAuthRequiredOps();
  eq(resumed, 1);
  const after = new Map((await queue.getAllOps()).map(o => [o.id, o]));
  eq(after.get(a.id).status, 'PENDING');
  eq(after.get(a.id).payload.client_id, before.get(a.id).payload.client_id);
  eq(after.get(a.id).payload._offline_op_id, before.get(a.id).payload._offline_op_id);
  eq(after.get(a.id).hash, before.get(a.id).hash);
  eq(after.get(p.id).status, 'PENDING');
  eq(after.get(c.id).status, 'CONFLICT');
  eq(after.get(f.id).status, 'FAILED');
  ok(!('nextAttemptAt' in after.get(a.id)));
});

await test('RETRYING operations are handled by auto replay policy when eligible', async () => {
  const op = await queue.enqueueOp(baseTx());
  await queue.updateOpStatus(op.id,'RETRYING','temp', {incrementRetry:true, clearNextAttemptAt:true});
  let called=0;
  await sync.syncQueue(async ()=>{called++; return {id: 99};});
  eq(called,1);
  eq((await queue.getAllOps()).length,0);
});

await test('transient failure schedules future retry and retry before nextAttemptAt is excluded', async () => {
  Date.now = () => 1000000;
  await queue.enqueueOp(baseTx());
  const apiReq = async () => { const e = new Error('Network down'); e.status=0; throw e; };
  await sync.syncQueue(apiReq);
  let all = await queue.getAllOps();
  eq(all.length,1); eq(all[0].status,'RETRYING'); eq(all[0].retries,1);
  ok(all[0].nextAttemptAt);
  const nextMs = Date.parse(all[0].nextAttemptAt);
  ok(nextMs > 1000000);
  eq((await queue.getPendingOps(1000000 + 1000)).length, 0); // before deadline excluded
  eq((await queue.getPendingOps(nextMs - 1)).length, 0);
  eq((await queue.getPendingOps(nextMs)).length, 1); // eligible at/after
  eq((await queue.getPendingOps(nextMs + 1)).length, 1);
});

await test('repeated sync attempts before retry deadline do not increase retry count', async () => {
  Date.now = () => 2000000;
  await queue.enqueueOp(baseTx());
  const apiReq = async () => { const e = new Error('Network down'); e.status=0; throw e; };
  await sync.syncQueue(apiReq); // schedules retry
  let op = (await queue.getAllOps())[0];
  const retries = op.retries; const nextAttemptAt = op.nextAttemptAt; const id = op.id; const hash = op.hash; const payload = structuredClone(op.payload);
  Date.now = () => Date.parse(nextAttemptAt) - 1;
  let called = 0;
  await sync.syncQueue(async ()=>{called++; return {};});
  eq(called, 0);
  op = (await queue.getAllOps())[0];
  eq(op.retries, retries); eq(op.nextAttemptAt, nextAttemptAt); eq(op.id, id); eq(op.hash, hash);
  eq(op.payload.client_id, payload.client_id); eq(op.payload._offline_op_id, payload._offline_op_id);
});

await test('retry limit still moves operation to FAILED and clears retry scheduling', async () => {
  let now = 3000000; Date.now = () => now;
  await queue.enqueueOp(baseTx());
  const apiReq = async () => { const e = new Error('Network down'); e.status=0; throw e; };
  // MAX_TRANSIENT_RETRIES=5: first 4 failures schedule RETRYING, 5th becomes FAILED
  for (let i = 0; i < 10; i++) {
    const res = await sync.syncQueue(apiReq);
    const op = (await queue.getAllOps())[0];
    if (op.status === 'FAILED') break;
    now = Date.parse(op.nextAttemptAt) + 1;
    Date.now = () => now;
  }
  const all = await queue.getAllOps();
  eq(all.length,1); eq(all[0].status,'FAILED'); ok((all[0].retries || 0) >= 5);
  ok(!all[0].nextAttemptAt);
});

await test('backoff metadata does not alter operation identity or payload', async () => {
  Date.now = () => 4000000;
  await queue.enqueueOp(baseTx());
  const before = structuredClone((await queue.getAllOps())[0]);
  await sync.syncQueue(async () => { const e = new Error('Network down'); e.status=0; throw e; });
  const after = (await queue.getAllOps())[0];
  eq(after.id, before.id); eq(after.hash, before.hash); eq(after.endpoint, before.endpoint); eq(after.method, before.method);
  eq(after.kind, before.kind); eq(after.timestamp, before.timestamp);
  eq(JSON.stringify(after.payload), JSON.stringify(before.payload));
  eq(after.payload.client_id, before.payload.client_id); eq(after.payload._offline_op_id, before.payload._offline_op_id);
});

await test('PENDING operations remain eligible regardless of retry scheduling semantics', async () => {
  Date.now = () => 5000000;
  const op = await queue.enqueueOp(baseTx());
  // even if malformed field existed, PENDING should be eligible; ensure normal pending works
  eq((await queue.getPendingOps()).length, 1);
  eq((await queue.getPendingOps())[0].status, 'PENDING');
});

await test('acknowledged count: one op counted once, unique op_ids, queue removal does not affect durable count', async () => {
  await db.putItem('sync_log', { op_id: 'op-1', status: 'CONFIRMED', timestamp: new Date().toISOString() });
  await db.putItem('sync_log', { op_id: 'op-1', status: 'ALREADY_EXISTS', timestamp: new Date().toISOString() }); // same op repeated
  eq(await queue.getAcknowledgedSyncCount(), 1);
  const summary = await queue.getQueueSummary();
  eq(summary.acknowledged, 1); eq(summary.acknowledgedAvailable, true);
});

await test('acknowledged count excludes failed/conflict/retry/auth log entries', async () => {
  await db.putItem('sync_log', { op_id: 'a1', status: 'CONFIRMED', timestamp: new Date().toISOString() });
  await db.putItem('sync_log', { op_id: 'a2', status: 'ALREADY_EXISTS', timestamp: new Date().toISOString() });
  await db.putItem('sync_log', { op_id: 'b1', status: 'FAILED', timestamp: new Date().toISOString() });
  await db.putItem('sync_log', { op_id: 'b2', status: 'CONFLICT', timestamp: new Date().toISOString() });
  await db.putItem('sync_log', { op_id: 'b3', status: 'RETRYING', timestamp: new Date().toISOString() });
  await db.putItem('sync_log', { op_id: 'b4', status: 'AUTH_REQUIRED', timestamp: new Date().toISOString() });
  eq(await queue.getAcknowledgedSyncCount(), 2);
});

await test('empty sync log produces valid zero acknowledged count', async () => {
  eq(await queue.getAcknowledgedSyncCount(), 0);
  const summary = await queue.getQueueSummary();
  eq(summary.acknowledged, 0); eq(summary.acknowledgedAvailable, true);
});

console.log(`\nRESULT ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
