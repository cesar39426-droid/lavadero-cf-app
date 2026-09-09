export const auth = {
  // Setea el usuario activo
  setUser(empleado) {
    sessionStorage.setItem('currentUser', JSON.stringify(empleado));
  },
  
  // Obtiene el usuario activo (o null si no hay sesión)
  getCurrentUser() {
    const userStr = sessionStorage.getItem('currentUser');
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch (e) {
      console.error('Error parseando usuario de la sesión:', e);
      return null;
    }
  },
  
  // Cierra sesión
  logout() {
    sessionStorage.removeItem('currentUser');
  },
  
  // Verifica si tiene un rol específico
  hasRole(role) {
    const user = this.getCurrentUser();
    return user && user.rol === role;
  },
  
  // Guard de ruta — retorna true si puede acceder
  canAccess(route) {
    // Rutas públicas
    if (route.startsWith('#/reserva') || route === '#/') {
      return true;
    }
    
    const user = this.getCurrentUser();
    if (!user) return false;
    
    // Rutas exclusivas del dueño
    if (route.startsWith('#/dueno/')) {
      return user.rol === 'dueno';
    }
    
    // Rutas de empleado (pueden acceder dueños y empleados)
    if (route.startsWith('#/empleado/')) {
      return user.rol === 'dueno' || user.rol === 'empleado';
    }
    
    return false;
  }
};
