(function (root) {
  'use strict';

  const PERFILES_POR_NOMBRE = {
    brandon: { estandar: 15, otros: 10 },
    marcos: { estandar: 10, otros: 5 }
  };

  function normalizarTexto(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  }

  function categoriaComision(servicio) {
    const nombre = normalizarTexto(typeof servicio === 'string'
      ? servicio
      : servicio?.nombre || servicio?.servicioNombre);

    if (/premium|tapizado|motor/.test(nombre)) return 'otros';
    if (/lavado estandar|lavado completo|solo exterior|solo interior|\bmoto\b/.test(nombre)) {
      return 'estandar';
    }
    return null;
  }

  function tasaValida(value) {
    if (value === undefined || value === null || value === '') return null;
    const rate = Number(value);
    return Number.isFinite(rate) && rate >= 0 && rate <= 100 ? rate : null;
  }

  function tasasConfiguradas(empleado) {
    const guardadas = empleado?.comisionesPorCategoria;
    const estandarGuardada = tasaValida(guardadas?.estandar);
    const otrosGuardada = tasaValida(guardadas?.otros);
    if (estandarGuardada !== null || otrosGuardada !== null) {
      return {
        estandar: estandarGuardada ?? otrosGuardada,
        otros: otrosGuardada ?? estandarGuardada
      };
    }

    const perfilNombre = PERFILES_POR_NOMBRE[normalizarTexto(empleado?.nombre)];
    return perfilNombre ? { ...perfilNombre } : null;
  }

  function tasasParaFormulario(empleado) {
    const configuradas = tasasConfiguradas(empleado);
    if (configuradas) return configuradas;
    const tasaAnterior = tasaValida(empleado?.comisionPct) ?? 15;
    return {
      estandar: tasaAnterior,
      otros: tasaValida(empleado?.comisionOtrosPct) ?? tasaAnterior
    };
  }

  function tieneTasasPersonalizadas(empleado) {
    return tasasConfiguradas(empleado) !== null;
  }

  function obtenerTasaComision(empleado, servicio) {
    const categoria = categoriaComision(servicio);
    const tasas = tasasConfiguradas(empleado);
    if (categoria && tasas && tasaValida(tasas[categoria]) !== null) {
      return tasaValida(tasas[categoria]);
    }

    const tasaServicio = tasaValida(servicio?.comisionPct);
    if (tasaServicio !== null) return tasaServicio;
    return tasaValida(empleado?.comisionPct) ?? 15;
  }

  function calcularComisionesGrupales(empleados, servicio, precio) {
    const montoBase = Number(precio) || 0;
    return (empleados || [])
      .filter(empleado => empleado?.activo === true && empleado?.rol !== 'dueno')
      .map(empleado => {
        const pct = obtenerTasaComision(empleado, servicio);
        return {
          empleadoId: empleado.id,
          nombre: empleado.nombre,
          pct,
          monto: Math.round((montoBase * pct) / 100)
        };
      });
  }

  const api = Object.freeze({
    categoriaComision,
    tasasParaFormulario,
    tieneTasasPersonalizadas,
    obtenerTasaComision,
    calcularComisionesGrupales
  });

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.LavaderoComisiones = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
