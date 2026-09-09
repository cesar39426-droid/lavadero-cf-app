export async function seedDatabase(db) {
  try {
    // 1. Empleado Dueño
    const empleados = await db.getAll('empleados');
    const hasDueno = empleados.some(e => e.rol === 'dueno');
    if (!hasDueno) {
      await db.put('empleados', {
        id: crypto.randomUUID(),
        nombre: 'Dueño',
        pin: '0000',
        rol: 'dueno',
        tipo: 'permanente',
        activo: true
      });
    }

    // 2. Servicios
    const servicios = await db.getAll('servicios');
    if (servicios.length === 0) {
      await db.put('servicios', {
        id: crypto.randomUUID(),
        nombre: 'Lavado Estándar',
        precio: 30000,
        desc: 'Lavado exterior artesanal, aspirado profundo, acondicionado de plásticos interiores',
        comisionPct: 15
      });
      await db.put('servicios', {
        id: crypto.randomUUID(),
        nombre: 'Lavado Premium',
        precio: 80000,
        desc: 'Lavado exterior artesanal y de llantas, aspirado profundo y detallado, acondicionado de plásticos/burletes/gomas, incluye limpieza intensiva de marcos de puertas',
        comisionPct: 15
      });
      await db.put('servicios', {
        id: crypto.randomUUID(),
        nombre: 'Lavado de Motor',
        precio: 50000,
        desc: 'Limpieza técnica detallada del sector motor',
        comisionPct: 10
      });
      await db.put('servicios', {
        id: crypto.randomUUID(),
        nombre: 'Tapizado Clásica',
        precio: 150000,
        desc: 'Limpieza profunda de tapizados in-situ (sin desarmar butacas), ideal para mantenimiento, incluye Lavado Estándar',
        comisionPct: 10
      });
    }

    // 3. Config inicial
    const version = await db.getConfigValue('version');
    if (!version) {
      await db.setConfigValue('version', '1.0.0');
      await db.setConfigValue('api_key_ia', '');
      await db.setConfigValue('nombre_negocio', 'LavaderoCF');
      await db.setConfigValue('telefono_negocio', '');
    }
  } catch (error) {
    console.error('Error poblando la base de datos (seeds):', error);
  }
}
