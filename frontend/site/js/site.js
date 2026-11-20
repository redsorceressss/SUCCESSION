/* SUCCESSION — public site behaviour: nav, role explorer, weighment demo, AI demo. Vanilla JS. */
(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const FX = window.SuccessionFX;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- nav: solid after the hero, active section, mobile menu ---------- */
  const nav = $("#nav"), toggle = $("#navToggle");
  const solid = () => nav.classList.toggle("is-solid", scrollY > 24 || document.body.dataset.solid === "1" || nav.classList.contains("is-open"));
  if (!$(".hero")) document.body.dataset.solid = "1";
  addEventListener("scroll", solid, { passive: true }); solid();
  toggle && toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(open)); toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    document.documentElement.style.overflow = open ? "hidden" : ""; solid();
  });
  $$("#navLinks a").forEach((a) => a.addEventListener("click", () => { if (nav.classList.contains("is-open")) toggle.click(); }));
  addEventListener("keydown", (e) => { if (e.key === "Escape" && nav.classList.contains("is-open")) { toggle.click(); toggle.focus(); } });

  const secs = $$("[data-sec-id]"), links = $$("#navLinks a[data-sec]");
  if (secs.length && "IntersectionObserver" in window) {
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      links.forEach((l) => l.classList.toggle("is-active", l.dataset.sec === e.target.dataset.secId));
    }), { rootMargin: "-45% 0px -50% 0px" });
    secs.forEach((s) => io.observe(s));
  }

  /* ---------- accessible tabs (shared) ---------- */
  function tabs(listSel, tabSel, panelOf, onChange) {
    const list = $(listSel); if (!list) return;
    const all = $$(tabSel, list);
    const select = (t, focus) => {
      all.forEach((x) => { const on = x === t; x.setAttribute("aria-selected", on); x.tabIndex = on ? 0 : -1; const p = panelOf(x); if (p) p.hidden = !on; });
      if (focus) t.focus(); onChange && onChange(t);
    };
    all.forEach((t, i) => {
      t.addEventListener("click", () => select(t));
      t.addEventListener("keydown", (e) => {
        const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
        if (keys[e.key]) { e.preventDefault(); select(all[(i + keys[e.key] + all.length) % all.length], true); }
        if (e.key === "Home") { e.preventDefault(); select(all[0], true); }
        if (e.key === "End") { e.preventDefault(); select(all[all.length - 1], true); }
      });
    });
  }
  tabs("#explorer .ex-tabs", ".ex-tab", (t) => $("#" + t.getAttribute("aria-controls")));

  /* ---------- weighment comparison ---------- */
  const range = $("#wRange");
  if (range) {
    const ISSUED = 24.860, TOL = 0.020;
    const read = $("#wRead"), vr = $("#wVar"), st = $("#wStatus"), note = $("#wNote");
    const update = () => {
      const v = +range.value, d = v - ISSUED, ok = Math.abs(d) <= TOL + 1e-9;
      read.textContent = v.toFixed(3);
      vr.innerHTML = `${d > 0 ? "+" : d < 0 ? "−" : ""}${Math.abs(d).toFixed(3)} <i>g</i>`;
      vr.className = "data big " + (ok ? (d === 0 ? "" : "pos") : "neg");
      st.className = "status " + (ok ? "status--ok" : "status--bad");
      st.textContent = ok ? "Acknowledged" : "Variance flagged";
      note.textContent = ok ? "Within tolerance. Both parties sign off." : "Outside tolerance. Both parties are told, and a dispute can be raised with evidence.";
    };
    range.addEventListener("input", update); update();
  }

  /* ---------- AI-assisted demo (illustrative, plays once per tab when seen) ---------- */
  const demo = $("#assist-demo");
  if (demo) {
    const VOICE = "Issued twenty-four point eight six zero grams, twenty-two carat, to Ramesh Soni for the kundan choker base.";
    const ASK = "What does Ramesh Soni hold as of 18 November?";
    const played = {}; let seen = false;
    const play = (mode) => {
      if (played[mode]) return; played[mode] = true;
      const fields = $("#asFields-" + mode);
      if (mode === "voice") FX.type($("#asSay"), VOICE, { speed: 26 }).then(() => fields.classList.add("shown"));
      else if (mode === "ask") FX.type($("#asAsk"), ASK, { speed: 32 }).then(() => $("#asAns").closest(".as-out").classList.add("shown"));
      else if (mode === "scan") setTimeout(() => fields.classList.add("shown"), reduced ? 0 : 2000);
    };
    if (reduced) { $("#asSay").textContent = VOICE; $("#asAsk").textContent = ASK; $$(".fields").forEach((f) => f.classList.add("shown")); }
    demo.addEventListener("fx:in", () => { if (!seen) { seen = true; play("voice"); } });
    tabs("#assist-demo .as-tabs", ".as-tab", (t) => $("#" + t.getAttribute("aria-controls")), (t) => { if (seen) play(t.dataset.mode); });
  }
})();
