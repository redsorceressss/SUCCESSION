/* SUCCESSION — charts. Small dependency-free SVG renderer (no library to license or install).
   Every chart takes real values from the store, has a title, units, legend, tooltip, empty/loading/error states,
   re-renders to its container width, and ships a visually hidden data table for screen readers. */
(() => {
  "use strict";
  const NS = "http://www.w3.org/2000/svg";
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const esc = (v) => String(v).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const el = (tag, attrs = {}, parent) => { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); parent && parent.appendChild(n); return n; };
  const nice = (max) => { if (max <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(max))), f = max / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p; };
  const num = (v, unit, dp) => (unit === "g" ? v.toFixed(dp == null ? 3 : dp) + " g" : String(Math.round(v * 1000) / 1000) + (unit ? " " + unit : ""));
  const dshort = (iso) => new Date(iso + "T00:00:00Z").toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "UTC" });

  function frame(host, o) {
    host.classList.add("chart"); host.innerHTML = "";
    const head = document.createElement("header"); head.className = "chart-head";
    head.innerHTML = `<div><h3 class="chart-title">${esc(o.title)}</h3>${o.sub ? `<p class="chart-sub">${esc(o.sub)}</p>` : ""}</div>${o.controls || ""}`;
    const body = document.createElement("div"); body.className = "chart-body";
    host.append(head, body); return { head, body };
  }
  function state(host, o, kind, msg) {
    const { body } = frame(host, o); host.dataset.state = kind;
    if (kind === "loading") body.innerHTML = `<div class="skel chart-skel" role="status" aria-label="Loading ${esc(o.title)}"></div>`;
    else body.innerHTML = `<div class="chart-empty ${kind}" role="${kind === "error" ? "alert" : "note"}"><p>${esc(msg)}</p></div>`;
  }
  const tip = (host) => { let t = host.querySelector(".chart-tip"); if (!t) { t = document.createElement("div"); t.className = "chart-tip"; t.setAttribute("aria-hidden", "true"); host.querySelector(".chart-body").append(t); } return t; };
  function showTip(host, html, x, y) { const t = tip(host), b = host.querySelector(".chart-body"); t.innerHTML = html; t.classList.add("on"); const w = t.offsetWidth, W = b.clientWidth; t.style.left = Math.max(4, Math.min(W - w - 4, x - w / 2)) + "px"; t.style.top = Math.max(0, y - t.offsetHeight - 12) + "px"; }
  const hideTip = (host) => { const t = host.querySelector(".chart-tip"); t && t.classList.remove("on"); };
  function legend(body, items) { const ul = document.createElement("ul"); ul.className = "chart-legend"; ul.innerHTML = items.map((i) => `<li><i style="background:${i.color}"></i>${esc(i.label)}${i.value != null ? `<b class="data">${esc(i.value)}</b>` : ""}</li>`).join(""); body.append(ul); }
  function srTable(body, caption, cols, rows) { const t = document.createElement("table"); t.className = "sr"; t.innerHTML = `<caption>${esc(caption)}</caption><thead><tr>${cols.map((c) => `<th scope="col">${esc(c)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c, i) => (i ? `<td>${esc(c)}</td>` : `<th scope="row">${esc(c)}</th>`)).join("")}</tr>`).join("")}</tbody>`; body.append(t); }
  function onResize(host, fn) { if (host._ro) host._ro.disconnect(); let w = 0; host._ro = new ResizeObserver((es) => { const nw = Math.round(es[0].contentRect.width); if (nw && nw !== w) { w = nw; fn(nw); } }); host._ro.observe(host.querySelector(".chart-body")); }

  /* ---------- doughnut ---------- */
  function donut(host, o) {
    const items = o.items.filter((i) => i.value > 0), total = o.items.reduce((s, i) => s + i.value, 0);
    if (!total) return state(host, o, "empty", o.empty || "This chart fills in once transactions exist.");
    const { body } = frame(host, o); host.dataset.state = "ready";
    const wrap = document.createElement("div"); wrap.className = "donut"; body.append(wrap);
    const svg = el("svg", { viewBox: "0 0 120 120", role: "img", "aria-label": `${o.title}. ${items.map((i) => `${i.label} ${i.value}`).join(", ")}` }, wrap);
    const R = 46, C = 2 * Math.PI * R; let off = 0;
    el("circle", { cx: 60, cy: 60, r: R, fill: "none", stroke: css("--rule-light"), "stroke-width": 14 }, svg);
    items.forEach((i) => {
      const len = (i.value / total) * C, gap = items.length > 1 ? 1.6 : 0;
      const c = el("circle", { cx: 60, cy: 60, r: R, fill: "none", stroke: i.color, "stroke-width": 14, "stroke-dasharray": reduced ? `${Math.max(len - gap, 0)} ${C}` : `0 ${C}`, "stroke-dashoffset": -off, transform: "rotate(-90 60 60)", tabindex: 0, class: "seg", "aria-label": `${i.label}: ${i.value}` }, svg);
      if (!reduced) requestAnimationFrame(() => requestAnimationFrame(() => { c.style.transition = "stroke-dasharray 1s cubic-bezier(.16,1,.3,1)"; c.setAttribute("stroke-dasharray", `${Math.max(len - gap, 0)} ${C}`); }));
      const show = (e) => { const r = wrap.getBoundingClientRect(), b = body.getBoundingClientRect(); const x = e.clientX ? e.clientX - b.left : r.left - b.left + r.width / 2, y = e.clientY ? e.clientY - b.top : r.top - b.top + 20; showTip(host, `<b>${esc(i.label)}</b>${i.value} ${esc(o.unit || "")} · ${Math.round(i.value / total * 100)}%`, x, y); };
      c.addEventListener("pointermove", show); c.addEventListener("focus", show); c.addEventListener("pointerleave", () => hideTip(host)); c.addEventListener("blur", () => hideTip(host));
      off += len;
    });
    const mid = document.createElement("div"); mid.className = "donut-mid"; mid.innerHTML = `<b class="data">${total}</b><span>${esc(o.centre || "entries")}</span>`; wrap.append(mid);
    legend(body, o.items.map((i) => ({ label: i.label, color: i.color, value: i.value })));
    srTable(body, o.title, ["Status", o.unit || "Count"], o.items.map((i) => [i.label, i.value]));
  }

  /* ---------- line ---------- */
  function line(host, o) {
    if (!o.x.length || o.series.every((s) => s.values.every((v) => !v))) return state(host, o, "empty", o.empty || "This chart fills in once transactions exist.");
    const { body } = frame(host, o); host.dataset.state = "ready";
    const stage = document.createElement("div"); stage.className = "plot"; body.append(stage);
    legend(body, o.series.map((s) => ({ label: s.label, color: s.color })));
    srTable(body, o.title, ["Date", ...o.series.map((s) => `${s.label} (${o.unit})`)], o.x.map((x, i) => [dshort(x), ...o.series.map((s) => num(s.values[i], o.unit))]));
    const draw = (W) => {
      stage.innerHTML = ""; const H = Math.max(200, Math.min(280, W * .42)), m = { l: o.unit === "g" ? 56 : 40, r: 14, t: 12, b: 34 }, iw = W - m.l - m.r, ih = H - m.t - m.b;
      const max = nice(Math.max(...o.series.flatMap((s) => s.values), 0.001)), X = (i) => m.l + (o.x.length === 1 ? iw / 2 : (i / (o.x.length - 1)) * iw), Y = (v) => m.t + ih - (v / max) * ih;
      const svg = el("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": o.title }, stage);
      const ticks = 4; for (let i = 0; i <= ticks; i++) { const v = (max / ticks) * i, y = Y(v); el("line", { x1: m.l, x2: W - m.r, y1: y, y2: y, stroke: css("--rule-light"), "stroke-width": 1 }, svg); const t = el("text", { x: m.l - 8, y: y + 4, "text-anchor": "end", class: "ax" }, svg); t.textContent = o.unit === "g" ? v.toFixed(v >= 10 ? 0 : 1) : Math.round(v); }
      const yl = el("text", { x: 0, y: 0, class: "ax ax-title", transform: `translate(12 ${m.t + ih / 2}) rotate(-90)`, "text-anchor": "middle" }, svg); yl.textContent = o.yLabel || o.unit;
      const step = Math.max(1, Math.ceil(o.x.length / Math.max(2, Math.floor(iw / 62))));
      o.x.forEach((x, i) => { if (i % step === 0 || i === o.x.length - 1) { const t = el("text", { x: X(i), y: H - 12, "text-anchor": i === 0 ? "start" : i === o.x.length - 1 ? "end" : "middle", class: "ax" }, svg); t.textContent = dshort(x); } });
      el("text", { x: m.l + iw / 2, y: H - 0.5, class: "ax ax-title", "text-anchor": "middle" }, svg).textContent = "";
      o.series.forEach((s) => {
        const pts = s.values.map((v, i) => [X(i), Y(v)]);
        if (s.area) el("path", { d: `M${pts[0][0]},${Y(0)} ${pts.map((p) => `L${p[0]},${p[1]}`).join(" ")} L${pts[pts.length - 1][0]},${Y(0)}Z`, fill: s.color, opacity: .08 }, svg);
        const p = el("path", { d: "M" + pts.map((q) => q.join(",")).join(" L"), fill: "none", stroke: s.color, "stroke-width": 2.2, "stroke-linejoin": "round", "stroke-linecap": "round", pathLength: 1 }, svg);
        if (!reduced) { p.style.strokeDasharray = 1; p.style.strokeDashoffset = 1; requestAnimationFrame(() => requestAnimationFrame(() => { p.style.transition = "stroke-dashoffset 1.3s cubic-bezier(.65,0,.35,1)"; p.style.strokeDashoffset = 0; })); }
      });
      const guide = el("line", { y1: m.t, y2: m.t + ih, stroke: css("--ink"), "stroke-width": 1, opacity: 0, "stroke-dasharray": "3 3" }, svg), dots = o.series.map((s) => el("circle", { r: 4.5, fill: css("--porcelain"), stroke: s.color, "stroke-width": 2.2, opacity: 0 }, svg));
      const hit = el("rect", { x: m.l, y: m.t, width: iw, height: ih, fill: "transparent", tabindex: 0, "aria-label": `${o.title}: use left and right arrow keys to read each date` }, svg); let cur = o.x.length - 1;
      const at = (i) => { cur = i; const x = X(i); guide.setAttribute("x1", x); guide.setAttribute("x2", x); guide.setAttribute("opacity", .35); dots.forEach((d, k) => { d.setAttribute("cx", x); d.setAttribute("cy", Y(o.series[k].values[i])); d.setAttribute("opacity", 1); }); showTip(host, `<b>${dshort(o.x[i])}</b>` + o.series.map((s) => `<span class="tl"><i style="background:${s.color}"></i>${esc(s.label)} <em class="data">${num(s.values[i], o.unit)}</em></span>`).join(""), x, Y(Math.max(...o.series.map((s) => s.values[i])))); };
      const clear = () => { guide.setAttribute("opacity", 0); dots.forEach((d) => d.setAttribute("opacity", 0)); hideTip(host); };
      hit.addEventListener("pointermove", (e) => { const r = svg.getBoundingClientRect(); at(Math.max(0, Math.min(o.x.length - 1, Math.round(((e.clientX - r.left - m.l) / iw) * (o.x.length - 1))))); });
      hit.addEventListener("pointerleave", clear); hit.addEventListener("blur", clear); hit.addEventListener("focus", () => at(cur));
      hit.addEventListener("keydown", (e) => { if (e.key === "ArrowRight") { e.preventDefault(); at(Math.min(o.x.length - 1, cur + 1)); } if (e.key === "ArrowLeft") { e.preventDefault(); at(Math.max(0, cur - 1)); } });
    };
    onResize(host, draw);
  }

  /* ---------- bars: vertical/horizontal, grouped or stacked ---------- */
  function bars(host, o) {
    const total = o.series.reduce((s, x) => s + x.values.reduce((a, b) => a + b, 0), 0);
    if (!o.categories.length || !total) return state(host, o, "empty", o.empty || "This chart fills in once transactions exist.");
    const { body } = frame(host, o); host.dataset.state = "ready";
    const stage = document.createElement("div"); stage.className = "plot"; body.append(stage);
    if (o.series.length > 1 || o.legend) legend(body, o.series.map((s) => ({ label: s.label, color: s.color })));
    srTable(body, o.title, [o.catLabel || "Category", ...o.series.map((s) => `${s.label} (${o.unit})`)], o.categories.map((c, i) => [c, ...o.series.map((s) => num(s.values[i], o.unit))]));
    const draw = (W) => {
      stage.innerHTML = ""; const hz = !!o.horizontal, n = o.categories.length;
      const m = hz ? { l: Math.min(150, W * .32), r: 16, t: 8, b: 34 } : { l: 40, r: 10, t: 12, b: 32 };
      const H = hz ? Math.max(150, n * 46 + m.t + m.b) : Math.max(190, Math.min(250, W * .5)), iw = W - m.l - m.r, ih = H - m.t - m.b;
      const stackMax = Math.max(...o.categories.map((_, i) => o.series.reduce((s, x) => s + x.values[i], 0))), grpMax = Math.max(...o.series.flatMap((s) => s.values));
      const raw = o.stacked ? stackMax : grpMax, ints = o.unit !== "g" && raw <= 10, max = ints ? Math.max(1, Math.ceil(raw)) : nice(raw), svg = el("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": o.title }, stage);
      const ticks = ints ? max : 4, tk = (max / ticks);
      for (let i = 0; i <= ticks; i++) { const v = tk * i; if (hz) { const x = m.l + (v / max) * iw; el("line", { x1: x, x2: x, y1: m.t, y2: m.t + ih, stroke: css("--rule-light") }, svg); el("text", { x, y: H - 14, "text-anchor": "middle", class: "ax" }, svg).textContent = o.unit === "g" ? v.toFixed(1) : Math.round(v * 10) / 10; } else { const y = m.t + ih - (v / max) * ih; el("line", { x1: m.l, x2: W - m.r, y1: y, y2: y, stroke: css("--rule-light") }, svg); el("text", { x: m.l - 8, y: y + 4, "text-anchor": "end", class: "ax" }, svg).textContent = o.unit === "g" ? v.toFixed(1) : Math.round(v * 10) / 10; } }
      el("text", { class: "ax ax-title", "text-anchor": "middle", x: hz ? m.l + iw / 2 : 0, y: hz ? H - 0.5 : 0, transform: hz ? "" : `translate(11 ${m.t + ih / 2}) rotate(-90)` }, svg).textContent = o.axis || o.unit;
      const band = (hz ? ih : iw) / n, groups = o.stacked ? 1 : o.series.length, bw = Math.min(hz ? 26 : 44, (band * .66) / groups), skip = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(iw / 70))));
      o.categories.forEach((c, i) => {
        const ctr = (hz ? m.t : m.l) + band * i + band / 2;
        if (hz) { const t = el("text", { x: m.l - 10, y: ctr + 4, "text-anchor": "end", class: "ax lbl" }, svg); t.textContent = c.length > 20 ? c.slice(0, 19) + "…" : c; } else if (i % skip === 0) el("text", { x: ctr, y: H - 12, "text-anchor": "middle", class: "ax" }, svg).textContent = c;
        let acc = 0;
        o.series.forEach((s, k) => {
          const v = s.values[i]; if (!v) return; const len = (v / max) * (hz ? iw : ih), g = o.stacked ? 0 : (k - (groups - 1) / 2) * bw;
          const x = hz ? m.l + (o.stacked ? (acc / max) * iw : 0) : ctr - bw / 2 + g, y = hz ? ctr - bw / 2 + g : m.t + ih - (o.stacked ? ((acc + v) / max) * ih : len);
          const r = el("rect", { x, y, width: hz ? (reduced ? len : 0) : bw, height: hz ? bw : (reduced ? len : 0), fill: s.color, rx: 1.5, tabindex: 0, "aria-label": `${c}, ${s.label}: ${num(v, o.unit)}`, class: "bar" }, svg);
          if (!hz) r.setAttribute("y", reduced ? y : m.t + ih - (o.stacked ? (acc / max) * ih : 0));
          if (!reduced) requestAnimationFrame(() => requestAnimationFrame(() => { r.style.transition = "all .9s cubic-bezier(.16,1,.3,1)"; hz ? r.setAttribute("width", len) : (r.setAttribute("height", len), r.setAttribute("y", y)); }));
          const show = (e) => { const b = stage.getBoundingClientRect(), bb = r.getBoundingClientRect(); showTip(host, `<b>${esc(c)}</b><span class="tl"><i style="background:${s.color}"></i>${esc(s.label)} <em class="data">${num(v, o.unit)}</em></span>`, e.clientX ? e.clientX - b.left : bb.left - b.left + bb.width / 2, e.clientY ? e.clientY - b.top + stage.offsetTop : bb.top - b.top + stage.offsetTop); };
          r.addEventListener("pointermove", show); r.addEventListener("focus", show); r.addEventListener("pointerleave", () => hideTip(host)); r.addEventListener("blur", () => hideTip(host));
          acc += v;
        });
      });
    };
    onResize(host, draw);
  }

  window.SuccessionCharts = { donut, line, bars, loading: (h, o) => state(h, o, "loading"), error: (h, o, m) => state(h, o, "error", m || "This chart could not be drawn. Try again."), color: (n) => css("--" + n) };
})();
