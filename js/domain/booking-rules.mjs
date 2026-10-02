export const ACTIVE_TURNO_STATES = Object.freeze(['pendiente', 'confirmado']);
export const COMPLETED_LAVADO_STATES = Object.freeze(['listo', 'archivado']);
export const MEMBERSHIP_DISCOUNT = 5000;
export const MEMBERSHIP_THRESHOLD = 4;

const VEHICLE_DURATIONS = Object.freeze({
  auto: 60,
  familiar: 90,
  camioneta: 90,
  camioneta4x4: 120,
  suv: 120,
  '4x4': 120,
  moto: 30
});

function normalize(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

export function durationMinutesForVehicle(value) {
  const key = normalize(value).replace(/[\s/_-]+/g, '');
  return VEHICLE_DURATIONS[key] || VEHICLE_DURATIONS[key === 'camionetafamiliar' || key === 'familiachico' ? 'camioneta' : 'auto'];
}

export function toMinutes(hora) {
  const [hours, minutes] = String(hora || '').split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return NaN;
  return (hours * 60) + minutes;
}

export function intervalsOverlap(startA, endA, startB, endB) {
  return startA < endB && startB < endA;
}

export function slotLockKeys({ fecha, hora, duracionMinutos, quantum = 30 }) {
  const start = toMinutes(hora);
  const duration = Number(duracionMinutos) || durationMinutesForVehicle('auto');
  if (!fecha || !Number.isFinite(start) || duration <= 0) return [];
  const keys = [];
  const alignedStart = Math.floor(start / quantum) * quantum;
  const alignedEnd = Math.ceil((start + duration) / quantum) * quantum;
  for (let minute = alignedStart; minute < alignedEnd; minute += quantum) {
    keys.push(`${fecha}_${String(Math.floor(minute / 60)).padStart(2, '0')}${String(minute % 60).padStart(2, '0')}`);
  }
  return keys;
}

function turnoDuration(turno) {
  const stored = Number(turno?.duracionMinutos);
  return Number.isFinite(stored) && stored > 0
    ? stored
    : durationMinutesForVehicle(turno?.vehiculoCategoria || turno?.tipoVehiculo);
}

export function isSlotAvailable(turnos, { fecha, hora, duracionMinutos, excludeId = null }) {
  const requestedStart = toMinutes(hora);
  const requestedDuration = Number(duracionMinutos) || durationMinutesForVehicle('auto');
  if (!fecha || !Number.isFinite(requestedStart)) return false;

  return !turnos.some(turno => {
    if (turno?.fecha !== fecha || !ACTIVE_TURNO_STATES.includes(turno?.estado)) return false;
    if (excludeId && String(turno.id) === String(excludeId)) return false;
    const existingStart = toMinutes(turno.hora);
    if (!Number.isFinite(existingStart)) return false;
    return intervalsOverlap(
      requestedStart,
      requestedStart + requestedDuration,
      existingStart,
      existingStart + turnoDuration(turno)
    );
  });
}

function normalizePlate(value = '') {
  return String(value).replace(/[^a-z0-9]/gi, '').toUpperCase();
}

function monthKey(value) {
  return String(value || '').slice(0, 7);
}

export function monthlyVehicleWashCount(lavados, { clienteId, patente, month, excludeId = null }) {
  const plate = normalizePlate(patente);
  if (!clienteId || !plate || !/^\d{4}-\d{2}$/.test(month || '')) return 0;

  return lavados.filter(lavado => (
    (!excludeId || String(lavado?.id) !== String(excludeId)) &&
    String(lavado?.clienteId) === String(clienteId) &&
    normalizePlate(lavado?.patente) === plate &&
    COMPLETED_LAVADO_STATES.includes(lavado?.estado) &&
    monthKey(lavado?.fechaInicio) === month
  )).length;
}

export function isMembershipEligibleService(serviceName = '') {
  const name = normalize(serviceName);
  return name.includes('lavado estandar') || name.includes('lavado completo');
}

export function membershipBenefitFor({ serviceName, basePrice, previousCount, discount = MEMBERSHIP_DISCOUNT }) {
  const price = Math.max(0, Number(basePrice) || 0);
  const count = Math.max(0, Number(previousCount) || 0);
  const eligible = isMembershipEligibleService(serviceName);
  const applies = eligible && count === MEMBERSHIP_THRESHOLD - 1;
  const appliedDiscount = applies ? Math.min(discount, price) : 0;

  return {
    eligible,
    applies,
    previousCount: count,
    visitNumber: count + 1,
    threshold: MEMBERSHIP_THRESHOLD,
    discount: appliedDiscount,
    priceBase: price,
    priceFinal: price - appliedDiscount,
    message: applies
      ? `Beneficio aplicado: ${formatMoney(appliedDiscount)} de descuento en el ${MEMBERSHIP_THRESHOLD}º lavado del mes.`
      : eligible
        ? `Progreso de membresía: ${Math.min(count, MEMBERSHIP_THRESHOLD)}/${MEMBERSHIP_THRESHOLD} lavados del mes.`
        : ''
  };
}

function formatMoney(value) {
  return `$${Number(value).toLocaleString('es-AR')}`;
}

export function normalizeVehiclePlate(value = '') {
  return normalizePlate(value);
}
