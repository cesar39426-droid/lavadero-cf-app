'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  categoriaComision,
  tasasParaFormulario,
  tieneTasasPersonalizadas,
  obtenerTasaComision,
  calcularComisionesGrupales
} = require('../js/utils/comisiones.js');

const brandon = { id: 'b1', nombre: 'Brandon', activo: true, rol: 'empleado', comisionPct: 15 };
const marcos = { id: 'm1', nombre: 'marcos', activo: true, rol: 'empleado', comisionPct: 15 };

test('clasifica los lavados estándar y las motos como estándar', () => {
  for (const nombre of [
    'Lavado Estándar', 'Lavado Completo', 'Solo Exterior', 'Solo Interior',
    'Moto 110cc', 'Moto 150cc'
  ]) assert.equal(categoriaComision(nombre), 'estandar', nombre);
});

test('clasifica premium, tapizados y motor como otros', () => {
  for (const nombre of ['Lavado Premium', 'Tapizado Clásica', 'Limpieza de Motor']) {
    assert.equal(categoriaComision({ nombre }), 'otros', nombre);
  }
});

test('Brandon cobra 15% estándar y 10% en premium, tapizado y motor', () => {
  for (const servicio of ['Lavado Estándar', 'Lavado Completo', 'Solo Exterior', 'Solo Interior', 'Moto 110cc']) {
    assert.equal(obtenerTasaComision(brandon, { nombre: servicio, comisionPct: 15 }), 15, servicio);
  }
  for (const servicio of ['Lavado Premium', 'Tapizado Clásica', 'Lavado de Motor']) {
    assert.equal(obtenerTasaComision(brandon, { nombre: servicio, comisionPct: 15 }), 10, servicio);
  }
});

test('Marcos cobra 10% estándar y 5% en premium, tapizado y motor', () => {
  assert.deepEqual(tasasParaFormulario(marcos), { estandar: 10, otros: 5 });
  assert.equal(tieneTasasPersonalizadas(marcos), true);
  for (const servicio of ['Lavado Estándar', 'Lavado Completo', 'Solo Exterior', 'Solo Interior', 'Moto 150cc']) {
    assert.equal(obtenerTasaComision(marcos, { nombre: servicio, comisionPct: 15 }), 10, servicio);
  }
  for (const servicio of ['Lavado Premium', 'Tapizado Clásica', 'Lavado de Motor']) {
    assert.equal(obtenerTasaComision(marcos, { nombre: servicio, comisionPct: 15 }), 5, servicio);
  }
});

test('un perfil guardado prevalece al nombre y al porcentaje del servicio', () => {
  const empleado = {
    ...marcos,
    comisionesPorCategoria: { estandar: 12, otros: 6 }
  };
  assert.equal(obtenerTasaComision(empleado, { nombre: 'Lavado Estándar', comisionPct: 15 }), 12);
  assert.equal(obtenerTasaComision(empleado, { nombre: 'Lavado Premium', comisionPct: 15 }), 6);
  assert.deepEqual(tasasParaFormulario(empleado), { estandar: 12, otros: 6 });
});

test('los demás empleados mantienen el porcentaje definido por el servicio', () => {
  const empleado = { id: 'x1', nombre: 'Alex', activo: true, rol: 'empleado', comisionPct: 20 };
  assert.equal(tieneTasasPersonalizadas(empleado), false);
  assert.equal(obtenerTasaComision(empleado, { nombre: 'Lavado Premium', comisionPct: 15 }), 15);
});

test('calcula montos individuales, excluye inactivos y al dueño', () => {
  const empleados = [
    brandon,
    marcos,
    { id: 'off', nombre: 'Inactivo', activo: false, rol: 'empleado' },
    { id: 'owner', nombre: 'Dueño', activo: true, rol: 'dueno' }
  ];
  assert.deepEqual(
    calcularComisionesGrupales(empleados, { nombre: 'Lavado Premium', comisionPct: 15 }, 10000),
    [
      { empleadoId: 'b1', nombre: 'Brandon', pct: 10, monto: 1000 },
      { empleadoId: 'm1', nombre: 'marcos', pct: 5, monto: 500 }
    ]
  );
});
