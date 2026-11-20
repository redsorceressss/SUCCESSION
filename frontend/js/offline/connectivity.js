/**
 * Connectivity Monitor
 * Tracks online/offline browser state and verifies connectivity with backend ping.
 */

let onlineStatus = typeof navigator !== 'undefined' ? navigator.onLine : true;
const listeners = new Set();
let pingInterval = null;

export function isOnline() {
  return onlineStatus;
}

export function onStatusChange(callback) {
  listeners.add(callback);
  callback(onlineStatus);
  return () => listeners.delete(callback);
}

function updateStatus(newStatus) {
  if (onlineStatus !== newStatus) {
    onlineStatus = newStatus;
    for (const cb of listeners) {
      try {
        cb(onlineStatus);
      } catch (e) {
        console.error('Connectivity callback error:', e);
      }
    }
  }
}

export function initConnectivity(backendBaseUrl = 'http://127.0.0.1:8000') {
  if (typeof window === 'undefined') return;

  window.addEventListener('online', () => {
    checkHealth(backendBaseUrl);
  });

  window.addEventListener('offline', () => {
    updateStatus(false);
  });

  // Periodic heartbeat every 30 seconds
  if (!pingInterval) {
    pingInterval = setInterval(() => {
      if (navigator.onLine) {
        checkHealth(backendBaseUrl);
      } else {
        updateStatus(false);
      }
    }, 30000);
  }

  // Initial check
  checkHealth(backendBaseUrl);
}

export async function checkHealth(backendBaseUrl) {
  try {
    const res = await fetch(`${backendBaseUrl}/health`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      cache: 'no-store',
    });
    if (res.ok) {
      updateStatus(true);
      return true;
    } else {
      updateStatus(false);
      return false;
    }
  } catch (e) {
    updateStatus(false);
    return false;
  }
}
