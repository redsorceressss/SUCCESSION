/* SUCCESSION — demo data store (localStorage). Stands in for the server: all rules live here so every view reads the same record. */
(() => {
  "use strict";
  const KEY = "succession.demo.v1", TOL = 0.020, ASSAY_TOL = 0.5;
  const JEW = "Aurelia Jewellers", ASSAYER = "Meera Assay Services";
  const KARIGARS = ["Ramesh Soni", "Imran Qureshi", "Devika Rao"];
  const d = (day, hm) => `2026-11-${String(day).padStart(2, "0")}T${hm}:00+05:30`;
  const ev = (t, who, text, kind) => ({ t, who, text, kind: kind || "" });

  const seed = () => ({
    seq: 1048,
    tx: [
      { id: "TX-1041", type: "issue", karigar: "Ramesh Soni", item: "Kundan choker base", grams: 31.500, karat: 22, date: d(4, "11:20"), status: "acknowledged", ack: 31.500, evidence: ["issue-slip.jpg"], assay: { state: "requested", by: JEW, at: d(17, "16:05") },
        events: [ev(d(4, "11:20"), JEW, "issued 31.500 g of 22K gold to Ramesh Soni.", "info"), ev(d(4, "12:02"), "Ramesh Soni", "recorded 31.500 g on his scale. Acknowledged.", "ok"), ev(d(17, "16:05"), JEW, "requested an assay.", "info")] },
      { id: "TX-1043", type: "return", karigar: "Ramesh Soni", item: "Filings and leftover metal", grams: 3.205, karat: 22, date: d(12, "17:40"), status: "acknowledged", ack: 3.205, evidence: [], assay: { state: "none" },
        events: [ev(d(12, "17:40"), "Ramesh Soni", "returned 3.205 g of filings and leftover metal.", "info"), ev(d(12, "18:10"), JEW, "recorded 3.205 g on the shop scale. Acknowledged.", "ok")] },
      { id: "TX-1044", type: "issue", karigar: "Imran Qureshi", item: "Bangle pair, plain", grams: 8.200, karat: 22, date: d(9, "10:05"), status: "acknowledged", ack: 8.200, evidence: [], assay: { state: "verified", by: JEW, at: d(10, "12:30"), fineness: 916.4, declared: 916, doneBy: ASSAYER, doneAt: d(10, "15:45") },
        events: [ev(d(9, "10:05"), JEW, "issued 8.200 g of 22K gold to Imran Qureshi.", "info"), ev(d(9, "10:41"), "Imran Qureshi", "recorded 8.200 g. Acknowledged.", "ok"), ev(d(10, "12:30"), JEW, "requested an assay.", "info"), ev(d(10, "15:45"), ASSAYER, "reported fineness 916.4. Matches the declared 916.", "ok")] },
      { id: "TX-1045", type: "issue", karigar: "Devika Rao", item: "Jhumka frames", grams: 5.825, karat: 22, date: d(11, "15:15"), status: "acknowledged", ack: 5.825, evidence: [], assay: { state: "none" },
        events: [ev(d(11, "15:15"), JEW, "issued 5.825 g of 22K gold to Devika Rao.", "info"), ev(d(11, "15:50"), "Devika Rao", "recorded 5.825 g. Acknowledged.", "ok")] },
      { id: "TX-1046", type: "issue", karigar: "Devika Rao", item: "Temple pendant blank", grams: 9.150, karat: 22, date: d(16, "10:12"), status: "disputed", ack: 9.120, evidence: ["issue-slip.jpg", "display-after-tare.jpg"], assay: { state: "none" },
        dispute: { by: "Devika Rao", at: d(16, "11:05"), note: "Display photographed after tare.", open: true },
        events: [ev(d(16, "10:12"), JEW, "issued 9.150 g of 22K gold to Devika Rao.", "info"), ev(d(16, "11:03"), "Devika Rao", "recorded 9.120 g on her scale. Variance −0.030 g is outside tolerance and is flagged to both parties.", "bad"), ev(d(16, "11:05"), "Devika Rao", "raised a dispute: “Display photographed after tare.”", "bad")] },
      { id: "TX-1047", type: "issue", karigar: "Ramesh Soni", item: "Kundan choker, finishing", grams: 24.860, karat: 22, date: d(18, "11:42"), status: "acknowledged", ack: 24.860, evidence: [], assay: { state: "none" },
        events: [ev(d(18, "11:42"), JEW, "issued 24.860 g of 22K gold to Ramesh Soni.", "info"), ev(d(18, "12:10"), "Ramesh Soni", "recorded 24.860 g. Acknowledged.", "ok")] },
      { id: "TX-1048", type: "issue", karigar: "Imran Qureshi", item: "Chain links, 22K", grams: 12.400, karat: 22, date: d(19, "09:30"), status: "pending", ack: null, evidence: [], assay: { state: "none" },
        events: [ev(d(19, "09:30"), JEW, "issued 12.400 g of 22K gold to Imran Qureshi. Waiting for his acknowledgement.", "info")] }
    ]
  });

  let state; const subs = new Set();
  const load = () => { try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.tx) return s; } catch (_) {} return seed(); };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (_) {} subs.forEach((f) => f()); };
  state = load();

  const r3 = (n) => Math.round(n * 1000) / 1000;
  const fmt = (n) => (n < 0 ? "−" : "") + Math.abs(n).toFixed(3);
  const counts = (t) => t.status !== "pending";                 // pending entries are not yet part of anyone's balance
  const held = (t) => (t.status === "acknowledged" || t.status === "resolved") ? (t.resolved != null ? t.resolved : t.ack) : t.grams;   // disputed/flagged: the recorded (issued) figure stands until settled
  const sign = (t) => (t.type === "issue" ? 1 : -1);
  const now = () => new Date().toISOString();
  const byId = (id) => state.tx.find((t) => t.id === id);

  const S = {
    TOL, ASSAY_TOL, JEW, ASSAYER, KARIGARS, fmt, r3,
    subscribe: (f) => { subs.add(f); return () => subs.delete(f); },
    reset: () => { state = seed(); save(); },
    all: () => [...state.tx].sort((a, b) => (a.date < b.date ? 1 : -1)),
    get: byId,
    forKarigar: (k) => S.all().filter((t) => t.karigar === k),
    balance: (k) => r3(state.tx.filter((t) => t.karigar === k && counts(t)).reduce((s, t) => s + sign(t) * (t.type === "issue" ? held(t) : (t.status === "acknowledged" || t.status === "resolved" ? held(t) : t.grams)), 0)),
    passbook: (k) => { let run = 0; return state.tx.filter((t) => t.karigar === k && counts(t)).sort((a, b) => (a.date < b.date ? -1 : 1)).map((t) => { const g = t.type === "issue" ? held(t) : (t.status === "acknowledged" || t.status === "resolved" ? held(t) : t.grams); run = r3(run + sign(t) * g); return { t, grams: g, run }; }); },
    variance: (t) => (t.ack == null ? null : r3(t.ack - t.grams)),
    stats: () => ({ pending: state.tx.filter((t) => t.status === "pending").length, disputed: state.tx.filter((t) => t.status === "disputed" || t.status === "flagged").length, assay: state.tx.filter((t) => t.assay && t.assay.state === "requested").length }),

    /* the party who did not create the entry acknowledges with their own reading */
    acknowledge(id, reading, who) {
      const t = byId(id); if (!t || t.status !== "pending") return { ok: false, msg: "This entry is not waiting for acknowledgement." };
      const g = r3(+reading); if (!(g > 0)) return { ok: false, msg: "Enter the weight shown on your scale." };
      t.ack = g; const v = r3(g - t.grams); const within = Math.abs(v) <= TOL + 1e-9;
      t.status = within ? "acknowledged" : "flagged";
      t.events.push(ev(now(), who, within ? `recorded ${g.toFixed(3)} g. Acknowledged${v ? ` (variance ${fmt(v)} g, within tolerance)` : ""}.` : `recorded ${g.toFixed(3)} g. Variance ${fmt(v)} g is outside tolerance and is flagged to both parties.`, within ? "ok" : "bad"));
      save(); return { ok: true, within, variance: v };
    },
    issue({ karigar, item, grams, karat }) {
      const g = r3(+grams); if (!KARIGARS.includes(karigar) || !(g > 0) || !item.trim()) return { ok: false };
      const id = "TX-" + (++state.seq);
      state.tx.push({ id, type: "issue", karigar, item: item.trim(), grams: g, karat: +karat || 22, date: now(), status: "pending", ack: null, evidence: [], assay: { state: "none" }, events: [ev(now(), JEW, `issued ${g.toFixed(3)} g of ${+karat || 22}K gold to ${karigar}. Waiting for acknowledgement.`, "info")] });
      save(); return { ok: true, id };
    },
    ret({ karigar, item, grams, karat }) {
      const g = r3(+grams); if (!(g > 0)) return { ok: false, msg: "Enter the weight being returned." };
      if (g > S.balance(karigar) + 1e-9) return { ok: false, msg: `Only ${S.balance(karigar).toFixed(3)} g is held. A return can't exceed that.` };
      const id = "TX-" + (++state.seq);
      state.tx.push({ id, type: "return", karigar, item: (item || "Returned metal").trim(), grams: g, karat: +karat || 22, date: now(), status: "pending", ack: null, evidence: [], assay: { state: "none" }, events: [ev(now(), karigar, `returned ${g.toFixed(3)} g. Waiting for the jeweller's acknowledgement.`, "info")] });
      save(); return { ok: true, id };
    },
    dispute(id, who, note) {
      const t = byId(id); if (!t || !(t.status === "flagged")) return { ok: false };
      t.status = "disputed"; t.dispute = { by: who, at: now(), note: note.trim(), open: true };
      t.events.push(ev(now(), who, `raised a dispute${note.trim() ? `: “${note.trim()}”` : "."}`, "bad")); save(); return { ok: true };
    },
    addNote(id, who, note) { const t = byId(id); if (!t || !note.trim()) return { ok: false }; t.events.push(ev(now(), who, `added a note: “${note.trim()}”`, "info")); save(); return { ok: true }; },
    attach(id, who, name) { const t = byId(id); if (!t || !name) return { ok: false }; t.evidence.push(name); t.events.push(ev(now(), who, `attached ${name}.`, "info")); save(); return { ok: true }; },
    resolve(id, who, choice) {
      const t = byId(id); if (!t || !(t.status === "disputed" || t.status === "flagged")) return { ok: false };
      const g = choice === "received" ? t.ack : t.grams;
      t.resolved = g; t.status = "resolved"; if (t.dispute) t.dispute.open = false;
      t.events.push(ev(now(), who, `resolved the difference. Agreed weight: ${g.toFixed(3)} g (${choice === "received" ? "the received reading" : "the issued figure"}).`, "ok")); save(); return { ok: true };
    },
    requestAssay(id, who) { const t = byId(id); if (!t || t.type !== "issue" || (t.assay && t.assay.state === "requested")) return { ok: false }; t.assay = { state: "requested", by: who, at: now() }; t.events.push(ev(now(), who, "requested an assay.", "info")); save(); return { ok: true }; },
    recordAssay(id, fineness) {
      const t = byId(id); const f = +fineness; if (!t || !t.assay || t.assay.state !== "requested" || !(f >= 300 && f <= 999.9)) return { ok: false, msg: "Enter a fineness between 300 and 999.9." };
      const declared = Math.round(t.karat / 24 * 1000 * 10) / 10; const declaredShown = t.karat === 22 ? 916 : declared;
      const match = Math.abs(f - declaredShown) <= ASSAY_TOL;
      t.assay = { ...t.assay, state: match ? "verified" : "mismatch", fineness: f, declared: declaredShown, doneBy: ASSAYER, doneAt: now() };
      t.events.push(ev(now(), ASSAYER, `reported fineness ${f.toFixed(1)}. ${match ? "Matches" : "Does not match"} the declared ${declaredShown}.`, match ? "ok" : "bad")); save(); return { ok: true, match };
    }
  };
  window.SuccessionStore = S;
})();
