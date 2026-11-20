/* SUCCESSION — text-animation runtime (vanilla). Public API: window.SuccessionFX */
(() => {
  "use strict";
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const root = document.documentElement;
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const ease = (p) => 1 - Math.pow(1 - p, 3);
  const fmt = (v, d) => v.toFixed(d);

  /* ---------- preparation (before anything is hidden) ---------- */
  $$('[data-fx="mask"]').forEach((el) => {
    if (!el.querySelector(".ln")) el.innerHTML = el.innerHTML.split(/<br\s*\/?>/i).map((l) => `<span class="ln"><span>${l}</span></span>`).join("");
    $$(".ln > span", el).forEach((s, i) => s.style.setProperty("--i", i));
  });
  $$('[data-fx="words"]').forEach((el) => {
    let i = 0;
    const walk = (node) => [...node.childNodes].forEach((n) => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach((tok) => {
          if (!tok) return;
          if (/^\s+$/.test(tok)) { frag.appendChild(document.createTextNode(" ")); return; }
          const s = document.createElement("span"); s.className = "w"; s.style.setProperty("--i", i++); s.textContent = tok; frag.appendChild(s);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1 && !n.classList.contains("w")) {
        if (n.classList.contains("keep")) { n.classList.add("w"); n.style.setProperty("--i", i++); } else walk(n);
      }
    });
    walk(el);
  });

  /* ---------- count up ---------- */
  function count(el, to, o = {}) {
    const dec = o.decimals ?? +(el.dataset.decimals || 0), from = o.from ?? +(el.dataset.from || 0), dur = o.duration ?? +(el.dataset.dur || 1500);
    if (reduced) { el.textContent = fmt(to, dec); return Promise.resolve(); }
    return new Promise((res) => {
      const t0 = performance.now();
      const f = (n) => { const p = Math.min(1, (n - t0) / dur); el.textContent = fmt(from + (to - from) * ease(p), dec); p < 1 ? requestAnimationFrame(f) : res(); };
      requestAnimationFrame(f);
    });
  }

  /* ---------- typewriter ---------- */
  function type(el, text, o = {}) {
    const speed = o.speed ?? 28;
    el.classList.remove("tw-done"); el.classList.add("tw-caret");
    if (reduced) { el.textContent = text; el.classList.add("tw-done"); return Promise.resolve(); }
    el.textContent = "";
    return new Promise((res) => {
      let i = 0;
      const tick = () => {
        el.textContent = text.slice(0, ++i);
        if (i < text.length) setTimeout(tick, speed + (/[,.]/.test(text[i - 1]) ? 120 : Math.random() * 18));
        else { el.classList.add("tw-done"); res(); }
      };
      setTimeout(tick, o.delay ?? 0);
    });
  }

  /* ---------- observer ---------- */
  const fire = (el) => {
    if (el.classList.contains("in")) return;
    el.classList.add("in");
    if (el.classList.contains("swap")) setTimeout(() => el.classList.add("done"), 1100);
    if (el.dataset.count !== undefined) count(el, +el.dataset.count);
    el.dispatchEvent(new CustomEvent("fx:in", { bubbles: true }));
  };
  const targets = () => $$('[data-fx],.reveal-up,.swap,[data-count],.squig,[data-observe]');
  if (reduced || !("IntersectionObserver" in window)) {
    targets().forEach((el) => { if (el.dataset.count !== undefined) el.textContent = fmt(+el.dataset.count, +(el.dataset.decimals || 0)); el.classList.add("in", "done"); });
  } else {
    root.classList.add("fx-ready");
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { io.unobserve(e.target); fire(e.target); } }), { threshold: 0.2, rootMargin: "0px 0px -6% 0px" });
    const start = () => targets().forEach((el) => { if (el.dataset.count !== undefined && !el.classList.contains("in")) el.textContent = fmt(+(el.dataset.from || 0), +(el.dataset.decimals || 0)); io.observe(el); });
    document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", start) : start();
    // elements flagged data-now play on load (hero), after a beat so the intro hand-off feels continuous
    addEventListener("load", () => setTimeout(() => $$("[data-now]").forEach(fire), +(document.body.dataset.heroDelay || 250)));
  }
  window.SuccessionFX = { count, type, fire, reduced };
})();
