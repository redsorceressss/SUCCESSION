/**
 * SUCCESSION Authentication & Session Management
 * Serves both the Tabler authenticated SPA and the public login/registration forms.
 */

const TOKEN_KEY = 'swarn_auth_token';
const USER_KEY = 'swarn_user_profile';

export const Auth = {
  getToken() {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch (_) {
      return null;
    }
  },

  getUser() {
    try {
      const u = localStorage.getItem(USER_KEY);
      return u ? JSON.parse(u) : null;
    } catch (_) {
      return null;
    }
  },

  setSession(token, user) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch (_) {}
  },

  clearSession() {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      sessionStorage.removeItem('succession.session');
    } catch (_) {}
  },

  isAuthenticated() {
    return Boolean(this.getToken());
  },

  getRole() {
    const user = this.getUser();
    return user ? user.role : null;
  },

  isJeweller() {
    return this.getRole() === 'jeweller';
  },

  isKarigar() {
    return this.getRole() === 'karigar';
  },

  isAssayer() {
    return this.getRole() === 'assayer';
  },

  checkAuthorized(allowedRoles = []) {
    if (!this.isAuthenticated()) return false;
    if (allowedRoles.length === 0) return true;
    return allowedRoles.includes(this.getRole());
  },
};

if (typeof window !== 'undefined') {
  window.Auth = Auth;
}

/* =========================================================================
   Public Auth Form Handlers (login.html and register.html)
   ========================================================================= */

