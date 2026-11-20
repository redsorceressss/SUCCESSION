/**
 * Toast and Modal UI Utilities
 */

export const Toast = {
  container: null,

  init() {
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.className = 'toast-container';
      document.body.appendChild(this.container);
    }
  },

  show(message, type = 'info', duration = 4000) {
    this.init();
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <div class="toast-content">
        <span class="toast-icon">${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span>
        <span class="toast-message">${message}</span>
      </div>
    `;

    this.container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-fadeout');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  success(msg) { this.show(msg, 'success'); },
  error(msg) { this.show(msg, 'error', 6000); },
  info(msg) { this.show(msg, 'info'); },
};

export const Modal = {
  activeModal: null,

  open({ title, contentHtml, onConfirm, confirmText = 'Confirm', cancelText = 'Cancel' }) {
    this.close();

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>${title}</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          ${contentHtml}
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline modal-cancel">${cancelText}</button>
          <button class="btn btn-primary modal-confirm">${confirmText}</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    this.activeModal = overlay;

    const closeBtn = overlay.querySelector('.modal-close');
    const cancelBtn = overlay.querySelector('.modal-cancel');
    const confirmBtn = overlay.querySelector('.modal-confirm');

    const handleClose = () => this.close();
    closeBtn.addEventListener('click', handleClose);
    cancelBtn.addEventListener('click', handleClose);

    confirmBtn.addEventListener('click', async () => {
      if (typeof onConfirm === 'function') {
        const shouldClose = await onConfirm(overlay);
        if (shouldClose !== false) handleClose();
      } else {
        handleClose();
      }
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) handleClose();
    });
  },

  close() {
    if (this.activeModal) {
      this.activeModal.remove();
      this.activeModal = null;
    }
  },
};
