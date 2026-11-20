/**
 * Header and Navigation Components
 * Tabler 1.7.4 Responsive Application Shell (integrated UI branding)
 */

import { Auth } from '../auth.js';
import { State } from '../state.js';

export function renderHeader() {
  const user = Auth.getUser();
  const isOnline = State.get('isOnline');
  const currentLang = State.get('lang');

  return `
    <header class="navbar navbar-expand-md d-print-none navbar-top">
      <div class="container-xl d-flex justify-content-between align-items-center">
        <!-- Mobile hamburger & brand -->
        <div class="d-flex align-items-center d-lg-none">
          <button id="menu-toggle" class="btn btn-icon btn-ghost-secondary me-2" aria-label="Toggle menu">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
          </button>
          <a href="#/dashboard" class="d-flex align-items-center text-decoration-none">
            <span class="brand-mark me-2" aria-hidden="true">S</span>
            <strong class="text-dark" style="letter-spacing:.08em;">SUCCESSION</strong>
          </a>
        </div>

        <!-- Desktop connectivity status pill -->
        <div class="d-none d-lg-flex align-items-center gap-3">
          <div class="connectivity-pill ${isOnline ? 'online' : 'offline'}">
            <span class="dot"></span>
            <span>${isOnline ? (State.t('common.online') || 'Connected') : (State.t('common.offline') || 'Offline')}</span>
          </div>
          <span class="text-muted text-xs">Verified records. Accountable settlements.</span>
        </div>

        <!-- Right Side: Language Picker & User Session -->
        <div class="navbar-nav flex-row align-items-center gap-2 ms-auto">
          <div class="nav-item">
            <select id="lang-picker" class="form-select form-select-sm" style="width: auto; min-width: 110px;" aria-label="Select language">
              <option value="en" ${currentLang === 'en' ? 'selected' : ''}>English</option>
              <option value="hi" ${currentLang === 'hi' ? 'selected' : ''}>Hindi</option>
              <option value="kn" ${currentLang === 'kn' ? 'selected' : ''}>Kannada</option>
            </select>
          </div>

          ${user ? `
            <div class="nav-item d-flex align-items-center gap-2 ms-2">
              <div class="avatar avatar-sm rounded" style="background:rgba(201,162,74,.15); color:#8A6420; border:1px solid rgba(138,100,32,.25);">
                ${user.name ? String(user.name).charAt(0).toUpperCase() : 'U'}
              </div>
              <div class="d-none d-md-block text-start lh-1">
                <div class="fw-bold fs-6 text-dark">${user.name || user.login || 'User'}</div>
                <div class="text-muted text-xs text-capitalize">${user.role || ''}</div>
              </div>
              <button id="logout-btn" class="btn btn-sm btn-outline-secondary ms-1 px-2 py-1" title="Logout" aria-label="Logout">
                Logout
              </button>
            </div>
          ` : `
            <a href="login.html" class="btn btn-sm btn-primary ms-1">Login</a>
          `}
        </div>
      </div>
    </header>
  `;
}

