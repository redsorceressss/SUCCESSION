/**
 * Reactive Application State Store
 * Simple publish-subscribe state container for UI components.
 */

class StateStore {
  constructor() {
    this.state = {
      user: null,
      lang: localStorage.getItem('swarn_lang') || 'en',
      translations: {},
      isOnline: true,
      pendingOpsCount: 0,
      activeOrder: null,
      notifications: [],
    };
    this.subscribers = new Map();
  }

  get(key) {
    return this.state[key];
  }

  set(key, value) {
    const prev = this.state[key];
    this.state[key] = value;
    if (prev !== value) {
      this.notify(key, value, prev);
    }
  }

  update(partial) {
    for (const [key, val] of Object.entries(partial)) {
      this.set(key, val);
    }
  }

  subscribe(key, callback) {
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    this.subscribers.get(key).add(callback);
    return () => this.subscribers.get(key).delete(callback);
  }

  notify(key, val, prev) {
    if (this.subscribers.has(key)) {
      for (const cb of this.subscribers.get(key)) {
        try {
          cb(val, prev);
        } catch (e) {
          console.error(`State listener error for ${key}:`, e);
        }
      }
    }
  }

  t(path) {
    const keys = path.split('.');
    let curr = this.state.translations;
    for (const k of keys) {
      if (curr && typeof curr === 'object' && k in curr) {
        curr = curr[k];
      } else {
        return path; // Fallback to key
      }
    }
    return curr;
  }
}

export const State = new StateStore();