function initAuthForms() {
  if (typeof document === 'undefined') return;

  const $ = (s, r = document) => r.querySelector(s);
  const form = $('#loginForm') || $('#regForm');
  if (!form) return;

  const reg = form.id === 'regForm';
  const ROLE_NAME = {
    jeweller: 'Aurelia Jewellers',
    karigar: 'Ramesh Soni',
    assayer: 'Meera Assay Services'
  };

  function resolveApiBase() {
    if (typeof window !== 'undefined' && window.__API_BASE__) return window.__API_BASE__;
    if (typeof window !== 'undefined' && window.location) {
      if (window.location.port === '3000') {
        return window.location.protocol + '//' + window.location.hostname + ':8000';
      }
    }
    return '';
  }

  const err = (id, msg) => {
    const el = $('#' + id + '-err');
    const f = el && el.closest('.field');
    const inp = $('#' + id);
    if (el) el.textContent = msg || '';
    if (f) f.classList.toggle('has-error', !!msg);
    if (inp) {
      if (msg) inp.setAttribute('aria-invalid', 'true');
      else inp.removeAttribute('aria-invalid');
    }
    return !msg;
  };

  const rules = {
    email: (v) => (!v ? 'Enter your email or username.' : v.trim().length < 3 ? 'Enter at least 3 characters.' : ''),
    pw: (v) => (!v ? 'Enter your password.' : v.length < 8 ? 'Password must be at least 8 characters.' : ''),
    name: (v) => (!v || v.trim().length < 2 ? 'Enter your full name.' : ''),
    phone: (v) => (!v || !/^\+?[\d\s-]{8,15}$/.test(v.trim()) ? 'Enter a mobile number with 8–15 digits.' : '')
  };

  const ids = reg ? ['name', 'email', 'phone', 'pw'] : ['email', 'pw'];
  ids.forEach((id) => {
    const i = $('#' + id);
    if (!i) return;
    i.addEventListener('blur', () => err(id, rules[id] ? rules[id](i.value) : ''));
    i.addEventListener('input', () => {
      if (i.hasAttribute('aria-invalid') && rules[id]) {
        err(id, rules[id](i.value));
      }
    });
  });

  const tg = $('#pwToggle');
  if (tg) {
    tg.addEventListener('click', () => {
      const p = $('#pw');
      if (!p) return;
      const show = p.type === 'password';
      p.type = show ? 'text' : 'password';
      tg.textContent = show ? 'Hide' : 'Show';
      tg.setAttribute('aria-pressed', show);
      tg.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    });
  }

  // Pre-fill parameters if redirected from registration
  if (!reg && typeof window !== 'undefined' && window.location.search) {
    const params = new URLSearchParams(window.location.search);
    if (params.get('registered') === '1') {
      const email = params.get('email');
      const role = params.get('role');
      if (email && $('#email')) $('#email').value = email;
      if (role) {
        const rad = $(`input[name="role"][value="${role}"]`);
        if (rad) rad.checked = true;
      }
      const formErr = $('#formErr');
      if (formErr) {
        formErr.className = 'notice notice--good';
        formErr.textContent = 'Account created successfully. Please sign in with your password.';
        formErr.hidden = false;
      }
    }
  }

  if (reg) {
    const lab = { jeweller: 'Business name', karigar: 'Workshop name', assayer: 'Assay centre name' };
    form.querySelectorAll('input[name="role"]').forEach((r) => {
      r.addEventListener('change', () => {
        const bl = $('#bizLabel');
        if (bl) bl.textContent = lab[r.value] || 'Business name';
      });
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    let ok = ids.map((id) => {
      const inp = $('#' + id);
      return err(id, rules[id] ? rules[id](inp ? inp.value : '') : '');
    }).every(Boolean);

    if (reg) {
      const a = $('#agree');
      const good = a && a.checked;
      const agreeErr = $('#agree-err');
      if (agreeErr) agreeErr.textContent = good ? '' : 'Please accept the Terms and Privacy Policy to continue.';
      ok = ok && good;
    }

    if (!ok) {
      const bad = form.querySelector('[aria-invalid="true"]') || $('#agree');
      if (bad) bad.focus();
      return;
    }

    const roleRadio = form.querySelector('input[name="role"]:checked');
    const role = roleRadio ? roleRadio.value : 'jeweller';
    const btn = $('#submit');
    const formErr = $('#formErr');
    if (formErr) {
      formErr.hidden = true;
      formErr.textContent = '';
      formErr.className = 'form-error notice notice--bad';
    }

    if (btn) {
      btn.setAttribute('aria-busy', 'true');
      btn.disabled = true;
      btn.innerHTML = `<span class="spin" aria-hidden="true"></span><span class="lbl">${reg ? 'Creating account…' : 'Signing in…'}</span>`;
    }

    const email = ($('#email') ? $('#email').value : '').trim();
    const pw = $('#pw') ? $('#pw').value : '';

    if (reg) {
      // Registration flow
      const name = ($('#name') ? $('#name').value : '').trim();
      const biz = ($('#biz') ? $('#biz').value : '').trim();

      try {
        const res = await fetch(resolveApiBase() + '/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            login: email,
            name: name || biz || ROLE_NAME[role],
            password: pw,
            role: role,
            language: 'en'
          })
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (res.status === 409) {
            throw new Error('An account with this email/username already exists. Please sign in.');
          }
          throw new Error((data && (data.detail || data.message)) || 'Unable to create account. Please check details.');
        }

        window.location.href = `login.html?registered=1&email=${encodeURIComponent(email)}&role=${encodeURIComponent(role)}`;
      } catch (ex) {
        if (formErr) {
          formErr.textContent = ex.message || 'Registration failed. Please check network connectivity.';
          formErr.hidden = false;
        }
      } finally {
        if (btn) {
          btn.removeAttribute('aria-busy');
          btn.disabled = false;
          btn.innerHTML = '<span class="lbl">Create account</span>';
        }
      }
    } else {
      // Login flow: authenticates with FastAPI backend
      try {
        const res = await fetch(resolveApiBase() + '/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            login: email,
            password: pw
          })
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          const detail = (data && (data.detail || data.message)) || 'Invalid username or password.';
          throw new Error(detail);
        }

        if (!data || !data.access_token || !data.user) {
          throw new Error('Unexpected authentication response from server.');
        }

        Auth.setSession(data.access_token, data.user);
        sessionStorage.setItem('succession.session', JSON.stringify({
          role: data.user.role,
          name: data.user.name,
          id: data.user.id
        }));
        window.location.href = 'app.html#/dashboard';
      } catch (err) {
        if (formErr) {
          formErr.textContent = err.message || 'Unable to sign in. Please verify credentials.';
          formErr.hidden = false;
        }
      } finally {
        if (btn) {
          btn.removeAttribute('aria-busy');
          btn.disabled = false;
          btn.innerHTML = '<span class="lbl">Login</span>';
        }
      }
    }
  });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAuthForms);
  } else {
    initAuthForms();
  }
}
