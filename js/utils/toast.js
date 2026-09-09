/**
 * js/utils/toast.js
 * Sistema de notificaciones global
 * Módulo independiente para evitar importaciones circulares
 */

export const toast = {
  show(mensaje, tipo = 'info', duracion = 3000) {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.style.cssText = `
        position: fixed;
        bottom: 80px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        z-index: 10000;
        pointer-events: none;
        width: max-content;
        max-width: 90vw;
      `;
      document.body.appendChild(container);
    }

    const colors = {
      success: '#4caf7d',
      error:   '#e05c5c',
      warning: '#f0a500',
      info:    '#c9a227'
    };

    const toastEl = document.createElement('div');
    toastEl.textContent = mensaje;
    toastEl.style.cssText = `
      background: ${colors[tipo] || colors.info};
      color: #000;
      padding: 12px 20px;
      border-radius: 24px;
      font-family: 'Inter', system-ui, sans-serif;
      font-size: 14px;
      font-weight: 600;
      box-shadow: 0 4px 20px rgba(0,0,0,0.5);
      opacity: 0;
      transform: translateY(10px) scale(0.95);
      transition: opacity 0.25s ease, transform 0.25s ease;
      pointer-events: all;
      white-space: nowrap;
    `;

    container.appendChild(toastEl);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        toastEl.style.opacity = '1';
        toastEl.style.transform = 'translateY(0) scale(1)';
      });
    });

    setTimeout(() => {
      toastEl.style.opacity = '0';
      toastEl.style.transform = 'translateY(10px) scale(0.95)';
      setTimeout(() => toastEl.remove(), 250);
    }, duracion);
  },

  success(msg, dur) { this.show(msg, 'success', dur); },
  error(msg, dur)   { this.show(msg, 'error', dur); },
  warning(msg, dur) { this.show(msg, 'warning', dur); },
  info(msg, dur)    { this.show(msg, 'info', dur); }
};
