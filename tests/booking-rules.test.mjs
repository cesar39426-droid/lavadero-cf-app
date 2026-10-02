import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isSlotAvailable,
  membershipBenefitFor,
  monthlyVehicleWashCount
} from '../js/domain/booking-rules.mjs';

test('bloquea solapamiento parcial usando la duración existente', () => {
  const turnos = [{
    id: 't-1', fecha: '2026-10-05', hora: '08:00', estado: 'pendiente',
    vehiculoCategoria: 'suv', duracionMinutos: 120
  }];

  assert.equal(isSlotAvailable(turnos, {
    fecha: '2026-10-05', hora: '09:00', duracionMinutos: 60
  }), false);
  assert.equal(isSlotAvailable(turnos, {
    fecha: '2026-10-05', hora: '10:00', duracionMinutos: 60
  }), true);
});

test('al editar un turno excluye su propio intervalo', () => {
  const turnos = [{
    id: 't-1', fecha: '2026-10-05', hora: '08:00', estado: 'confirmado',
    vehiculoCategoria: 'auto', duracionMinutos: 60
  }];

  assert.equal(isSlotAvailable(turnos, {
    fecha: '2026-10-05', hora: '08:00', duracionMinutos: 60, excludeId: 't-1'
  }), true);
});

test('cuenta solo lavados completados del mismo vehículo y mes', () => {
  const lavados = [
    { clienteId: 'c-1', patente: 'AA 123 BB', estado: 'listo', fechaInicio: '2026-10-01T10:00:00.000Z' },
    { clienteId: 'c-1', patente: 'AA123BB', estado: 'archivado', fechaInicio: '2026-10-10T10:00:00.000Z' },
    { clienteId: 'c-1', patente: 'AA123BB', estado: 'en_espera', fechaInicio: '2026-10-15T10:00:00.000Z' },
    { clienteId: 'c-1', patente: 'CC999DD', estado: 'listo', fechaInicio: '2026-10-20T10:00:00.000Z' },
    { clienteId: 'c-1', patente: 'AA123BB', estado: 'listo', fechaInicio: '2026-09-30T10:00:00.000Z' }
  ];

  assert.equal(monthlyVehicleWashCount(lavados, {
    clienteId: 'c-1', patente: 'AA-123-BB', month: '2026-10'
  }), 2);
});

test('aplica $5.000 en el cuarto lavado del vehículo', () => {
  const benefit = membershipBenefitFor({
    serviceName: 'Lavado Estándar', basePrice: 35000, previousCount: 3
  });

  assert.equal(benefit.applies, true);
  assert.equal(benefit.discount, 5000);
  assert.equal(benefit.priceFinal, 30000);
  assert.match(benefit.message, /4º lavado/);
});

test('no aplica antes de cuatro lavados ni a servicios no elegibles', () => {
  assert.equal(membershipBenefitFor({
    serviceName: 'Lavado Estándar', basePrice: 30000, previousCount: 2
  }).discount, 0);
  assert.equal(membershipBenefitFor({
    serviceName: 'Lavado Premium', basePrice: 80000, previousCount: 3
  }).discount, 0);
  assert.equal(membershipBenefitFor({
    serviceName: 'Lavado de Motor', basePrice: 50000, previousCount: 3
  }).discount, 0);
});
