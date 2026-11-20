import { createVaultExperience } from './vault-scene.js';

const PUBLIC_CSS = [
  'css/public/public-base.css',
  'css/public/public-layout.css',
  'css/public/public-vault.css',
  'css/public/public-world.css',
  'css/public/public-storytelling.css',
  'css/public/public-animations.css',
  'css/public/public-responsive.css',
];

function ensurePublicCss() {
  const added = [];
  PUBLIC_CSS.forEach((href) => {
    const existing = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).find(l => (l.getAttribute('href') || '').endsWith(href) || l.getAttribute('href') === href);
    if (existing) {
      if (!existing.dataset.pubPersistent) existing.dataset.pubDynamic = '1';
      return;
    }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.dataset.pubDynamic = '1';
    document.head.appendChild(link);
    added.push(link);
  });
  return () => {
    document.querySelectorAll('link[data-pub-dynamic="1"]').forEach((l) => l.remove());
  };
}

function sectionNavLink(href, label) {
  return `<a href="${href}" data-pub-nav>${label}</a>`;
}

export async function renderPublicHome() {
  return `
  <div class="public-site" id="public-site">
    <header class="public-nav" id="public-nav">
      <div class="public-container public-nav-inner">
        <a href="#/" class="pub-brand" aria-label="SUCCESSION home">
          <span class="pub-brand-mark" aria-hidden="true"></span>
          <span>SUCCESSION</span>
        </a>
        <button class="pub-btn pub-btn-ghost pub-nav-toggle" id="pub-nav-toggle" aria-expanded="false" aria-controls="pub-nav-links">Menu</button>
        <nav class="pub-nav-links" id="pub-nav-links" aria-label="Public navigation">
          ${sectionNavLink('#/', 'Home')}
          ${sectionNavLink('#about', 'About')}
          ${sectionNavLink('#platform', 'Platform')}
          ${sectionNavLink('#how-it-works', 'How it works')}
          <a href="#/login" class="pub-btn pub-btn-primary" style="padding:.55rem .95rem; font-size:.9rem;">Login</a>
        </nav>
      </div>
    </header>

    <main id="public-main">
      <section class="hero-section" id="home" aria-label="Cinematic vault hero">
        <div class="public-container hero-grid">
          <div class="hero-copy">
            <p class="pub-eyebrow reveal-up">Cinematic Public Experience</p>
            <h1 class="pub-h1 reveal-up" style="transition-delay:.05s">TRUST, BUILT INTO EVERY TRANSACTION.</h1>
            <p class="pub-lead reveal-up" style="transition-delay:.1s">One connected platform for transparent gold-trade operations, verified records and accountable settlements.</p>
            <div class="hero-actions reveal-up" style="transition-delay:.15s">
              <button class="pub-btn pub-btn-primary" id="explore-btn">EXPLORE SUCCESSION</button>
              <a class="pub-btn pub-btn-ghost" href="#platform" data-scroll-to="platform">DISCOVER THE PLATFORM</a>
              <a class="pub-btn" href="#/login">Login</a>
            </div>
            <div class="hero-meta reveal-up" style="transition-delay:.2s">
              <span>Interactive mechanical vault</span>
              <span>Verified records & workflows</span>
              <span>Role-based access preserved</span>
            </div>
          </div>
          <div class="hero-vault-wrap" aria-label="Interactive vault scene">
            <div id="vault-canvas-container" aria-label="Vault 3D scene container"></div>
            <div class="vault-fallback" id="vault-fallback" aria-hidden="true">
              <div class="vault-fallback-door"><div class="vault-fallback-dial"></div></div>
            </div>
            <div class="vault-overlay-ui">
              <div class="vault-unlocked-badge" id="vault-status">Dial locked • Drag to unlock</div>
              <button class="pub-btn pub-btn-ghost vault-skip" id="skip-intro-btn" type="button">Skip intro</button>
              <div class="vault-hint" id="vault-hint">Drag the brass dial, or focus it and use Left/Right arrows to rotate. Press Enter or Space to unlock.</div>
              <p id="vault-dial-instructions" class="sr-only">Vault combination dial. Use mouse or touch drag to rotate the dial. When focused, press Left or Right Arrow keys to rotate, and press Enter or Space to unlock and open the vault. Press Skip intro to bypass the sequence.</p>
              <div id="vault-live" class="sr-only" aria-live="polite" aria-atomic="true"></div>
            </div>
          </div>
        </div>
        <div class="hero-scroll-cue">Scroll / Explore</div>
      </section>

      <div class="pub-divider"></div>

      <section class="pub-section" id="beyond">
        <div class="public-container pub-grid-2">
          <div class="reveal-up">
            <p class="pub-eyebrow">Reveal</p>
            <h2 class="pub-h2">BEYOND RECORD KEEPING. BUILT FOR TRUST.</h2>
          </div>
          <div class="reveal-up" style="transition-delay:.08s">
            <p class="pub-lead">SUCCESSION brings transparency and accountability to gold-trade operations by connecting transaction records, confirmations, corrections, disputes, independent verification, and settlements in one shared workflow.</p>
            <p class="pub-muted" style="margin-top:1rem; line-height:1.7">Every critical step is designed to preserve context, clarify responsibility, and support authorized resolution—so trust is built into the process, not added after the fact.</p>
          </div>
        </div>
      </section>

      <section class="pub-section" id="about">
        <div class="public-container">
          <div class="reveal-up" style="max-width:760px; margin-bottom:1.5rem;">
            <p class="pub-eyebrow">What is SUCCESSION?</p>
            <h2 class="pub-h2">A connected workflow for the gold-trade ecosystem.</h2>
            <p class="pub-lead">SUCCESSION connects jewellers, karigars, and independent assayers through a shared platform for transparent transaction operations and accountable outcomes.</p>
          </div>
          <div class="pub-grid-3">
            <article class="feature-card reveal-up"><h3 class="pub-h3">Jeweller</h3><p>Initiates and manages trade operations, records transaction details, reviews confirmations, and participates in authorized settlement workflows.</p></article>
            <article class="feature-card reveal-up" style="transition-delay:.05s"><h3 class="pub-h3">Karigar</h3><p>Reviews recorded transactions, confirms details, requests corrections when needed, and participates transparently in dispute and resolution processes.</p></article>
            <article class="feature-card reveal-up" style="transition-delay:.1s"><h3 class="pub-h3">Assayer</h3><p>Performs independent verification tasks when assigned, reviews permitted evidence, records reweigh/verification results, and supports accountable resolution.</p></article>
          </div>
        </div>
      </section>

      <section class="pub-section world-section" id="world">
        <div class="public-container">
          <div class="reveal-up" style="max-width:760px; margin-bottom:1.5rem;">
            <p class="pub-eyebrow">Immersive Environment</p>
            <h2 class="pub-h2">Enter the world of verification and trust.</h2>
            <p class="pub-lead">Explore key environments that represent how SUCCESSION supports recording, review, verification, and settlement—each mapped to real platform capabilities.</p>
          </div>
          <div class="world-grid">
            <article class="world-card reveal-up"><span class="world-tag">Transaction Workshop</span><h3 class="pub-h3">Record & Review</h3><p>Transaction details are created and shared with relevant parties for confirmation, correction, or dispute.</p><div class="world-scene-visual" aria-hidden="true"></div></article>
            <article class="world-card reveal-up" style="transition-delay:.05s"><span class="world-tag">Passbook Archive</span><h3 class="pub-h3">Traceable Records</h3><p>Digital passbooks organize transaction history and provide visibility into recorded, verified, and accountable activity.</p><div class="world-scene-visual" aria-hidden="true"></div></article>
            <article class="world-card reveal-up" style="transition-delay:.1s"><span class="world-tag">Assayer Chamber</span><h3 class="pub-h3">Independent Verification</h3><p>Assigned assayers review permitted evidence and record independent reweigh/verification outcomes within authorized scope.</p><div class="world-scene-visual" aria-hidden="true"></div></article>
            <article class="world-card reveal-up" style="transition-delay:.15s"><span class="world-tag">Settlement Operations</span><h3 class="pub-h3">Authorized Outcomes</h3><p>Verified records and authorized resolutions support accountable settlement workflows; disputed amounts are not auto-settled.</p><div class="world-scene-visual" aria-hidden="true"></div></article>
          </div>
        </div>
      </section>

      <section class="pub-section" id="platform">
        <div class="public-container">
          <div class="reveal-up" style="max-width:760px; margin-bottom:1.5rem;">
            <p class="pub-eyebrow">Platform Features</p>
            <h2 class="pub-h2">Interactive product storytelling, grounded in real workflows.</h2>
            <p class="pub-lead">Each capability below reflects implemented SUCCESSION workflows and controls (transactions, confirmations/corrections, disputes, evidence, assayer verification, settlements, passbooks, and role-based access).</p>
          </div>
          <div class="story-grid">
            <article class="story-card reveal-up">
              <div class="story-visual"><div class="story-scale"></div><div class="story-orbit"></div><div class="story-bars"><span style="width:90%"></span><span></span><span></span></div></div>
              <h3 class="pub-h3">Transactions & Recording</h3>
              <p>Record key transaction details and share them with relevant parties for review. Original records are preserved through the workflow.</p>
            </article>
            <article class="story-card reveal-up" style="transition-delay:.05s">
              <div class="story-visual"><div class="story-bars"><span style="width:95%"></span><span style="width:78%"></span><span style="width:88%"></span></div></div>
              <h3 class="pub-h3">Digital Passbooks</h3>
              <p>Maintain traceable transaction history and party-visible records to support transparency and accountability over time.</p>
            </article>
            <article class="story-card reveal-up" style="transition-delay:.1s">
              <div class="story-visual"><div class="story-bars"><span style="width:92%"></span><span style="width:60%"></span><span style="width:70%"></span></div></div>
              <h3 class="pub-h3">Confirmations, Corrections & Disputes</h3>
              <p>Parties can confirm, request correction, or dispute. Notes and evidence can be recorded; disputed amounts are not automatically settled.</p>
              <div class="dispute-example"><strong>Example:</strong> Jeweller records <strong>50.00 g</strong>, karigar reports <strong>49.85 g</strong> → transaction marked disputed → reweigh/verification requested → evidence and verification recorded.</div>
            </article>
            <article class="story-card reveal-up" style="transition-delay:.15s">
              <div class="story-visual"><div class="story-orbit"></div><div class="story-bars"><span style="width:86%"></span><span style="width:72%"></span><span style="width:92%"></span></div></div>
              <h3 class="pub-h3">Independent Assayer Verification</h3>
              <p>Assigned assayers review permitted evidence, record reweigh/independent results, and submit verification status. Assayers cannot modify original transactions or independently approve financial settlement.</p>
            </article>
            <article class="story-card reveal-up" style="transition-delay:.2s">
              <div class="story-visual"><div class="story-bars"><span style="width:88%"></span><span style="width:66%"></span><span style="width:94%"></span></div></div>
              <h3 class="pub-h3">Settlements</h3>
              <p>Authorized and resolved records can proceed through settlement workflows. Disputes require authorized resolution before automatic settlement of disputed amounts.</p>
            </article>
            <article class="story-card reveal-up" style="transition-delay:.25s">
              <div class="story-visual"><div class="story-bars"><span style="width:80%"></span><span style="width:74%"></span><span style="width:82%"></span></div></div>
              <h3 class="pub-h3">AI-assisted Workflows (where implemented)</h3>
              <p>SUCCESSION includes AI-assisted support components in the existing application context where implemented. This public page does not claim additional AI capabilities, integrations, or accuracy guarantees beyond verified behavior.</p>
            </article>
          </div>
        </div>
      </section>

      <section class="pub-section" id="how-it-works">
        <div class="public-container pub-grid-2">
          <div class="reveal-up">
            <p class="pub-eyebrow">How it works</p>
            <h2 class="pub-h2">A transparent workflow from record to settlement.</h2>
            <p class="pub-lead">A clear sequence of review, verification, and authorized resolution keeps operations accountable.</p>
          </div>
          <div class="timeline reveal-up" style="transition-delay:.08s">
            <div class="timeline-step"><div class="timeline-num">1</div><div><strong>Transaction created</strong><p>Transaction details are recorded and shared with relevant parties.</p></div></div>
            <div class="timeline-step"><div class="timeline-num">2</div><div><strong>Other party reviews</strong><p>The counterparty reviews the recorded information.</p></div></div>
            <div class="timeline-step"><div class="timeline-num">3</div><div><strong>Confirm / Correct / Dispute</strong><p>Parties confirm, request correction, or raise a dispute with preserved records.</p></div></div>
            <div class="timeline-step"><div class="timeline-num">4</div><div><strong>Independent verification (if required)</strong><p>Authorized assayers can review permitted evidence and submit verification results.</p></div></div>
            <div class="timeline-step"><div class="timeline-num">5</div><div><strong>Authorized resolution</strong><p>Disputes follow the authorized workflow and controls.</p></div></div>
            <div class="timeline-step"><div class="timeline-num">6</div><div><strong>Settlement</strong><p>Eligible, authorized outcomes proceed to settlement.</p></div></div>
          </div>
        </div>
      </section>

      <section class="pub-section" id="preview">
        <div class="public-container">
          <div class="reveal-up" style="max-width:760px; margin-bottom:1.5rem;">
            <p class="pub-eyebrow">Product Preview</p>
            <h2 class="pub-h2">Actual application areas, presented clearly.</h2>
            <p class="pub-lead">The authenticated SUCCESSION application includes dashboards, transactions, disputes/evidence, assayer verification tasks, passbooks, and settlements. Where live captures are not embedded here, previews below are <strong>clearly labeled conceptual visualizations</strong> (not fabricated screenshots of implemented UI states).</p>
          </div>
          <div class="preview-grid">
            <article class="preview-frame reveal-up"><div class="preview-mock"></div><div><h3 class="pub-h3">Dashboard</h3><p class="pub-muted">Role-specific operational overview (conceptual visualization).</p></div></article>
            <article class="preview-frame reveal-up" style="transition-delay:.04s"><div class="preview-mock"></div><div><h3 class="pub-h3">Transaction Details</h3><p class="pub-muted">Recorded values, versions, and workflow actions (conceptual visualization).</p></div></article>
            <article class="preview-frame reveal-up" style="transition-delay:.08s"><div class="preview-mock"></div><div><h3 class="pub-h3">Dispute Workflow</h3><p class="pub-muted">Dispute context, notes, and resolution steps (conceptual visualization).</p></div></article>
            <article class="preview-frame reveal-up" style="transition-delay:.12s"><div class="preview-mock"></div><div><h3 class="pub-h3">Assayer Verification</h3><p class="pub-muted">Assigned tasks, scoped evidence, and verification status (conceptual visualization).</p></div></article>
            <article class="preview-frame reveal-up" style="transition-delay:.16s"><div class="preview-mock"></div><div><h3 class="pub-h3">Digital Passbook</h3><p class="pub-muted">Traceable transaction history and records (conceptual visualization).</p></div></article>
            <article class="preview-frame reveal-up" style="transition-delay:.2s"><div class="preview-mock"></div><div><h3 class="pub-h3">Settlement Interface</h3><p class="pub-muted">Authorized settlement workflow visibility (conceptual visualization).</p></div></article>
          </div>
        </div>
      </section>

      <section class="pub-section" id="trust">
        <div class="public-container">
          <div class="reveal-up" style="max-width:760px; margin-bottom:1.5rem;">
            <p class="pub-eyebrow">Trust and Accountability</p>
            <h2 class="pub-h2">Controls that support transparent operations.</h2>
            <p class="pub-lead">SUCCESSION emphasizes verified, role-appropriate workflows. Statements below reflect implemented/verified platform capabilities and controls—without unsupported security guarantees.</p>
          </div>
          <div class="pub-grid-3">
            <article class="trust-card reveal-up"><h3 class="pub-h3">Role-based access</h3><p>Authenticated routes and actions are constrained by user roles and authorization checks.</p></article>
            <article class="trust-card reveal-up" style="transition-delay:.04s"><h3 class="pub-h3">Transaction accountability</h3><p>Records, confirmations, corrections, and disputes are handled through explicit workflows that preserve context.</p></article>
            <article class="trust-card reveal-up" style="transition-delay:.08s"><h3 class="pub-h3">Evidence preservation</h3><p>Dispute-related evidence and notes can be associated with workflows to support review and verification.</p></article>
            <article class="trust-card reveal-up" style="transition-delay:.12s"><h3 class="pub-h3">Audit records</h3><p>Key actions (including assignment and evidence access in verification workflows) are recorded for accountability.</p></article>
            <article class="trust-card reveal-up" style="transition-delay:.16s"><h3 class="pub-h3">Dispute handling</h3><p>Disputed amounts are not automatically settled; resolution follows authorized processes.</p></article>
            <article class="trust-card reveal-up" style="transition-delay:.2s"><h3 class="pub-h3">Independent verification permissions</h3><p>Assayer access and actions are scoped to authorized assignments and cannot override original records or financial approvals.</p></article>
          </div>
        </div>
      </section>

      <section class="pub-section" id="final-cta">
        <div class="public-container" style="text-align:center;">
          <div class="reveal-up" style="max-width:820px; margin:0 auto;">
            <p class="pub-eyebrow">Enter SUCCESSION</p>
            <h2 class="pub-h2">OPEN THE DOOR TO MORE TRANSPARENT TRADE.</h2>
            <p class="pub-lead" style="margin:1rem auto 1.6rem;">Bring transaction records, verification and settlements into one connected workflow.</p>
            <div class="hero-actions" style="justify-content:center;">
              <a href="#/" class="pub-btn pub-btn-primary" id="explore-again-btn">EXPLORE SUCCESSION</a>
              <a href="#/login" class="pub-btn pub-btn-ghost">LOGIN</a>
            </div>
          </div>
        </div>
      </section>
    </main>

    <footer class="public-footer">
      <div class="public-container footer-grid">
        <div>
          <div class="pub-brand" style="margin-bottom:.75rem;"><span class="pub-brand-mark" aria-hidden="true"></span><span>SUCCESSION</span></div>
          <p class="pub-muted" style="margin:0; line-height:1.7; max-width:48ch;">A connected platform for transparent gold-trade operations, verified records, and accountable settlements.</p>
        </div>
        <div>
          <p class="pub-eyebrow" style="margin-bottom:.6rem;">Navigate</p>
          <div class="footer-links">
            <a href="#/">Home</a>
            <a href="#about">About</a>
            <a href="#platform">Platform</a>
            <a href="#how-it-works">How it works</a>
            <a href="#/login">Login</a>
          </div>
        </div>
        <div>
          <p class="pub-eyebrow" style="margin-bottom:.6rem;">Application</p>
          <div class="footer-links">
            <a href="#/login">Access existing login</a>
            <a href="#/dashboard">Dashboard (authenticated)</a>
            <a href="#/disputes">Disputes (authenticated)</a>
          </div>
          <p class="pub-muted" style="margin-top:1rem; font-size:.9rem;">Contact and legal links shown only when verified/available in the project.</p>
        </div>
      </div>
      <div class="public-container" style="margin-top:1.5rem; color:rgba(243,237,226,0.45); font-size:.85rem;">&copy; 2026 SUCCESSION. Cinematic public experience for verified gold-trade workflows.</div>
    </footer>
  </div>`;
}

