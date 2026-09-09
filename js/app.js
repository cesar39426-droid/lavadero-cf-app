import { db }     from './db/db.js';
import { router }  from './router.js';
import { auth }    from './auth.js';
import { toast }   from './utils/toast.js';

// Re-exportar toast para compatibilidad con módulos que ya lo importan de app.js
export { toast };

// Exportar para uso global desde consola / módulos sin import
window.app = { db, router, auth, toast };

async function init() {
  const minSplashTime   = new Promise(resolve => setTimeout(resolve, 1500));
  const splashScreen    = document.getElementById('splash-screen');
  const appContainer    = document.getElementById('app');

  // ── Registrar rutas ────────────────────────────────────────────────────
  router.register('#/',                    { moduleFile: 'login.js'         });
  router.register('#/empleado/clientes',   { moduleFile: 'clientes.js'      });
  router.register('#/empleado/registro',   { moduleFile: 'registro.js'      });
  router.register('#/empleado/dia',        { moduleFile: 'vehiculos-dia.js'  });
  router.register('#/dueno/dashboard',     { moduleFile: 'dashboard.js'     });
  router.register('#/dueno/clientes',      { moduleFile: 'clientes.js'      });
  router.register('#/dueno/registro',      { moduleFile: 'registro.js'      });
  router.register('#/dueno/dia',           { moduleFile: 'vehiculos-dia.js'  });
  router.register('#/dueno/cierre',        { moduleFile: 'cierre-caja.js'   });
  router.register('#/dueno/costos',        { moduleFile: 'costos.js'        });
  router.register('#/dueno/empleados',     { moduleFile: 'empleados.js'     });
  router.register('#/dueno/servicios',     { moduleFile: 'servicios.js'     });
  router.register('#/dueno/recordatorios', { moduleFile: 'recordatorios.js' });
  router.register('#/dueno/ia',            { moduleFile: 'ia.js'            });
  router.register('#/dueno/config',        { moduleFile: 'configuracion.js' });
  router.register('#/reserva',             { moduleFile: 'turnos.js'        });

  // ── Inicializar DB ─────────────────────────────────────────────────────
  try {
    await Promise.all([ db.init(), minSplashTime ]);
    console.log('[App] Base de datos lista.');
  } catch (err) {
    console.error('[App] Error iniciando DB:', err);
    toast.error('Error iniciando la base de datos. Recargá la página.');
  }

  // ── Mostrar contenedor de la app ───────────────────────────────────────
  if (appContainer) {
    appContainer.style.display = 'block';
  }

  // ── Iniciar el router ──────────────────────────────────────────────────
  if (appContainer) {
    router.init(appContainer);
  }

  // Dar un frame para que el módulo inserte su HTML
  await new Promise(resolve => setTimeout(resolve, 100));

  // ── Ocultar splash ─────────────────────────────────────────────────────
  if (splashScreen) {
    splashScreen.style.transition = 'opacity 0.4s ease-out';
    splashScreen.style.opacity = '0';
    setTimeout(() => splashScreen.remove(), 400);
  }
}

document.addEventListener('DOMContentLoaded', init);
