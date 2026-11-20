/**
 * SUCCESSION PWA Application Bootstrap
 * Orchestrates router, state store, translations, service worker, and offline sync.
 */

import { State } from './state.js';
import { Auth } from './auth.js';
import { Router } from './router.js';
import { renderHeader, renderNav } from './components/header.js';
import { Toast } from './components/toast.js';
import { initConnectivity, onStatusChange } from './offline/connectivity.js';
import { syncQueue, onSyncEvent } from './offline/sync.js';
import { request, API_BASE } from './api.js';
import { resumeAuthRequiredOps } from './offline/queue.js';

// Screen handlers
import { renderLogin } from './screens/login.js';
import { renderRegister } from './screens/register.js';
import { renderDashboard } from './screens/dashboard.js';
import { renderOrders } from './screens/orders.js';
import { renderOrderDetail } from './screens/order_detail.js';
import { renderIssue } from './screens/issue.js';
import { renderReturn } from './screens/return.js';
import { renderTransactionDetail } from './screens/transaction_detail.js';
import { renderConfirmation } from './screens/confirmation.js';
import { renderCorrection } from './screens/correction.js';
import { renderDispute } from './screens/dispute.js';
import { renderEvidence } from './screens/evidence.js';
import { renderPassbook } from './screens/passbook.js';
import { renderSettlement } from './screens/settlement.js';
import { renderNotifications } from './screens/notifications.js';
import { renderSettings } from './screens/settings.js';
import { renderError } from './screens/error.js';
import { renderAssayerTasks } from './screens/assayer_tasks.js';

// Public cinematic website (isolated from authenticated Tabler shell)
import { renderPublicHome } from './public/public-home.js';

async function loadTranslations(lang) {
  try {
    const res = await fetch(`js/i18n/${lang}.json`);
    const json = await res.json();
    State.set('translations', json);
  } catch (err) {
    console.warn(`Could not load translations for ${lang}, falling back to defaults:`, err);
  }
}

const PUBLIC_SECTION_HASHES = new Set(['#about', '#platform', '#how-it-works', '#world', '#preview', '#trust', '#beyond', '#final-cta', '#home']);
const STATIC_PUBLIC_REDIRECTS = new Set(['', '#', '#/', '#/home']);

function isPublicHomeHash(hash) {
  const h = (hash || '').split('?')[0];
  return h === '' || h === '#' || h === '#/' || h === '#/home' || PUBLIC_SECTION_HASHES.has(h);
}

function redirectToStaticPublicPage(hash) {
  const h = (hash || '').split('?')[0];
  const authed = Auth.isAuthenticated();
  if (h === '#/login' || h === '#/register') {
    window.location.replace(authed ? 'app.html#/dashboard' : (h === '#/login' ? 'login.html' : 'register.html'));
    return true;
  }
  if (STATIC_PUBLIC_REDIRECTS.has(h) || PUBLIC_SECTION_HASHES.has(h)) {
    if (authed && STATIC_PUBLIC_REDIRECTS.has(h)) {
      window.location.replace('app.html#/dashboard');
      return true;
    }
    const target = (h && PUBLIC_SECTION_HASHES.has(h) && h !== '#home') ? `home.html${h}` : 'home.html';
    window.location.replace(target);
    return true;
  }
  return false;
}

function bindAppShellEvents() {
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn && !logoutBtn.dataset.bound) {
    logoutBtn.dataset.bound = '1';
    logoutBtn.addEventListener('click', () => {
      Auth.clearSession();
      Toast.info('Logged out');
      window.location.hash = '#/login';
    });
  }

  const langPicker = document.getElementById('lang-picker');
  if (langPicker && !langPicker.dataset.bound) {
    langPicker.dataset.bound = '1';
    langPicker.addEventListener('change', async (e) => {
      const selected = e.target.value;
      localStorage.setItem('swarn_lang', selected);
      State.set('lang', selected);
      await loadTranslations(selected);
      window.location.reload();
    });
  }

  const menuToggle = document.getElementById('menu-toggle');
  const sidebar = document.getElementById('sidebar');
  if (menuToggle && sidebar && !menuToggle.dataset.bound) {
    menuToggle.dataset.bound = '1';
    menuToggle.addEventListener('click', () => {
      sidebar.classList.toggle('show');
    });
    // Dismiss sidebar when clicking outside it (on the overlay)
    document.addEventListener('click', (e) => {
      if (sidebar.classList.contains('show') && !sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
        sidebar.classList.remove('show');
      }
    });
  }
}

