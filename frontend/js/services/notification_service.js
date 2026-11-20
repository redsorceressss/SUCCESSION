/**
 * Notifications and Agent Suggestions Service
 */

import { State } from '../state.js';

export const NotificationService = {
  addNotification(type, title, message) {
    const list = State.get('notifications') || [];
    const item = {
      id: Date.now(),
      type,
      title,
      message,
      timestamp: new Date().toLocaleTimeString(),
      read: false,
    };
    State.set('notifications', [item, ...list]);
  },

  markAllAsRead() {
    const list = State.get('notifications') || [];
    const updated = list.map((n) => ({ ...n, read: true }));
    State.set('notifications', updated);
  },

  clear() {
    State.set('notifications', []);
  },
};
