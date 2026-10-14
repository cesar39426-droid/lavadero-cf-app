'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  categoriaComision,
  tasasParaFormulario,
  tieneTasasPersonalizadas,
  obtenerTasaComision,
  calcularComisionesGrupales,
  recalcularComisionesDelLavado
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

test('recalcula la proyección de caja de hoy con las tasas personales vigentes', () => {
  const lavado = {
    precio: 10000,
    comisionMonto: 3000,
    comisionesGrupal: [
      { empleadoId: 'b1', nombre: 'Brandon', pct: 15, monto: 1500 },
      { empleadoId: 'm1', nombre: 'marcos', pct: 15, monto: 1500 }
    ]
  };
  const actualizado = recalcularComisionesDelLavado(
    lavado,
    [brandon, marcos],
    { nombre: 'Lavado Completo', comisionPct: 15 }
  );
  assert.deepEqual(actualizado.comisionesGrupal.map(({ empleadoId, pct, monto }) => ({ empleadoId, pct, monto })), [
    { empleadoId: 'b1', pct: 15, monto: 1500 },
    { empleadoId: 'm1', pct: 10, monto: 1000 }
  ]);
  assert.equal(actualizado.comisionMonto, 2500);
  assert.equal(lavado.comisionMonto, 3000, 'la proyección no debe mutar el registro original');

  const premium = recalcularComisionesDelLavado(
    lavado,
    [brandon, marcos],
    { nombre: 'Lavado Premium', comisionPct: 10 }
  );
  assert.deepEqual(premium.comisionesGrupal.map(({ pct, monto }) => ({ pct, monto })), [
    { pct: 10, monto: 1000 },
    { pct: 5, monto: 500 }
  ]);
  assert.equal(premium.comisionMonto, 1500);
});

test('recalcula tapizado en caja y conserva filas de empleados ya no disponibles', () => {
  const lavado = {
    precio: 20000,
    comisionMonto: 4500,
    comisionesGrupal: [
      { empleadoId: 'b1', nombre: 'Brandon', pct: 15, monto: 3000 },
      { empleadoId: 'old', nombre: 'Empleado anterior', pct: 15, monto: 1500 }
    ]
  };
  const actualizado = recalcularComisionesDelLavado(
    lavado,
    [brandon],
    { nombre: 'Tapizado Clásica', comisionPct: 10 }
  );
  assert.deepEqual(actualizado.comisionesGrupal.map(({ empleadoId, pct, monto }) => ({ empleadoId, pct, monto })), [
    { empleadoId: 'b1', pct: 10, monto: 2000 },
    { empleadoId: 'old', pct: 15, monto: 1500 }
  ]);
  assert.equal(actualizado.comisionMonto, 3500);
});

test('actualiza registros heredados de un empleado y preserva si falta el servicio o el empleado', () => {
  const heredado = { empleadoId: 'm1', precio: 10000, comisionMonto: 1500 };
  const actualizado = recalcularComisionesDelLavado(heredado, [marcos], { nombre: 'Lavado Premium', comisionPct: 10 });
  assert.deepEqual(actualizado.comisionesGrupal, [
    { empleadoId: 'm1', nombre: 'marcos', pct: 5, monto: 500 }
  ]);
  assert.equal(actualizado.comisionMonto, 500);

  assert.equal(recalcularComisionesDelLavado(heredado, [marcos], null).comisionMonto, 1500);
  assert.equal(recalcularComisionesDelLavado(heredado, [], { nombre: 'Lavado Premium', comisionPct: 10 }).comisionMonto, 1500);
});
