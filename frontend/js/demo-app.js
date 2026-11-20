/* SUCCESSION — dashboards (jeweller · karigar · assayer). Vanilla JS over js/store.js. */
(() => {
  "use strict";
  const S = window.SuccessionStore, role = document.body.dataset.role;
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const ic = (n, c = "") => `<svg class="ic ${c}" aria-hidden="true" focusable="false"><use href="#i-${n}"/></svg>`;
  const ME = { jeweller: S.JEW, karigar: "Ramesh Soni", assayer: S.ASSAYER }[role];
  let session = {}; try { session = JSON.parse(sessionStorage.getItem("succession.session")) || {}; } catch (_) {}
  const meName = session.role === role && session.name ? session.name : ME;
  const isKarigar = role === "karigar", isJew = role === "jeweller", isAssayer = role === "assayer";
  const myKarigar = isKarigar ? ME : null;           // the demo karigar view always reads as Ramesh Soni's account

  const NAV = isAssayer
    ? [["queue", "Assay queue", "flask"], ["history", "Completed", "file"]]
    : [["overview", "Overview", "overview"], ["transactions", "Transactions", "list"], ["passbook", "Passbook", "ledger"], ["disputes", "Disputes", "alert"]];
  const TITLE = { overview: "Overview", transactions: "Transactions", passbook: "Passbook", disputes: "Disputes", queue: "Assay queue", history: "Completed assays" };
  let view = (location.hash || "").slice(1); if (!NAV.some((n) => n[0] === view)) view = NAV[0][0];
  const ui = { filter: "all", pbK: isKarigar ? ME : S.KARIGARS[0] };

  /* ---------- formatting ---------- */
  const g = (n) => S.fmt(n);
  const when = (iso) => new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" }).replace(",", " ·");
  const day = (iso) => new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "Asia/Kolkata" });
  const STATUS = { pending: ["wait", "Awaiting acknowledgement"], acknowledged: ["ok", "Acknowledged"], flagged: ["bad", "Variance flagged"], disputed: ["bad", "In dispute"], resolved: ["info", "Resolved"] };
  const stat = (t) => { const [c, l] = STATUS[t.status]; return `<span class="status status--${c}">${l}</span>`; };
  const assayStat = (a) => !a || a.state === "none" ? `<span class="muted-s">—</span>` : a.state === "requested" ? `<span class="status status--wait">Requested</span>` : a.state === "verified" ? `<span class="status status--ok">Verified ${a.fineness.toFixed(1)}</span>` : `<span class="status status--bad">Mismatch ${a.fineness.toFixed(1)}</span>`;
  const mine = () => (isKarigar ? S.forKarigar(ME) : S.all());
  /* does this entry wait on me? issues wait on the karigar, returns on the jeweller */
  const needsMe = (t) => t.status === "pending" && ((isKarigar && t.type === "issue" && t.karigar === ME) || (isJew && t.type === "return"));
  const stageLabel = (t) => (t.type === "issue" ? "Issue" : "Return");

  function toast(title, body, bad) {
    const el = document.createElement("div"); el.className = "toast" + (bad ? " toast--bad" : ""); el.setAttribute("role", "status");
    el.innerHTML = `<b>${esc(title)}</b>${body ? esc(body) : ""}`; $("#toasts").append(el); setTimeout(() => el.remove(), 5200);
  }

  /* ---------- shell ---------- */
  function shell() {
    $("#side").innerHTML = `
      <a class="brand" href="../home.html" aria-label="SUCCESSION home"><span class="logo"><svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="14" fill="#0D0B09"/><circle cx="16" cy="16" r="6" fill="#C9A24A"/></svg></span><span class="wordmark">SUCCESSION</span></a>
      <p class="side-role label">${isJew ? "Jeweller" : isKarigar ? "Karigar" : "Assayer"}</p>
      <nav class="side-nav" aria-label="Dashboard sections">${NAV.map(([id, label, i]) => `<a href="#${id}" data-v="${id}">${ic(i)}<span>${label}</span><i class="count" data-badge="${id}"></i></a>`).join("")}</nav>
      <div class="side-foot">
        <div class="who"><span class="avatar" aria-hidden="true">${esc(meName.split(" ").map((w) => w[0]).slice(0, 2).join(""))}</span><span><b>${esc(meName)}</b><small>Demo account</small></span></div>
        <a class="side-link" href="../login.html">${ic("logout")}<span>Log out</span></a>
      </div>`;
    $("#topbar").innerHTML = `
      <button class="icon-btn menu" id="menuBtn" aria-label="Open navigation" aria-expanded="false">${ic("menu")}</button>
      <h1 class="topbar-title" id="vTitle"></h1>
      <div class="topbar-actions" id="vActions"></div>`;
    $("#menuBtn").addEventListener("click", () => toggleSide());
    $("#scrim").addEventListener("click", () => toggleSide(false));
    $("#side").addEventListener("click", (e) => { if (e.target.closest("a[data-v]")) toggleSide(false); });
  }
  function toggleSide(force) {
    const open = force == null ? !$("#app").classList.contains("nav-open") : force;
    $("#app").classList.toggle("nav-open", open); $("#scrim").classList.toggle("on", open); $("#menuBtn").setAttribute("aria-expanded", open);
  }

  const banner = () => `<div class="demo-bar" role="note">${ic("info")}<p><b>Demo data.</b> Everything here is sample data stored in this browser. Nothing is sent anywhere.</p><button class="btn btn--text btn--sm" id="resetDemo">Reset demo data</button></div>`;

  /* ---------- views ---------- */
  function metric(label, value, unit, sub, tone) { return `<div class="metric ${tone || ""}"><dt class="label">${label}</dt><dd class="data">${value}${unit ? `<i>${unit}</i>` : ""}</dd><p>${sub}</p></div>`; }

  function txRow(t, cols) {
    const v = S.variance(t);
    return `<tr tabindex="0" data-tx="${t.id}" aria-label="Open ${t.id}">
      <td class="id">${t.id}</td>
      <td>${esc(t.item)}<span class="sub">${stageLabel(t)}${isKarigar ? "" : " · " + esc(t.karigar)} · ${t.karat}K · ${day(t.date)}</span></td>
      <td class="num">${g(t.grams)}</td>
      <td class="num">${t.ack == null ? "—" : g(t.ack)}</td>
      <td class="num ${v ? (Math.abs(v) > S.TOL ? "neg" : "pos") : ""}">${v == null ? "—" : g(v)}</td>
      <td>${stat(t)}</td>${cols === "assay" ? `<td>${assayStat(t.assay)}</td>` : ""}
    </tr>`;
  }
  function txTable(rows, withAssay) {
    if (!rows.length) return empty("No entries to show", "Nothing matches this filter.");
    return `<div class="table-wrap"><table class="table"><caption class="sr">Transactions. Weights in grams.</caption><thead><tr><th scope="col">ID</th><th scope="col">Item</th><th scope="col" class="num">Issued / returned (g)</th><th scope="col" class="num">Other reading (g)</th><th scope="col" class="num">Variance (g)</th><th scope="col">Status</th>${withAssay ? '<th scope="col">Assay</th>' : ""}</tr></thead><tbody>${rows.map((t) => txRow(t, withAssay ? "assay" : "")).join("")}</tbody></table></div>`;
  }
  const empty = (t, b, action) => `<div class="empty">${ic("ledger")}<h3>${t}</h3><p>${b}</p>${action || ""}</div>`;

  function vOverview() {
    const all = mine(), st = S.stats();
    const waiting = all.filter(needsMe), disputed = all.filter((t) => t.status === "disputed" || t.status === "flagged");
    if (isKarigar) {
      return `<section class="hold"><p class="label">Gold held by you</p><p class="hold-fig data">${g(S.balance(ME)).replace(/^/, "")}<i>g</i></p><p class="hold-sub">Issued to you, less what you have returned and the jeweller has acknowledged.</p></section>
      <div class="stack">
        <section><div class="sec-head"><h2 class="h3">Waiting for you</h2></div>${waiting.length ? `<ul class="todo">${waiting.map((t) => `<li><div><b class="data">${t.id}</b> ${esc(t.item)}<span class="sub">${g(t.grams)} g issued by ${esc(S.JEW)} · ${day(t.date)}</span></div><button class="btn btn--primary btn--sm" data-act="ack" data-id="${t.id}">Acknowledge</button></li>`).join("")}</ul>` : empty("Nothing waiting", "New issues will appear here for you to confirm on your scale.")}</section>
        <section><div class="sec-head"><h2 class="h3">Recent activity</h2><a class="btn btn--text btn--sm" href="#transactions">All transactions</a></div>${txTable(all.slice(0, 4))}</section>
      </div>`;
    }
    const rows = S.KARIGARS.map((k) => `<tr><td>${esc(k)}</td><td class="num">${g(S.balance(k))}</td><td class="num">${S.forKarigar(k).filter((t) => t.status === "pending").length || "—"}</td><td class="num">${S.forKarigar(k).filter((t) => t.status === "disputed" || t.status === "flagged").length || "—"}</td><td class="r"><a class="btn btn--text btn--sm" href="#passbook" data-pb="${esc(k)}">Passbook</a></td></tr>`).join("");
    const total = S.KARIGARS.reduce((s, k) => s + S.balance(k), 0);
    return `<dl class="metrics">${metric("Gold with karigars", g(total), "g", `Across ${S.KARIGARS.length} karigars`)}${metric("Awaiting acknowledgement", st.pending, "", st.pending ? "Issued, not yet confirmed" : "All confirmed", st.pending ? "warn" : "")}${metric("Differences open", st.disputed, "", st.disputed ? "Outside tolerance" : "None open", st.disputed ? "bad" : "")}${metric("Assays requested", st.assay, "", st.assay ? "With the assayer" : "None waiting")}</dl>
      <div class="split split--wide">
        <section><div class="sec-head"><h2 class="h3">Balance by karigar</h2></div><div class="table-wrap"><table class="table"><caption class="sr">Gold currently held by each karigar, in grams</caption><thead><tr><th scope="col">Karigar</th><th scope="col" class="num">Holds (g)</th><th scope="col" class="num">Waiting</th><th scope="col" class="num">In difference</th><th scope="col"><span class="sr">Actions</span></th></tr></thead><tbody>${rows}</tbody></table></div></section>
        <section><div class="sec-head"><h2 class="h3">Needs your attention</h2></div>${(waiting.length + disputed.length) ? `<ul class="todo">${waiting.map((t) => `<li><div><b class="data">${t.id}</b> Return from ${esc(t.karigar)}<span class="sub">${g(t.grams)} g · confirm on your scale</span></div><button class="btn btn--primary btn--sm" data-act="ack" data-id="${t.id}">Acknowledge</button></li>`).join("")}${disputed.map((t) => `<li><div><b class="data">${t.id}</b> ${esc(t.karigar)} · ${esc(t.item)}<span class="sub">${g(t.grams)} issued, ${g(t.ack)} received · variance ${g(S.variance(t))} g</span></div><button class="btn btn--secondary btn--sm" data-open="${t.id}">Open</button></li>`).join("")}</ul>` : empty("All clear", "No returns to confirm and no open differences.")}</section>
      </div>
      <section><div class="sec-head"><h2 class="h3">Recent transactions</h2><a class="btn btn--text btn--sm" href="#transactions">View all</a></div>${txTable(all.slice(0, 5))}</section>`;
  }

  function vTransactions() {
    const all = mine(); const f = ui.filter;
    const list = all.filter((t) => f === "all" || (f === "waiting" ? t.status === "pending" : f === "difference" ? (t.status === "flagged" || t.status === "disputed") : t.status === "acknowledged" || t.status === "resolved"));
    const seg = [["all", "All"], ["waiting", "Waiting"], ["difference", "Differences"], ["settled", "Settled"]];
    return `<div class="toolbar"><div class="segmented seg-sm" role="radiogroup" aria-label="Filter">${seg.map(([v, l]) => `<label><input type="radio" name="flt" value="${v}" ${f === v ? "checked" : ""}><span>${l}</span></label>`).join("")}</div><span class="muted-s">${list.length} of ${all.length} entries</span></div>${txTable(list, true)}`;
  }

  function vPassbook() {
    const k = isKarigar ? ME : ui.pbK; const rows = S.passbook(k);
    const picker = isKarigar ? "" : `<div class="field pick"><label for="pbSel">Karigar</label><select class="select" id="pbSel">${S.KARIGARS.map((n) => `<option ${n === k ? "selected" : ""}>${esc(n)}</option>`).join("")}</select></div>`;
    const body = rows.length ? `<div class="table-wrap"><table class="table passbook"><caption class="sr">Passbook for ${esc(k)}. Weights in grams.</caption><thead><tr><th scope="col">Date</th><th scope="col">Entry</th><th scope="col" class="num">Issued (g)</th><th scope="col" class="num">Returned (g)</th><th scope="col" class="num">Balance (g)</th></tr></thead><tbody>${rows.map(({ t, grams, run }) => `<tr tabindex="0" data-tx="${t.id}"><td class="id">${day(t.date)}</td><td>${esc(t.item)}<span class="sub">${t.id} · ${STATUS[t.status][1]}</span></td><td class="num">${t.type === "issue" ? g(grams) : ""}</td><td class="num">${t.type === "return" ? g(grams) : ""}</td><td class="num strong">${g(run)}</td></tr>`).join("")}</tbody><tfoot><tr><th scope="row" colspan="4">Balance held</th><td class="num strong">${g(S.balance(k))}</td></tr></tfoot></table></div>
      <p class="muted-s note">Balances count acknowledged entries. Entries still waiting for acknowledgement are not included until they are confirmed.</p>` : empty("No entries yet", "Entries appear here once they are acknowledged.");
    return `<div class="toolbar">${picker}<span class="pb-total"><span class="label">Balance held</span><b class="data">${g(S.balance(k))} g</b></span></div>${body}`;
  }

  function vDisputes() {
    const list = mine().filter((t) => t.status === "disputed" || t.status === "flagged" || (t.dispute && !t.dispute.open));
    if (!list.length) return empty("No differences", "When a received weight is outside the 0.020 g tolerance, it is flagged here with both readings.");
    return `<ul class="cases">${list.map((t) => `<li><div class="case-head"><div><b class="data">${t.id}</b> <span class="sub-i">${esc(t.item)} · ${esc(t.karigar)}</span></div>${stat(t)}</div>
      <dl class="triple"><div><dt>Issued</dt><dd class="data">${g(t.grams)} g</dd></div><div><dt>Received</dt><dd class="data">${g(t.ack)} g</dd></div><div><dt>Variance</dt><dd class="data neg">${g(S.variance(t))} g</dd></div></dl>
      ${t.dispute ? `<p class="case-note"><b>${esc(t.dispute.by)}:</b> “${esc(t.dispute.note || "No note added")}”</p>` : ""}<div class="case-act"><button class="btn btn--secondary btn--sm" data-open="${t.id}">Open timeline</button></div></li>`).join("")}</ul>`;
  }

  function vQueue() {
    const q = S.all().filter((t) => t.assay && t.assay.state === "requested");
    const done = S.all().filter((t) => t.assay && (t.assay.state === "verified" || t.assay.state === "mismatch"));
    const strip = `<dl class="metrics metrics--3">${metric("Waiting", q.length, "", q.length ? "Requested by jewellers" : "Nothing waiting", q.length ? "warn" : "")}${metric("Verified", done.filter((t) => t.assay.state === "verified").length, "", "Matched the declared purity")}${metric("Mismatches", done.filter((t) => t.assay.state === "mismatch").length, "", "Reported to both parties", done.some((t) => t.assay.state === "mismatch") ? "bad" : "")}</dl>`;
    if (!q.length) return strip + empty("Queue is empty", "Assay requests from jewellers will arrive here.");
    return strip + `<div class="table-wrap"><table class="table"><caption class="sr">Assays waiting to be done</caption><thead><tr><th scope="col">Entry</th><th scope="col">Item</th><th scope="col">Requested by</th><th scope="col" class="num">Declared</th><th scope="col" class="num">Weight (g)</th><th scope="col"><span class="sr">Action</span></th></tr></thead><tbody>${q.map((t) => `<tr><td class="id">${t.id}</td><td>${esc(t.item)}<span class="sub">${esc(t.karigar)}</span></td><td>${esc(t.assay.by)}<span class="sub">${when(t.assay.at)}</span></td><td class="num">${t.karat === 22 ? "916" : (t.karat / 24 * 1000).toFixed(1)} · ${t.karat}K</td><td class="num">${g(t.grams)}</td><td class="r"><button class="btn btn--primary btn--sm" data-act="assay" data-id="${t.id}">Record result</button></td></tr>`).join("")}</tbody></table></div>`;
  }
  function vHistory() {
    const h = S.all().filter((t) => t.assay && (t.assay.state === "verified" || t.assay.state === "mismatch"));
    if (!h.length) return empty("Nothing completed yet", "Results you record will be listed here.");
    return `<div class="table-wrap"><table class="table"><caption class="sr">Completed assays</caption><thead><tr><th scope="col">Entry</th><th scope="col">Item</th><th scope="col" class="num">Declared</th><th scope="col" class="num">Fineness</th><th scope="col">Result</th><th scope="col">Reported</th></tr></thead><tbody>${h.map((t) => `<tr tabindex="0" data-tx="${t.id}"><td class="id">${t.id}</td><td>${esc(t.item)}<span class="sub">${esc(t.karigar)}</span></td><td class="num">${t.assay.declared}</td><td class="num">${t.assay.fineness.toFixed(1)}</td><td>${assayStat(t.assay)}</td><td class="id">${when(t.assay.doneAt)}</td></tr>`).join("")}</tbody></table></div>`;
  }

  const VIEWS = { overview: vOverview, transactions: vTransactions, passbook: vPassbook, disputes: vDisputes, queue: vQueue, history: vHistory };
  function actions() {
    if (isJew && (view === "overview" || view === "transactions")) return `<button class="btn btn--primary btn--sm" data-act="issue">${ic("plus")} New issue</button>`;
    if (isKarigar && (view === "overview" || view === "transactions")) return `<button class="btn btn--primary btn--sm" data-act="return">${ic("plus")} Record return</button>`;
    return "";
  }
  function render() {
    const st = S.stats();
    $$("#side a[data-v]").forEach((a) => { const on = a.dataset.v === view; a.classList.toggle("is-active", on); on ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current"); });
    const set = (id, n) => { const el = $(`[data-badge="${id}"]`); if (el) el.textContent = n || ""; };
    set("disputes", isKarigar ? S.forKarigar(ME).filter((t) => t.status === "disputed" || t.status === "flagged").length : st.disputed); set("queue", st.assay); set("transactions", isKarigar ? S.forKarigar(ME).filter(needsMe).length : isJew ? S.all().filter(needsMe).length : 0);
    $("#vTitle").textContent = TITLE[view]; document.title = `${TITLE[view]} — ${isJew ? "Jeweller" : isKarigar ? "Karigar" : "Assayer"} · SUCCESSION`;
    $("#vActions").innerHTML = actions();
    const fid = document.activeElement && document.activeElement.id;
    $("#main").innerHTML = banner() + `<div class="view">${VIEWS[view]()}</div>`;
    if (fid) { const el = document.getElementById(fid); el && el.focus(); }
  }

  /* ---------- dialogs ---------- */
  function openDialog(html, cls) {
    const dlg = document.createElement("dialog"); dlg.className = "sheet " + (cls || ""); dlg.innerHTML = html; $("#dialogs").append(dlg);
    dlg.addEventListener("close", () => dlg.remove()); dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
    $$("[data-close]", dlg).forEach((b) => b.addEventListener("click", () => dlg.close()));
    dlg.showModal(); return dlg;
  }
  const head = (t, sub) => `<div class="sheet-head"><div><h2 class="h3">${t}</h2>${sub ? `<p class="meta">${sub}</p>` : ""}</div><button class="icon-btn" data-close aria-label="Close">${ic("x")}</button></div>`;
  function busy(btn, label, fn) { btn.setAttribute("aria-busy", "true"); btn.disabled = true; btn.innerHTML = `<span class="spin" aria-hidden="true"></span>${label}`; setTimeout(fn, 550); }
  const fieldErr = (f, msg) => { f.classList.toggle("has-error", !!msg); const e = $(".error", f); if (e) e.textContent = msg || ""; const i = $("input,select", f); if (i) msg ? i.setAttribute("aria-invalid", "true") : i.removeAttribute("aria-invalid"); return !msg; };

  /* spoken / typed entry → fields (rules, no model; Web Speech used only if the browser has it) */
  const WORDS = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, oh: 0 };
  function parseSay(text) {
    const TEENS = { ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 }, TENS = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
    let s = text.toLowerCase().replace(/\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)[\s-](one|two|three|four|five|six|seven|eight|nine)\b/g, (_, t, u) => TENS[t] + WORDS[u]).replace(/\b(ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen)\b/g, (w) => TEENS[w]).replace(/\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)\b/g, (w) => TENS[w]).replace(/\bpoint\b/g, ".").replace(/\b(zero|one|two|three|four|five|six|seven|eight|nine|oh)\b/g, (w) => WORDS[w]);
    s = s.replace(/(\d)\s+(?=[\d.])/g, "$1").replace(/\s+\.\s*/g, ".").replace(/(\d)\.\s+(\d)/g, "$1.$2");
    const out = {}; const gm = s.match(/(\d+(?:\.\d+)?)\s*(?:gram|grams|gm|g)\b/); if (gm) out.grams = gm[1];
    const km = s.match(/(\d{2})\s*(?:k\b|karat|carat|kt)/); if (km) out.karat = km[1];
    out.karigar = S.KARIGARS.find((k) => s.includes(k.toLowerCase()) || s.includes(k.split(" ")[0].toLowerCase()));
    const im = text.match(/\bfor\s+(?:the\s+)?(.+?)\.?$/i); if (im) out.item = im[1].trim();
    return out;
  }

  function dIssue() {
    const dlg = openDialog(`${head("New issue", "Record gold given to a karigar. They will confirm on their own scale.")}
      <form class="sheet-body form-stack" novalidate id="fIssue">
        <div class="say"><div class="field"><label for="say">Say or type it <span class="hint-i">optional</span></label><div class="say-row"><input class="input" id="say" placeholder="Issued 12.5 grams 22 carat to Imran for a bangle"><button class="btn btn--secondary" type="button" id="sayFill">Fill fields</button><button class="icon-btn" type="button" id="mic" aria-label="Speak" hidden>${ic("mic")}</button></div><p class="hint">Fields are filled for you to check. Nothing is saved until you press Issue.</p></div></div>
        <div class="field"><label for="iK">Karigar</label><select class="select" id="iK"><option value="">Choose…</option>${S.KARIGARS.map((k) => `<option>${esc(k)}</option>`).join("")}</select><p class="error" role="alert"></p></div>
        <div class="field"><label for="iItem">Item or job</label><input class="input" id="iItem"><p class="error" role="alert"></p></div>
        <div class="two"><div class="field"><label for="iG">Weight</label><div class="input-unit"><input class="input data" id="iG" inputmode="decimal" placeholder="0.000"><span class="unit">g</span></div><p class="error" role="alert"></p></div>
        <div class="field"><label for="iKt">Purity</label><select class="select" id="iKt"><option value="22">22K · 916</option><option value="24">24K · 999</option><option value="18">18K · 750</option><option value="14">14K · 585</option></select></div></div>
      </form>
      <div class="sheet-foot"><button class="btn btn--secondary" data-close>Cancel</button><button class="btn btn--primary" id="iGo">Issue gold</button></div>`);
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) { const mic = $("#mic", dlg); mic.hidden = false; mic.addEventListener("click", () => { const r = new SR(); r.lang = "en-IN"; r.onresult = (e) => { $("#say", dlg).value = e.results[0][0].transcript; fill(); }; r.onerror = () => toast("Voice not available", "Type the entry instead.", true); r.start(); }); }
    const fill = () => { const p = parseSay($("#say", dlg).value); if (p.grams) $("#iG", dlg).value = (+p.grams).toFixed(3); if (p.karat && [...$("#iKt", dlg).options].some((o) => o.value === p.karat)) $("#iKt", dlg).value = p.karat; if (p.karigar) $("#iK", dlg).value = p.karigar; if (p.item) $("#iItem", dlg).value = p.item[0].toUpperCase() + p.item.slice(1); };
    $("#sayFill", dlg).addEventListener("click", fill);
    $("#iGo", dlg).addEventListener("click", (e) => {
      const k = $("#iK", dlg), it = $("#iItem", dlg), gr = $("#iG", dlg);
      const ok = [fieldErr(k.closest(".field"), k.value ? "" : "Choose the karigar."), fieldErr(it.closest(".field"), it.value.trim() ? "" : "Describe the item or job."), fieldErr(gr.closest(".field"), +gr.value > 0 ? "" : "Enter the weight in grams.")].every(Boolean);
      if (!ok) { $("[aria-invalid]", dlg).focus(); return; }
      busy(e.currentTarget, "Issuing…", () => { const r = S.issue({ karigar: k.value, item: it.value, grams: gr.value, karat: $("#iKt", dlg).value }); dlg.close(); toast(`${r.id} issued`, `${(+gr.value).toFixed(3)} g to ${k.value}. Waiting for acknowledgement.`); });
    });
  }

  function dAck(id) {
    const t = S.get(id); const who = t.type === "issue" ? "your scale" : "the shop scale";
    const dlg = openDialog(`${head(`Acknowledge ${t.id}`, `${t.type === "issue" ? "Received from" : "Returned by"} ${esc(t.type === "issue" ? S.JEW : t.karigar)}`)}
      <form class="sheet-body form-stack" id="fAck" novalidate>
        <dl class="deflist"><dt>Item</dt><dd>${esc(t.item)}</dd><dt>${t.type === "issue" ? "Issued weight" : "Returned weight"}</dt><dd class="data">${g(t.grams)} g</dd><dt>Tolerance</dt><dd class="data">± ${S.TOL.toFixed(3)} g</dd></dl>
        <div class="field"><label for="aG">Weight on ${who}</label><div class="input-unit"><input class="input data" id="aG" inputmode="decimal" placeholder="0.000" autofocus><span class="unit">g</span></div><p class="hint">Weigh it yourself. Don't copy the figure above.</p><p class="error" role="alert"></p></div>
        <p class="live" id="aLive" aria-live="polite"></p>
      </form>
      <div class="sheet-foot"><button class="btn btn--secondary" data-close>Cancel</button><button class="btn btn--primary" id="aGo">Record reading</button></div>`);
    const inp = $("#aG", dlg), live = $("#aLive", dlg);
    inp.addEventListener("input", () => { const v = S.r3(+inp.value - t.grams); if (!(+inp.value > 0)) { live.textContent = ""; return; } const ok = Math.abs(v) <= S.TOL + 1e-9; live.className = "live " + (ok ? "ok" : "bad"); live.textContent = ok ? `Variance ${g(v)} g. Within tolerance.` : `Variance ${g(v)} g. Outside tolerance: this will be flagged to both parties.`; });
    $("#aGo", dlg).addEventListener("click", (e) => {
      if (!fieldErr(inp.closest(".field"), +inp.value > 0 ? "" : "Enter the weight shown on the scale.")) { inp.focus(); return; }
      busy(e.currentTarget, "Recording…", () => { const r = S.acknowledge(id, inp.value, meName); dlg.close(); r.within ? toast(`${id} acknowledged`, "Both readings are on the record.") : toast(`${id} flagged`, `Variance ${g(r.variance)} g is outside tolerance. Both parties can see it.`, true); });
    });
  }

  function dReturn() {
    const bal = S.balance(ME);
    const dlg = openDialog(`${head("Record a return", "Finished pieces or leftover metal going back to the jeweller.")}
      <form class="sheet-body form-stack" id="fRet" novalidate>
        <p class="notice">${ic("info")}<span>You currently hold <b class="data">${g(bal)} g</b>. The jeweller confirms the return on their scale.</span></p>
        <div class="field"><label for="rItem">What is being returned</label><input class="input" id="rItem" value="Finished piece"></div>
        <div class="field"><label for="rG">Weight</label><div class="input-unit"><input class="input data" id="rG" inputmode="decimal" placeholder="0.000"><span class="unit">g</span></div><p class="error" role="alert"></p></div>
      </form>
      <div class="sheet-foot"><button class="btn btn--secondary" data-close>Cancel</button><button class="btn btn--primary" id="rGo">Record return</button></div>`);
    $("#rGo", dlg).addEventListener("click", (e) => {
      const gr = $("#rG", dlg); let msg = +gr.value > 0 ? "" : "Enter the weight being returned."; if (!msg && +gr.value > bal + 1e-9) msg = `You hold ${g(bal)} g. A return can't be more than that.`;
      if (!fieldErr(gr.closest(".field"), msg)) { gr.focus(); return; }
      busy(e.currentTarget, "Recording…", () => { const r = S.ret({ karigar: ME, item: $("#rItem", dlg).value, grams: gr.value, karat: 22 }); dlg.close(); toast(`${r.id} recorded`, "Waiting for the jeweller to acknowledge."); });
    });
  }

  function dAssay(id) {
    const t = S.get(id), decl = t.karat === 22 ? 916 : +(t.karat / 24 * 1000).toFixed(1);
    const dlg = openDialog(`${head(`Record assay · ${t.id}`, esc(t.item))}
      <form class="sheet-body form-stack" id="fAs" novalidate>
        <dl class="deflist"><dt>Declared</dt><dd class="data">${t.karat}K · ${decl}</dd><dt>Weight</dt><dd class="data">${g(t.grams)} g</dd><dt>Requested by</dt><dd>${esc(t.assay.by)}</dd></dl>
        <div class="field"><label for="fF">Measured fineness</label><input class="input data" id="fF" inputmode="decimal" placeholder="916.0"><p class="hint">Parts per thousand. A difference of more than ${S.ASSAY_TOL} from the declared value is reported as a mismatch.</p><p class="error" role="alert"></p></div>
        <p class="live" id="fLive" aria-live="polite"></p>
      </form>
      <div class="sheet-foot"><button class="btn btn--secondary" data-close>Cancel</button><button class="btn btn--primary" id="fGo">Report result</button></div>`);
    const inp = $("#fF", dlg), live = $("#fLive", dlg);
    inp.addEventListener("input", () => { const v = +inp.value; if (!(v > 0)) { live.textContent = ""; return; } const ok = Math.abs(v - decl) <= S.ASSAY_TOL; live.className = "live " + (ok ? "ok" : "bad"); live.textContent = ok ? "Matches the declared purity." : `Differs from declared by ${(v - decl).toFixed(1)}. Reported as a mismatch.`; });
    $("#fGo", dlg).addEventListener("click", (e) => {
      const v = +inp.value; if (!fieldErr(inp.closest(".field"), v >= 300 && v <= 999.9 ? "" : "Enter a fineness between 300 and 999.9.")) { inp.focus(); return; }
      busy(e.currentTarget, "Reporting…", () => { const r = S.recordAssay(id, v); dlg.close(); toast(r.match ? "Verified" : "Mismatch reported", `${id} · fineness ${v.toFixed(1)}`, !r.match); });
    });
  }

  /* detail drawer: timeline, evidence, actions */
  function dDetail(id) {
    const t = S.get(id); if (!t) return;
    const v = S.variance(t), canAck = needsMe(t);
    const acts = [];
    if (canAck) acts.push(`<button class="btn btn--primary" data-act="ack" data-id="${id}">Acknowledge</button>`);
    if (t.status === "flagged") acts.push(`<button class="btn btn--danger" data-act="raise" data-id="${id}">Raise dispute</button>`);
    if ((t.status === "flagged" || t.status === "disputed") && !isAssayer) acts.push(`<button class="btn btn--secondary" data-act="resolve" data-id="${id}">Resolve</button>`);
    if (isJew && t.type === "issue" && t.status !== "pending" && !(t.assay && t.assay.state === "requested")) acts.push(`<button class="btn btn--secondary" data-act="reqassay" data-id="${id}">${ic("flask")} Request assay</button>`);
    if (isAssayer && t.assay && t.assay.state === "requested") acts.push(`<button class="btn btn--primary" data-act="assay" data-id="${id}">Record result</button>`);
    const dlg = openDialog(`${head(`<span class="data">${t.id}</span> · ${esc(t.item)}`, `${stageLabel(t)} · ${esc(t.karigar)} · ${t.karat}K`)}
      <div class="sheet-body detail">
        <div class="detail-status">${stat(t)}${t.assay && t.assay.state !== "none" ? assayStat(t.assay) : ""}</div>
        <dl class="triple"><div><dt>${t.type === "issue" ? "Issued" : "Returned"}</dt><dd class="data">${g(t.grams)} g</dd></div><div><dt>Other reading</dt><dd class="data">${t.ack == null ? "—" : g(t.ack) + " g"}</dd></div><div><dt>Variance</dt><dd class="data ${v && Math.abs(v) > S.TOL ? "neg" : ""}">${v == null ? "—" : g(v) + " g"}</dd></div></dl>
        ${t.resolved != null ? `<p class="notice">${ic("check")}<span>Agreed weight: <b class="data">${g(t.resolved)} g</b></span></p>` : ""}
        <h3 class="label sec">Timeline</h3>
        <ol class="timeline">${t.events.map((e) => `<li><span class="node ${e.kind}"></span><div><div class="when">${when(e.t)}</div><div class="what"><b>${esc(e.who)}</b> ${esc(e.text)}</div></div></li>`).join("")}</ol>
        <h3 class="label sec">Evidence</h3>
        ${t.evidence.length ? `<div class="chips">${t.evidence.map((n) => `<span class="chip">${ic("file")}<span class="data">${esc(n)}</span></span>`).join("")}</div>` : `<p class="muted-s">No attachments yet.</p>`}
        ${isAssayer ? "" : `<form class="note-form" id="noteF"><label class="sr" for="nt">Add a note</label><input class="input" id="nt" placeholder="Add a note to the record"><button class="btn btn--secondary" type="submit">Add</button><button class="btn btn--secondary" type="button" id="attachBtn">${ic("plus")} Attach file</button><input type="file" id="attachIn" accept="image/*,.pdf" hidden></form>`}
      </div>
      ${acts.length ? `<div class="sheet-foot">${acts.join("")}</div>` : ""}`, "drawer");
    const nf = $("#noteF", dlg);
    if (nf) {
      nf.addEventListener("submit", (e) => { e.preventDefault(); const v = $("#nt", dlg).value; if (S.addNote(id, meName, v).ok) { dlg.close(); dDetail(id); } });
      $("#attachBtn", dlg).addEventListener("click", () => $("#attachIn", dlg).click());
      $("#attachIn", dlg).addEventListener("change", (e) => { const f = e.target.files[0]; if (f) { S.attach(id, meName, f.name.slice(0, 40)); dlg.close(); dDetail(id); toast("Attached", "Only the file name is kept in this demo."); } });
    }
    dlg.addEventListener("click", (e) => { const b = e.target.closest("[data-act]"); if (b) { dlg.close(); act(b.dataset.act, b.dataset.id); } });
  }
  function dRaise(id) {
    const dlg = openDialog(`${head("Raise a dispute", id)}<form class="sheet-body form-stack" id="fR"><p class="body">Both parties will see this note on the timeline.</p><div class="field"><label for="rn">What is the issue?</label><textarea class="textarea" id="rn" placeholder="e.g. Scale display was photographed after tare."></textarea></div></form><div class="sheet-foot"><button class="btn btn--secondary" data-close>Cancel</button><button class="btn btn--danger-solid" id="rGo2">Raise dispute</button></div>`);
    $("#rGo2", dlg).addEventListener("click", (e) => busy(e.currentTarget, "Raising…", () => { S.dispute(id, meName, $("#rn", dlg).value); dlg.close(); toast("Dispute raised", `${id} is now in dispute.`); }));
  }
  function dResolve(id) {
    const t = S.get(id);
    const dlg = openDialog(`${head("Resolve the difference", id)}<form class="sheet-body form-stack"><p class="body">Choose the weight both parties agree to carry in the balance. This is added to the timeline; nothing is overwritten.</p><div class="segmented seg-col" role="radiogroup"><label><input type="radio" name="rc" value="issued" checked><span>Issued figure · <b class="data">${g(t.grams)} g</b></span></label><label><input type="radio" name="rc" value="received"><span>Received reading · <b class="data">${g(t.ack)} g</b></span></label></div></form><div class="sheet-foot"><button class="btn btn--secondary" data-close>Cancel</button><button class="btn btn--primary" id="rsGo">Record resolution</button></div>`);
    $("#rsGo", dlg).addEventListener("click", (e) => busy(e.currentTarget, "Saving…", () => { S.resolve(id, meName, $('input[name="rc"]:checked', dlg).value); dlg.close(); toast("Resolved", `${id} closed with an agreed weight.`); }));
  }

  function act(a, id) {
    ({ issue: dIssue, return: dReturn, ack: () => dAck(id), assay: () => dAssay(id), raise: () => dRaise(id), resolve: () => dResolve(id),
       reqassay: () => { S.requestAssay(id, meName); toast("Assay requested", `${id} is now in the assayer's queue.`); } })[a]();
  }

  /* ---------- events ---------- */
  document.addEventListener("click", (e) => {
    const a = e.target.closest("[data-act]"); if (a && !a.closest("dialog")) { act(a.dataset.act, a.dataset.id); return; }
    const o = e.target.closest("[data-open]"); if (o) { dDetail(o.dataset.open); return; }
    const pb = e.target.closest("[data-pb]"); if (pb) { ui.pbK = pb.dataset.pb; return; }
    const row = e.target.closest("tr[data-tx]"); if (row) { dDetail(row.dataset.tx); return; }
    if (e.target.closest("#resetDemo")) { S.reset(); toast("Demo data reset", "Sample entries restored."); }
  });
  document.addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && e.target.matches("tr[data-tx]")) { e.preventDefault(); dDetail(e.target.dataset.tx); } });
  document.addEventListener("change", (e) => { if (e.target.name === "flt") { ui.filter = e.target.value; render(); } if (e.target.id === "pbSel") { ui.pbK = e.target.value; render(); } });
  addEventListener("hashchange", () => { const v = location.hash.slice(1); if (NAV.some((n) => n[0] === v)) { view = v; render(); $("#main").focus({ preventScroll: true }); scrollTo(0, 0); } });
  S.subscribe(render);

  shell(); render();
})();
