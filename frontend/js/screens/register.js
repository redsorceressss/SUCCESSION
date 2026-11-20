/**
 * Registration Screen
 * Tabler 1.7.4 Enterprise Design System
 * Onboards jewellers and karigars onto the dual-custody ledger.
 */

import { Api } from '../api.js';
import { State } from '../state.js';
import { Toast } from '../components/toast.js';

export async function renderRegister() {
  return `
    <div class="page page-center" style="min-height: 85vh; background-color: var(--tblr-bg-surface, #FAF9F5);">
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
            New Account Registration
          </div>
        </div>

        <!-- Registration Card -->
        <div class="card card-md border shadow-none bg-white">
          <div class="card-body p-4">
            <h2 class="h3 text-center mb-4 fw-bold text-dark">
              ${State.t('auth.register_title') || 'Create a New Ledger Account'}
            </h2>

            <form id="register-form" autocomplete="off">
              <div class="mb-3">
                <label class="form-label required" for="reg-username">
                  ${State.t('auth.username') || 'Desired Login ID'}
                </label>
                <input type="text" id="reg-username" class="form-control" required minlength="3" placeholder="e.g. suresh_karigar" autofocus autocomplete="username">
                <div class="form-hint text-muted">Minimum 3 characters, alphanumeric.</div>
              </div>

              <div class="mb-3">
                <label class="form-label required" for="reg-name">
                  ${State.t('auth.full_name') || 'Legal Name / Business Name'}
                </label>
                <input type="text" id="reg-name" class="form-control" required placeholder="e.g. Suresh Jewellery Works">
              </div>

              <div class="mb-3">
                <label class="form-label required" for="reg-role">
                  ${State.t('auth.role') || 'Custody Role'}
                </label>
                <select id="reg-role" class="form-select" required>
                  <option value="jeweller">${State.t('auth.role_jeweller') || 'Jeweller (Vault Custodian & Principal)'}</option>
                  <option value="karigar" selected>${State.t('auth.role_karigar') || 'Karigar (Craftsman & Manufacturing Custodian)'}</option>
                  <option value="assayer">${State.t('auth.role_assayer') || 'Assayer (Independent Verification Authority)'}</option>
                </select>
                <div class="form-hint text-muted">Determines access permissions and available workflows. Assayers perform independent reweigh verification only.</div>
              </div>

              <div class="mb-4">
                <label class="form-label required" for="reg-password">
                  ${State.t('auth.password') || 'Cryptographic Password'}
                </label>
                <input type="password" id="reg-password" class="form-control" required minlength="8" placeholder="Minimum 8 characters" autocomplete="new-password">
              </div>

              <div class="form-footer">
                <button type="submit" id="reg-submit-btn" class="btn btn-primary w-100 py-2 fs-4 fw-semibold" style="background-color: #14532D; border-color: #14532D;">
                  ${State.t('auth.register_button') || 'Complete Registration'}
                </button>
              </div>
            </form>
          </div>
        </div>

        <div class="text-center text-muted mt-3 fs-4">
          ${State.t('auth.have_account') || 'Already have a verified account?'}
          <a href="login.html" tabindex="-1" class="text-primary fw-semibold ms-1">
            Sign In here
          </a>
        </div>
      </div>
    </div>
  `;
}

renderRegister.afterRender = () => {
  const form = document.getElementById('register-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('reg-submit-btn');
    const login = document.getElementById('reg-username')?.value.trim();
    const name = document.getElementById('reg-name')?.value.trim();
    const role = document.getElementById('reg-role')?.value;
    const password = document.getElementById('reg-password')?.value;

    if (!login || !name || !password) {
      Toast.error('Please fill in all required registration fields.');
      return;
    }

    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Registering Account...';
      }

      await Api.register(login, name, password, role, State.get('lang') || 'en');
      Toast.success('Account created successfully! Please sign in with your credentials.');
      window.location.hash = '#/login';
    } catch (err) {
      Toast.error(err.message || 'Registration failed.');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerText = State.t('auth.register_button') || 'Complete Registration';
      }
    }
  });
};

