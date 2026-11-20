/**
 * Login Screen
 * Tabler 1.7.4 Enterprise Design System
 * Authenticates users and stores session tokens in State & localStorage.
 */

import { Api } from '../api.js';
import { Auth } from '../auth.js';
import { State } from '../state.js';
import { Toast } from '../components/toast.js';
import { resumeAuthRequiredOps } from '../offline/queue.js';

export async function renderLogin() {
  return `
    <div class="page page-center" style="min-height: 80vh; background-color: var(--tblr-bg-surface, #FAF9F5);">
      <div class="container container-tight py-4">
        <!-- Brand Header with Antique Gold Seal -->
        <div class="text-center mb-4">
          <div class="d-inline-flex align-items-center justify-content-center avatar avatar-xl rounded-circle bg-white border mb-3 shadow-none" style="border-color: #B38822 !important;">
            <span style="font-size: 2rem; color: #B38822; font-family: 'Cinzel', Georgia, serif;">âšœ</span>
          </div>
          <h1 class="display-6 fw-bold text-dark tracking-wide mb-1" style="font-family: 'Cinzel', Georgia, serif; letter-spacing: 0.1em;">
            SUCCESSION
          </h1>
          <div class="text-uppercase tracking-wider text-muted fs-5 fw-semibold mb-2">
            Dual-Custody Gold Accounting Ledger
          </div>
          <div class="badge bg-secondary-subtle text-secondary px-3 py-1">
            Enterprise Cryptographic Authentication
          </div>
        </div>

        <!-- Login Card -->
        <div class="card card-md border shadow-none bg-white">
          <div class="card-body p-4">
            <h2 class="h3 text-center mb-4 fw-bold text-dark">
              ${State.t('auth.login_title') || 'Sign in to your account'}
            </h2>

            <form id="login-form" autocomplete="off">
              <div class="mb-3">
                <label class="form-label required" for="login-username">
                  ${State.t('auth.username') || 'Username or Login ID'}
                </label>
                <div class="input-icon">
                  <span class="input-icon-addon">
                    <svg class="icon" width="20" height="20" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><circle cx="12" cy="7" r="4"/><path d="M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2"/></svg>
                  </span>
                  <input type="text" id="login-username" class="form-control" required placeholder="Enter your username" autofocus autocomplete="username">
                </div>
              </div>

              <div class="mb-4">
                <label class="form-label required" for="login-password">
                  ${State.t('auth.password') || 'Cryptographic Password'}
                </label>
                <div class="input-icon">
                  <span class="input-icon-addon">
                    <svg class="icon" width="20" height="20" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><rect x="5" y="11" width="14" height="10" rx="2"/><circle cx="12" cy="16" r="1"/><path d="M8 11v-4a4 4 0 0 1 8 0v4"/></svg>
                  </span>
                  <input type="password" id="login-password" class="form-control" required placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢" autocomplete="current-password">
                </div>
              </div>

              <div class="form-footer">
                <button type="submit" id="login-submit-btn" class="btn btn-primary w-100 py-2 fs-4 fw-semibold" style="background-color: #14532D; border-color: #14532D;">
                  ${State.t('auth.login_button') || 'Sign In to Ledger'}
                </button>
              </div>
            </form>
          </div>

          <div class="card-footer py-3 bg-light text-center border-top">
            <span class="text-muted text-xs">Use your registered SUCCESSION account credentials.</span>
          </div>
        </div>

        <div class="text-center text-muted mt-3 fs-4">
          ${State.t('auth.no_account') || "Don't have an account yet?"}
          <a href="register.html" tabindex="-1" class="text-primary fw-semibold ms-1">
            Register new account
          </a>
        </div>
      </div>
    </div>
  `;
}

renderLogin.afterRender = () => {
  const form = document.getElementById('login-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('login-submit-btn');
    const username = document.getElementById('login-username')?.value.trim();
    const password = document.getElementById('login-password')?.value;

    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Authenticating Session...';
      }

      const res = await Api.login(username, password);
      Auth.setSession(res.access_token, res.user);
      State.set('user', res.user);

      try {
        await resumeAuthRequiredOps();
      } catch (resumeErr) {
        console.warn('Could not resume auth-paused offline operations on login:', resumeErr);
      }

      Toast.success(`Welcome back, ${res.user.name || res.user.login}!`);
      window.location.hash = '#/dashboard';
      window.location.reload();
    } catch (err) {
      Toast.error(err.message || 'Login failed. Please verify credentials.');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerText = State.t('auth.login_button') || 'Sign In to Ledger';
      }
    }
  });
};

