import { db } from './db/db.js';
import { router } from './router.js';
import { auth } from './auth.js';

// Sistema de toasts global
export const toast = {
  show(mensaje, tipo = 'info', duracion = 3000) {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        z-index: 10000;
        pointer-events: none;
      `;
      document.body.appendChild(container);
    }
    
    const toastEl = document.createElement('div');
    toastEl.className = `toast toast-${tipo}`;
    toastEl.textContent = mensaje;
    // Estilos inline básicos por si no hay CSS aún
    toastEl.style.cssText = `
      background-color: ${tipo === 'error' ? '#ef4444' : tipo === 'success' ? '#22c55e' : tipo === 'warning' ? '#f59e0b' : '#3b82f6'};
      color: #fff;
      padding: 12px 20px;
      border-radius: 8px;
      font-family: 'Inter', sans-serif;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      opacity: 0;
      transform: translateY(20px);
      transition: opacity 0.3s ease, transform 0.3s ease;
      font-size: 14px;
    `;
    
    container.appendChild(toastEl);
    
    // Animar entrada
    requestAnimationFrame(() => {
      toastEl.style.opacity = '1';
      toastEl.style.transform = 'translateY(0)';
    });
    
    // Animar salida y remover
    setTimeout(() => {
      toastEl.style.opacity = '0';
      toastEl.style.transform = 'translateY(20px)';
      setTimeout(() => toastEl.remove(), 300);
    }, duracion);
  },
  
  success(msg) { this.show(msg, 'success'); },
  error(msg) { this.show(msg, 'error'); },
  warning(msg) { this.show(msg, 'warning'); }
};

// Exportar para uso global
window.app = { db, router, auth, toast };

async function init() {
  const minSplashTime = new Promise(resolve => setTimeout(resolve, 1500));
  
  // 1. Mostrar splash screen (ya debe estar en el HTML)
  const splashScreen = document.getElementById('splash-screen');
  
  // 3. Registrar todas las rutas en el router
  router.register('#/', { moduleFile: 'login.js' });
  
  // Rutas Empleado
  router.register('#/empleado/clientes', { moduleFile: 'clientes.js' });
  router.register('#/empleado/registro', { moduleFile: 'registro.js' });
  router.register('#/empleado/dia', { moduleFile: 'vehiculos-dia.js' });
  
  // Rutas Dueño
  router.register('#/dueno/dashboard', { moduleFile: 'dashboard.js' });
  router.register('#/dueno/clientes', { moduleFile: 'clientes.js' });
  router.register('#/dueno/registro', { moduleFile: 'registro.js' });
  router.register('#/dueno/dia', { moduleFile: 'vehiculos-dia.js' });
  router.register('#/dueno/cierre', { moduleFile: 'cierre-caja.js' });
  router.register('#/dueno/costos', { moduleFile: 'costos.js' });
  router.register('#/dueno/empleados', { moduleFile: 'empleados.js' });
  router.register('#/dueno/servicios', { moduleFile: 'servicios.js' });
  router.register('#/dueno/recordatorios', { moduleFile: 'recordatorios.js' });
  router.register('#/dueno/ia', { moduleFile: 'ia.js' });
  router.register('#/dueno/config', { moduleFile: 'configuracion.js' });
  
  // Ruta Pública
  router.register('#/reserva', { moduleFile: 'turnos.js' });

  try {
    // 2. Inicializar DB (esperar) y min timer del splash al mismo tiempo
    const initDbPromise = db && typeof db.init === 'function' ? db.init() : Promise.resolve();
    await Promise.all([initDbPromise, minSplashTime]);
  } catch (error) {
    console.error('Error al inicializar la aplicación:', error);
    toast.error('Error crítico iniciando la base de datos.');
  }

  // 4. Iniciar el router
  const appContainer = document.getElementById('app');
  if (!appContainer) {
    console.error("El contenedor con id 'app' no existe en el DOM.");
  } else {
    router.init(appContainer);
  }

  // 5. Ocultar splash con transición
  if (splashScreen) {
    splashScreen.style.transition = 'opacity 0.5s ease-out';
    splashScreen.style.opacity = '0';
    setTimeout(() => {
      splashScreen.remove();
    }, 500);
  }
}

document.addEventListener('DOMContentLoaded', init);