export function renderNav() {
  const role = Auth.getRole();
  const hash = window.location.hash || '#/dashboard';

  const isJeweller = role === 'jeweller';
  const isAssayer = role === 'assayer';

  return `
    <aside class="navbar navbar-vertical navbar-expand-lg" id="sidebar">
      <div class="container-fluid">
        <div class="navbar-brand">
          <a href="#/dashboard" class="d-flex align-items-center text-decoration-none">
            <span class="brand-mark" aria-hidden="true">S</span>
            <span class="ms-2" style="letter-spacing:.12em; font-weight:700;">SUCCESSION</span>
          </a>
        </div>

        <div class="collapse navbar-collapse" id="sidebar-menu">
          <ul class="navbar-nav pt-lg-3">
            <li class="nav-item ${hash.startsWith('#/dashboard') ? 'active' : ''}">
              <a class="nav-link ${hash.startsWith('#/dashboard') ? 'active' : ''}" href="#/dashboard">
                <span class="nav-link-icon" aria-hidden="true">&#9632;</span>
                <span class="nav-link-title">${State.t('nav.dashboard') || 'Dashboard'}</span>
              </a>
            </li>
            ${isAssayer ? `
            <li class="nav-item ${hash.startsWith('#/assayer/tasks') ? 'active' : ''}">
              <a class="nav-link ${hash.startsWith('#/assayer/tasks') ? 'active' : ''}" href="#/assayer/tasks">
                <span class="nav-link-icon" aria-hidden="true">&#9878;</span>
                <span class="nav-link-title">${State.t('nav.assayer_tasks') || 'Verification Tasks'}</span>
              </a>
            </li>
            ` : `
            <li class="nav-item ${hash.startsWith('#/orders') ? 'active' : ''}">
              <a class="nav-link ${hash.startsWith('#/orders') ? 'active' : ''}" href="#/orders">
                <span class="nav-link-icon" aria-hidden="true">&#9776;</span>
                <span class="nav-link-title">${State.t('nav.orders') || 'Orders'}</span>
              </a>
            </li>
            ${isJeweller ? `
            <li class="nav-item ${hash.startsWith('#/issue') ? 'active' : ''}">
              <a class="nav-link ${hash.startsWith('#/issue') ? 'active' : ''}" href="#/issue">
                <span class="nav-link-icon" aria-hidden="true">&#8599;</span>
                <span class="nav-link-title">${State.t('nav.issue_gold') || 'Issue Gold'}</span>
              </a>
            </li>
            ` : ''}
            <li class="nav-item ${hash.startsWith('#/return') ? 'active' : ''}">
              <a class="nav-link ${hash.startsWith('#/return') ? 'active' : ''}" href="#/return">
                <span class="nav-link-icon" aria-hidden="true">&#8601;</span>
                <span class="nav-link-title">${State.t('nav.return_gold') || 'Return Gold'}</span>
              </a>
            </li>
            <li class="nav-item ${hash.startsWith('#/passbook') ? 'active' : ''}">
              <a class="nav-link ${hash.startsWith('#/passbook') ? 'active' : ''}" href="#/passbook">
                <span class="nav-link-icon" aria-hidden="true">&#128214;</span>
                <span class="nav-link-title">${State.t('nav.passbook') || 'Passbook'}</span>
              </a>
            </li>
            `}
            <li class="nav-item ${hash.startsWith('#/disputes') ? 'active' : ''}">
              <a class="nav-link ${hash.startsWith('#/disputes') ? 'active' : ''}" href="#/disputes">
                <span class="nav-link-icon" aria-hidden="true">&#9878;</span>
                <span class="nav-link-title">${State.t('nav.disputes') || 'Disputes'}</span>
              </a>
            </li>
            ${!isAssayer ? `
            <li class="nav-item ${hash.startsWith('#/settlement') ? 'active' : ''}">
              <a class="nav-link ${hash.startsWith('#/settlement') ? 'active' : ''}" href="#/settlement">
                <span class="nav-link-icon" aria-hidden="true">&#10003;</span>
                <span class="nav-link-title">${State.t('nav.settlements') || 'Settlements'}</span>
              </a>
            </li>
            ` : ''}
            <li class="nav-item ${hash.startsWith('#/notifications') ? 'active' : ''}">
              <a class="nav-link ${hash.startsWith('#/notifications') ? 'active' : ''}" href="#/notifications">
                <span class="nav-link-icon" aria-hidden="true">&#128276;</span>
                <span class="nav-link-title">${State.t('nav.notifications') || 'Notifications'}</span>
              </a>
            </li>
            <li class="nav-item ${hash.startsWith('#/settings') ? 'active' : ''}">
              <a class="nav-link ${hash.startsWith('#/settings') ? 'active' : ''}" href="#/settings">
                <span class="nav-link-icon" aria-hidden="true">&#9881;</span>
                <span class="nav-link-title">${State.t('nav.settings') || 'Settings'}</span>
              </a>
            </li>
          </ul>
          <div class="mt-auto p-3 d-none d-lg-block text-xs" style="color:rgba(244,238,230,.55);">
            <div style="font-family:'Cormorant Garamond',serif; font-size:1rem; color:rgba(243,222,154,.9);">Trust in every gram</div>
            <div>Role-based, auditable workflows</div>
          </div>
        </div>
      </div>
    </aside>
  `;
}
