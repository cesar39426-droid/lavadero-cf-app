import { auth } from './auth.js';

export const router = {
  routes: {},
  currentRoute: null,
  appContainer: null,

  register(hash, options) {
    this.routes[hash] = options;
  },

  async navigate(hash) {
    const path = hash.split('?')[0];
    const routeInfo = this.routes[path];

    // Ruta desconocida → login
    if (!routeInfo) {
      console.warn(`[Router] Ruta desconocida: "${path}". Redirigiendo a #/`);
      window.location.hash = '#/';
      return;
    }

    // Guard de acceso
    if (!auth.canAccess(path)) {
      console.warn(`[Router] Acceso denegado a "${path}". Redirigiendo a #/`);
      window.location.hash = '#/';
      return;
    }

    this.currentRoute = hash;
    const container = this.appContainer;
    if (!container) return;

    // Indicador de carga mientras se importa el módulo
    container.innerHTML = `
      <div style="
        display:flex;align-items:center;justify-content:center;
        min-height:100vh;background:#000;
        color:#c9a227;font-family:Inter,system-ui,sans-serif;font-size:14px;
      ">Cargando…</div>
    `;

    try {
      const module = await import(`./modules/${routeInfo.moduleFile}`);
      container.innerHTML = '';

      // Siempre: render() luego init() si existe
      if (typeof module.render === 'function') {
        await module.render(container);
      }
      if (typeof module.init === 'function') {
        await module.init();
      }

    } catch (err) {
      console.error(`[Router] Error en "${routeInfo.moduleFile}":`, err);
      container.innerHTML = `
        <div style="
          display:flex;flex-direction:column;align-items:center;justify-content:center;
          min-height:100vh;background:#000;color:#f5f0e8;
          font-family:Inter,system-ui,sans-serif;padding:24px;text-align:center;gap:16px;
        ">
          <span style="font-size:2rem">⚠️</span>
          <p style="color:#e05c5c;font-weight:600">Error cargando esta pantalla</p>
          <p style="color:#666;font-size:13px">${err.message || 'Error desconocido'}</p>
          <button onclick="window.location.hash='#/'" style="
            background:#c9a227;color:#000;border:none;padding:12px 24px;
            border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;
          ">Volver al inicio</button>
        </div>
      `;
    }
  },

  init(appContainer) {
    this.appContainer = appContainer;

    window.addEventListener('hashchange', () => {
      this.navigate(window.location.hash);
    });

    const initialHash = window.location.hash || '#/';
    if (!window.location.hash) {
      window.location.hash = '#/';
    } else {
      this.navigate(initialHash);
    }
  },

  getCurrentRoute() {
    return this.currentRoute;
  }
};
