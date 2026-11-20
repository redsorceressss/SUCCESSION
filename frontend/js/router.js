/**
 * Single Page Application Hash Router
 * Parses route paths and parameters, checks auth guards, and renders views.
 */

import { Auth } from './auth.js';

export class Router {
  constructor(rootElementId = 'app-root') {
    this.root = document.getElementById(rootElementId);
    this.routes = [];
    this.currentRoute = null;

    window.addEventListener('hashchange', () => this.handleRouting());
  }

  register(path, handler, options = {}) {
    // Convert path pattern like "/orders/:id" into regex
    const paramNames = [];
    const regexPath = path.replace(/:([a-zA-Z0-9_]+)/g, (_, name) => {
      paramNames.push(name);
      return '([^/]+)';
    });

    const regex = new RegExp(`^#?${regexPath}$`);
    this.routes.push({
      path,
      regex,
      paramNames,
      handler,
      authRequired: options.auth !== false, // default true
      roles: options.roles || [],
    });
  }

  navigate(hashPath) {
    window.location.hash = hashPath.startsWith('#') ? hashPath : `#${hashPath}`;
  }

  async handleRouting() {
    const rawHash = window.location.hash || '#/';
    const cleanHash = rawHash.split('?')[0];

    let matched = null;
    let params = {};

    for (const r of this.routes) {
      const match = cleanHash.match(r.regex);
      if (match) {
        matched = r;
        r.paramNames.forEach((name, i) => {
          params[name] = match[i + 1];
        });
        break;
      }
    }

    if (!matched) {
      const publicSectionHashes = new Set(['#about', '#platform', '#how-it-works', '#world', '#preview', '#trust', '#beyond', '#final-cta', '#home']);
      // Public root/home/section fallback for unknown routes: keep public visitors on public site,
      // preserve existing protected-route behavior for authenticated users.
      if (cleanHash === '' || cleanHash === '#' || cleanHash === '#/' || cleanHash === '#/home' || publicSectionHashes.has(cleanHash)) {
        // App-level handler renders public home for these hashes.
        return;
      }
      if (Auth.isAuthenticated()) {
        this.navigate('/dashboard');
      } else {
        this.navigate('/login');
      }
      return;
    }

    // Auth Guard
    if (matched.authRequired && !Auth.isAuthenticated()) {
      this.navigate('/login');
      return;
    }

    // Role Guard
    if (matched.roles.length > 0 && !matched.roles.includes(Auth.getRole())) {
      alert('Access Denied: You do not have permission to view this page.');
      this.navigate('/dashboard');
      return;
    }

    this.currentRoute = matched;

    // Render loading indicator briefly or call handler
    try {
      this.root.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
      const viewHtml = await matched.handler(params);
      if (typeof viewHtml === 'string') {
        this.root.innerHTML = viewHtml;
      }
      // Trigger tasteful page-enter transition (respects prefers-reduced-motion via CSS)
      this.root.classList.remove('page-enter');
      void this.root.offsetWidth;
      this.root.classList.add('page-enter');
      // Call post-render hook if screen module provides one
      if (typeof matched.handler.afterRender === 'function') {
        matched.handler.afterRender(params);
      }
    } catch (err) {
      console.error('Route rendering error:', err);
      this.root.innerHTML = `
        <div class="card error-card">
          <h3>Error Loading Page</h3>
          <p>${err.message}</p>
          <button class="btn btn-primary" onclick="window.location.hash='#/dashboard'">Return to Dashboard</button>
        </div>
      `;
    }
  }

  init() {
    this.handleRouting();
  }
}
