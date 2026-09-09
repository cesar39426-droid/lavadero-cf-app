import { auth } from './auth.js';

export const router = {
  routes: {},
  currentRoute: null,
  appContainer: null,
  
  // Registra una ruta
  register(hash, options) {
    this.routes[hash] = options;
  },
  
  // Navega a una ruta
  async navigate(hash) {
    // Si la ruta no está registrada, redirigir al login
    const path = hash.split('?')[0]; // Ignoramos query parameters si los hay
    const routeInfo = this.routes[path];
    
    if (!routeInfo) {
      console.warn(`Ruta desconocida: ${path}. Redirigiendo a #/`);
      window.location.hash = '#/';
      return;
    }
    
    // Verificar guard de acceso
    if (!auth.canAccess(path)) {
      console.warn(`Acceso denegado a: ${path}. Redirigiendo a #/`);
      window.location.hash = '#/';
      return;
    }
    
    this.currentRoute = hash;
    
    try {
      // Transición de salida
      if (this.appContainer.firstElementChild) {
        this.appContainer.style.opacity = '0';
        await new Promise(resolve => setTimeout(resolve, 300)); // tiempo de transición
      }
      
      this.appContainer.innerHTML = '<div class="loading-state">Cargando...</div>';
      this.appContainer.style.opacity = '1';
      
      // Import dinámico del módulo de la vista
      const module = await import(`./modules/${routeInfo.moduleFile}`);
      
      // Limpiar contenedor y prepararse para entrada
      this.appContainer.style.opacity = '0';
      await new Promise(resolve => setTimeout(resolve, 300));
      this.appContainer.innerHTML = '';
      
      // Renderizar e inicializar
      await module.render(this.appContainer);
      if (module.init) {
        await module.init();
      }
      
      // Transición de entrada
      this.appContainer.style.opacity = '1';
    } catch (error) {
      console.error(`Error al cargar la ruta ${hash}:`, error);
      this.appContainer.innerHTML = '<div class="error-state">Error cargando el módulo. Intente recargar.</div>';
      this.appContainer.style.opacity = '1';
    }
  },
  
  // Inicializa el router (escucha hashchange)
  init(appContainer) {
    this.appContainer = appContainer;
    
    // Configuración base de estilos de transición en el contenedor
    this.appContainer.style.transition = 'opacity 0.3s ease-in-out';
    
    window.addEventListener('hashchange', () => {
      this.navigate(window.location.hash);
    });
    
    // Navegar a la ruta inicial según el hash actual, o ir a login si está vacío
    const initialHash = window.location.hash || '#/';
    if (window.location.hash !== initialHash) {
      window.location.hash = initialHash;
    } else {
      this.navigate(initialHash);
    }
  },
  
  // Ruta actual
  getCurrentRoute() {
    return this.currentRoute;
  }
};