renderPublicHome.afterRender = async function afterRenderPublicHome() {
  const removeCss = ensurePublicCss();
  document.body.classList.add('public-mode');

  const nav = document.getElementById('public-nav');
  const navToggle = document.getElementById('pub-nav-toggle');
  const navLinks = document.getElementById('pub-nav-links');
  const onScrollNav = () => {
    if (!nav) return;
    if (window.scrollY > 12) nav.classList.add('scrolled');
    else nav.classList.remove('scrolled');
  };
  window.addEventListener('scroll', onScrollNav, { passive: true });
  onScrollNav();

  const onToggle = () => {
    if (!navLinks || !navToggle) return;
    const open = navLinks.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  };
  navToggle?.addEventListener('click', onToggle);

  // In-page anchor scrolling for section links (hash anchors like #about)
  const scrollToId = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  };

  const onDocClick = (e) => {
    const a = e.target.closest('a[data-scroll-to], a[href^="#about"], a[href^="#platform"], a[href^="#how-it-works"], a[href^="#world"], a[href^="#preview"], a[href^="#trust"], a[href^="#beyond"]');
    if (!a) return;
    const href = a.getAttribute('href') || '';
    if (href === '#/' || href === '#/home') return;
    if (href.startsWith('#/')) return; // app routes
    if (href.startsWith('#')) {
      const id = href.replace('#', '');
      if (document.getElementById(id)) {
        e.preventDefault();
        history.replaceState(null, '', href);
        scrollToId(id);
        navLinks?.classList.remove('open');
        navToggle?.setAttribute('aria-expanded', 'false');
      }
    }
  };
  document.addEventListener('click', onDocClick);

  // Reveal animations
  const revealEls = Array.from(document.querySelectorAll('.reveal-up, .fade-in'));
  let io = null;
  if ('IntersectionObserver' in window) {
    io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    revealEls.forEach(el => io.observe(el));
  } else {
    revealEls.forEach(el => el.classList.add('in-view'));
  }

  // Vault
  const vaultContainer = document.getElementById('vault-canvas-container');
  const vaultFallback = document.getElementById('vault-fallback');
  const vaultHint = document.getElementById('vault-hint');
  const vaultStatus = document.getElementById('vault-status');
  const vaultLive = document.getElementById('vault-live');
  const skipBtn = document.getElementById('skip-intro-btn');
  const exploreBtn = document.getElementById('explore-btn');
  let vault = null;
  let dialKeyHandler = null;
  let dialFocusTarget = null;

  const announce = (text) => { if (vaultLive) vaultLive.textContent = text || ''; };
  const setVaultStatus = (text, announceText = null) => {
    if (vaultStatus) vaultStatus.textContent = text;
    if (announceText !== null) announce(announceText);
  };

  const onUnlocked = () => {
    setVaultStatus('Unlocked • Opening vault', 'Vault unlocked. Opening sequence started.');
    if (vaultHint) vaultHint.textContent = 'Vault unlocked. Entering SUCCESSION...';
  };
  const onOpened = () => {
    setVaultStatus('Open • Welcome to SUCCESSION', 'Vault open. You can scroll to explore the platform.');
    if (vaultHint) {
      vaultHint.textContent = 'Vault open. Scroll to explore the platform.';
      setTimeout(() => { if (vaultHint) vaultHint.style.opacity = '0'; }, 2200);
    }
    // Transition into experience
    setTimeout(() => scrollToId('beyond'), 350);
  };

  if (vaultContainer) {
    try {
      vault = createVaultExperience(vaultContainer, { onUnlock: onUnlocked, onOpened: onOpened });
      if (vault && vault.fallbackNeeded) {
        vaultFallback?.classList.add('active');
        vaultFallback?.setAttribute('role', 'slider');
        vaultFallback?.setAttribute('aria-label', 'SUCCESSION vault dial (preview mode)');
        vaultFallback?.setAttribute('aria-describedby', 'vault-dial-instructions');
        vaultFallback?.setAttribute('tabindex', '0');
        setVaultStatus('Vault preview mode (WebGL unavailable)', 'Vault preview mode. Use arrow keys or Enter to unlock.');
        if (vaultHint) vaultHint.textContent = 'WebGL unavailable. Focus the vault and use Left/Right arrows or Enter/Space to unlock, or use Skip intro.';
        dialFocusTarget = vaultFallback;
        dialKeyHandler = (e) => {
          if (!vault) return;
          const st = vault.getState ? vault.getState() : null;
          if (st?.unlocked) return;
          if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            const dir = (e.key === 'ArrowRight' || e.key === 'ArrowUp') ? 1 : -1;
            const step = e.shiftKey ? (Math.PI / 12) : (Math.PI / 24);
            vault.rotateDial?.(dir * step);
            const pct = Math.round(Math.min(1, (vault.getState?.().dialProgress || 0)) * 100);
            setVaultStatus(`Dial rotating • ${pct}%`, `Dial rotated to ${pct} percent.`);
          } else if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            vault.activateDial?.();
            setVaultStatus('Unlocking vault...', 'Unlocking vault.');
          }
        };
        dialFocusTarget?.addEventListener('keydown', dialKeyHandler);
      } else {
        // Keyboard-operable dial interaction (in addition to drag/touch)
        dialFocusTarget = vaultContainer.querySelector('canvas') || vaultContainer;
        if (dialFocusTarget) {
          if (!dialFocusTarget.hasAttribute('tabindex')) dialFocusTarget.setAttribute('tabindex', '0');
          dialKeyHandler = (e) => {
            if (!vault || vault.fallbackNeeded) return;
            const st = vault.getState ? vault.getState() : null;
            if (st?.unlocked) return;
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
              e.preventDefault();
              const dir = (e.key === 'ArrowRight' || e.key === 'ArrowUp') ? 1 : -1;
              const step = e.shiftKey ? (Math.PI / 12) : (Math.PI / 24); // larger step with Shift
              vault.rotateDial?.(dir * step);
              const pct = Math.round(Math.min(1, (vault.getState?.().dialProgress || 0)) * 100);
              setVaultStatus(`Dial rotating • ${pct}%`, `Dial rotated to ${pct} percent.`);
              if (vaultHint) vaultHint.textContent = 'Keep rotating with arrow keys, or press Enter/Space to unlock.';
            } else if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              vault.activateDial?.();
              setVaultStatus('Unlocking vault...', 'Unlocking vault.');
            }
          };
          dialFocusTarget.addEventListener('keydown', dialKeyHandler);
        }
      }
    } catch (err) {
      console.warn('Vault 3D initialization failed, using fallback:', err);
      vaultFallback?.classList.add('active');
      setVaultStatus('Vault preview mode', 'Vault preview mode.');
      if (vaultHint) vaultHint.textContent = 'Explore the platform sections below or log in to the application.';
    }
  }

  skipBtn?.addEventListener('click', () => {
    try { vault?.skipIntro?.(); } catch {}
    setVaultStatus('Intro skipped', 'Intro skipped. Scrolling to content.');
    if (vaultHint) vaultHint.style.opacity = '0';
    scrollToId('beyond');
  });

  exploreBtn?.addEventListener('click', () => {
    // Encourage dial interaction; if already unlocked/open or fallback, proceed
    const st = vault?.getState ? vault.getState() : null;
    if (!vault || vault.fallbackNeeded || (st && (st.unlocked || st.opening > 0.2))) {
      scrollToId('beyond');
      return;
    }
    if (vaultHint) {
      vaultHint.textContent = 'Drag the dial, use Left/Right arrow keys when focused, or press Enter/Space to unlock. Skip intro is also available.';
      vaultHint.style.opacity = '1';
    }
    vaultContainer?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
    // Move focus to dial for keyboard users
    setTimeout(() => { try { dialFocusTarget?.focus?.(); } catch {} }, 300);
  });

  document.getElementById('explore-again-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  });

  // If landing with section hash (e.g. #about), scroll after render
  const initialHash = (window.location.hash || '').replace('#', '');
  if (initialHash && !initialHash.startsWith('/') && document.getElementById(initialHash)) {
    setTimeout(() => scrollToId(initialHash), 50);
  }

  return function cleanupPublicHome() {
    window.removeEventListener('scroll', onScrollNav);
    navToggle?.removeEventListener('click', onToggle);
    document.removeEventListener('click', onDocClick);
    if (io) try { io.disconnect(); } catch {}
    if (dialFocusTarget && dialKeyHandler) {
      try { dialFocusTarget.removeEventListener('keydown', dialKeyHandler); } catch {}
    }
    try { vault?.dispose?.(); } catch {}
    document.body.classList.remove('public-mode');
    removeCss();
  };
};