function ensureAppShell(shell) {
  if (!shell) return;
  if (document.getElementById('app-root') && shell.querySelector('.page-wrapper')) {
    bindAppShellEvents();
    return;
  }
  shell.innerHTML = `
    <div class="page">
      ${renderNav()}
      <div class="page-wrapper">
        ${renderHeader()}
        <main class="page-body p-0" id="app-root"></main>
        <footer class="footer footer-transparent d-print-none text-muted py-3 border-top mt-auto">
          <div class="container-xl d-flex justify-content-between align-items-center text-xs">
            <div>&copy; 2026 <strong>SUCCESSION</strong> - Dual-Custody Gold Ledger</div>
            <div class="d-none d-sm-block">Verified records. Accountable settlements.</div>
          </div>
        </footer>
      </div>
    </div>
  `;
  bindAppShellEvents();
}

let publicHomeCleanup = null;
async function showPublicHome(shell) {
  if (!shell) return;
  if (publicHomeCleanup) {
    try { publicHomeCleanup(); } catch {}
    publicHomeCleanup = null;
  }
  const html = await renderPublicHome();
  shell.innerHTML = typeof html === 'string' ? html : '';
  if (typeof renderPublicHome.afterRender === 'function') {
    publicHomeCleanup = await renderPublicHome.afterRender();
  }
}

export async function bootstrap() {
  const currentLang = State.get('lang') || 'en';
  await loadTranslations(currentLang);

  const user = Auth.getUser();
  if (user) {
    State.set('user', user);
    try {
      await resumeAuthRequiredOps();
    } catch (e) {
      console.warn('Could not resume auth-paused offline operations on bootstrap:', e);
    }
  }

  const shell = document.getElementById('app-shell');
  let router = null;

  async function handleModeAndRoute() {
    const hash = window.location.hash || '';
    // Prefer the new integrated static public/auth experience for canonical entry routes.
    if (redirectToStaticPublicPage(hash)) {
      return;
    }
    if (publicHomeCleanup) {
      try { publicHomeCleanup(); } catch {}
      publicHomeCleanup = null;
    }
    ensureAppShell(shell);
    if (!router) {
      router = new Router('app-root');
      router.register('/', async () => '', { auth: false });
      router.register('/home', async () => '', { auth: false });
      router.register('/login', renderLogin, { auth: false });
      router.register('/register', renderRegister, { auth: false });
      router.register('/dashboard', renderDashboard);
      router.register('/orders', renderOrders);
      router.register('/orders/:id', renderOrderDetail);
      router.register('/issue', renderIssue, { roles: ['jeweller'] });
      router.register('/return', renderReturn);
      router.register('/transactions/:id', renderTransactionDetail);
      router.register('/transactions/:id/confirm', renderConfirmation);
      router.register('/transactions/:id/correction', renderCorrection);
      router.register('/transactions/:id/dispute', renderDispute);
      router.register('/disputes', renderDispute);
      router.register('/disputes/:id', renderEvidence);
      router.register('/assayer/tasks', renderAssayerTasks, { roles: ['assayer'] });
      router.register('/passbook', renderPassbook);
      router.register('/settlement', renderSettlement);
      router.register('/settlements', renderSettlement);
      router.register('/notifications', renderNotifications);
      router.register('/settings', renderSettings);
      router.register('/error/:code', renderError, { auth: false });
      router.register('/error', renderError, { auth: false });
    }
    await router.handleRouting();
  }

  await handleModeAndRoute();
  window.addEventListener('hashchange', () => {
    handleModeAndRoute().catch((err) => console.error('Navigation error:', err));
  });

  initConnectivity(API_BASE);

  onStatusChange((isOnline) => {
    State.set('isOnline', isOnline);
    const badge = document.querySelector('.connectivity-badge');
    if (badge) {
      badge.className = `connectivity-badge ${isOnline ? 'online' : 'offline'}`;
      badge.innerHTML = `<span class="dot"></span><span>${isOnline ? 'Connected' : 'Offline'}</span>`;
    }
    if (isOnline) {
      syncQueue(request);
    }
  });

  onSyncEvent((event, data) => {
    if (event === 'item_synced') {
      Toast.success(`Synced offline ${data.op.endpoint}`);
    }
    if (event === 'item_synced' || event === 'sync_complete') {
      const currentHash = window.location.hash;
      if (currentHash === '#/dashboard') {
        window.dispatchEvent(new CustomEvent('succession:sync_refresh'));
      }
    }
  });

  if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
    navigator.serviceWorker
      .register('./service-worker.js')
      .then((reg) => console.log('ServiceWorker registered:', reg.scope))
      .catch((err) => console.warn('ServiceWorker registration failed:', err));
  }
}

// Start app once DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}

