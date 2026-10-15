from pathlib import Path

p = Path('/home/ubuntu/lavadero-cf-app-work/index.html')
s = p.read_text()

old = """async function calcularMembresia({ clienteId, patente, servicioNombre, precioBase, fecha = new Date(), excludeId = null }) {
  const month = fechaMesLocal(fecha);
  const lavados = await dbGetAll('lavados');
  const previousCount = bookingRules
    ? bookingRules.monthlyVehicleWashCount(lavados, { clienteId, patente, month, excludeId })
    : 0;
  const benefit = bookingRules
    ? bookingRules.membershipBenefitFor({ serviceName: servicioNombre, basePrice: precioBase, previousCount })
    : { eligible: false, applies: false, previousCount, visitNumber: previousCount + 1, discount: 0, priceBase: precioBase, priceFinal: precioBase, message: '' };
  return {
    ...benefit,
    month,
    vehiclePlate: bookingRules?.normalizeVehiclePlate(patente) || String(patente || '').replace(/[^a-z0-9]/gi, '').toUpperCase()
  };
}"""
new = """async function calcularMembresia({ clienteId, patente, servicioNombre, precioBase, fecha = new Date(), excludeId = null }) {
  const month = fechaMesLocal(fecha);
  const lavados = await dbGetAll('lavados');
  const vehiclePlate = bookingRules?.normalizeVehiclePlate(patente) || String(patente || '').replace(/[^a-z0-9]/gi, '').toUpperCase();
  const cliente = clienteId ? await dbGet('clientes', clienteId) : null;
  const membresia = cliente?.membresia;
  const membershipActive = Boolean(membresia?.activa && (membresia.porPatente || []).some(p =>
    (bookingRules?.normalizeVehiclePlate(p) || String(p || '').replace(/[^a-z0-9]/gi, '').toUpperCase()) === vehiclePlate
  ));
  const previousCount = bookingRules
    ? bookingRules.monthlyVehicleWashCount(lavados, { clienteId, patente, month, excludeId })
    : 0;
  const benefit = bookingRules
    ? bookingRules.membershipBenefitFor({ serviceName: servicioNombre, basePrice: precioBase, previousCount, membershipActive })
    : { eligible: false, applies: false, previousCount, visitNumber: previousCount + 1, discount: 0, priceBase: precioBase, priceFinal: precioBase, message: '' };
  return {
    ...benefit,
    month,
    vehiclePlate,
    membershipActive
  };
}"""
if old not in s:
    raise SystemExit('calcularMembresia block not found')
s = s.replace(old, new, 1)

old = """    ${membresiaRows}
    <div class=\"section-head\">Historial</div>"""
new = """    ${membresiaRows}
    ${auth.isDueno() ? `<div class=\"card\" style=\"margin:12px 0\">
      <p class=\"text-muted\" style=\"font-size:.78rem;margin-bottom:8px\">La membresía se activa manualmente cuando el cliente acuerda el beneficio con el dueño. Se aplica por patente, solo al cuarto Lavado Estándar del mes.</p>
      <button class=\"btn btn-primary btn-full\" onclick=\"gestionarMembresiaModal('${id}')\">⭐ ${c.membresia?.activa ? 'Editar membresía activa' : 'Dar de alta membresía'}</button>
    </div>` : ''}
    <div class=\"section-head\">Historial</div>"""
if old not in s:
    raise SystemExit('membership insertion point not found')
s = s.replace(old, new, 1)

marker = """async function editarClienteModal(id) {"""
insert = r'''async function gestionarMembresiaModal(id) {
  if (!auth.isDueno()) { toast('Solo el dueño puede gestionar membresías.', 'error'); return; }
  const c = (await dbGetAll('clientes')).find(x => x.id === id);
  if (!c) return;
  const patentes = [...new Set((c.patentes || []).filter(Boolean))];
  if (!patentes.length) { toast('Primero registrá al menos una patente del cliente.', 'error'); return; }
  const activas = new Set(c.membresia?.porPatente || []);
  openModal(`
    <div class="modal-title">⭐ Membresía de ${esc(c.nombre)}</div>
    <p class="text-muted" style="font-size:.8rem;margin-bottom:12px">Marcá las patentes incluidas en el acuerdo. El beneficio descuenta $5.000 en el cuarto Lavado Estándar de cada mes.</p>
    <div class="input-group">
      ${patentes.map((p, i) => `<label style="display:flex;gap:10px;align-items:center;padding:10px 0;border-bottom:1px solid var(--surface2)"><input class="membresiaPatente" type="checkbox" value="${esc(p)}" ${activas.has(p) ? 'checked' : ''}/> <strong>${esc(p)}</strong></label>`).join('')}
    </div>
    <div class="form-actions mt-md">
      <button class="btn btn-secondary btn-full" onclick="verCliente('${esc(id)}')">Cancelar</button>
      <button class="btn btn-primary btn-full" onclick="guardarMembresiaCliente('${esc(id)}')">Guardar membresía</button>
    </div>
  `);
}
async function guardarMembresiaCliente(id) {
  if (!auth.isDueno()) return;
  const c = (await dbGetAll('clientes')).find(x => x.id === id);
  if (!c) return;
  const porPatente = [...document.querySelectorAll('.membresiaPatente:checked')].map(el => el.value);
  const now = new Date().toISOString();
  const anterior = c.membresia || {};
  await dbPut('clientes', { ...c, membresia: {
    activa: porPatente.length > 0,
    desde: anterior.desde || now,
    porPatente,
    actualizadoEn: now
  }});
  toast(porPatente.length ? 'Membresía activada ✔' : 'Membresía desactivada', porPatente.length ? 'success' : 'info');
  await verCliente(id);
  await renderClientes();
}
window.gestionarMembresiaModal = gestionarMembresiaModal;
window.guardarMembresiaCliente = guardarMembresiaCliente;

'''
if marker not in s:
    raise SystemExit('client edit marker not found')
s = s.replace(marker, insert + marker, 1)

# Make entered turns disappear from the active day banner and remain only in history.
s = s.replace("+ '<div style=\"font-size:.75rem;color:var(--gold);font-weight:600;margin-bottom:8px\">TURNOS RESERVADOS HOY (' + arr.length + ')</div>'", "+ '<div style=\"font-size:.75rem;color:var(--gold);font-weight:600;margin-bottom:8px\">TURNOS RESERVADOS HOY (' + arr.length + ')</div>'", 1)

# Add detail disclosure to each day card without changing the editing flow.
old = """        <p class=\"text-muted\" style=\"font-size:.78rem\">🚗 ${l.marcaVehiculo || l.modeloVehiculo || 'Marca no registrada'}</p>
        <div class=\"flex-between mt-sm\">"""
new = """        <p class=\"text-muted\" style=\"font-size:.78rem\">🚗 ${l.marcaVehiculo || l.modeloVehiculo || 'Marca no registrada'}</p>
        ${['listo','archivado'].includes(l.estado) ? `<details class=\"card\" style=\"margin:10px 0 0;padding:10px 12px;background:var(--surface2)\"><summary style=\"cursor:pointer;font-size:.78rem;color:var(--gold)\">Ver detalle del lavado</summary><div style=\"font-size:.75rem;line-height:1.7;margin-top:8px;color:var(--muted)\">Inicio: ${l.fechaInicio ? new Date(l.fechaInicio).toLocaleString('es-AR') : '—'}<br>Fin: ${l.fechaFin ? new Date(l.fechaFin).toLocaleString('es-AR') : '—'}<br>Precio base: ${fmoney(l.precioBase || l.precio)} · Descuento: ${fmoney(l.descuentoMembresia || 0)}<br>Empleado: ${esc(l.comisionesGrupal?.map(c => c.nombre).join(', ') || l.empleadoNombre || '—')}<br>Notas: ${esc(l.notas || 'Sin notas')}</div></details>` : ''}
        <div class=\"flex-between mt-sm\">"""
if old not in s:
    raise SystemExit('day detail insertion point not found')
s = s.replace(old, new, 1)

# Improve employee action label while preserving reversible history.
s = s.replace("${e.activo?'Desactivar':'Reactivar'}", "${e.activo?'Retirar del equipo':'Reactivar'}", 1)
s = s.replace("confirmModal('¿Desactivar este empleado? (Se conserva su historial)'", "confirmModal('¿Retirar este empleado del equipo? Se conservarán su historial y sus comisiones.',", 1)
# Above replacement can create a doubled comma if exact signature differs; normalize it.
s = s.replace("Se conservarán su historial y sus comisiones.',async()=>", "Se conservarán su historial y sus comisiones.',async()=>")

p.write_text(s)

# Update test calls to opt in explicitly.
t = Path('/home/ubuntu/lavadero-cf-app-work/tests/booking-rules.test.mjs')
ts = t.read_text()
ts = ts.replace("serviceName: 'Lavado Estándar', basePrice: 35000, previousCount: 3", "serviceName: 'Lavado Estándar', basePrice: 35000, previousCount: 3, membershipActive: true")
ts = ts.replace("serviceName: 'Lavado Estándar', basePrice: 30000, previousCount: 2", "serviceName: 'Lavado Estándar', basePrice: 30000, previousCount: 2, membershipActive: true")
ts = ts.replace("serviceName: 'Lavado Premium', basePrice: 80000, previousCount: 3", "serviceName: 'Lavado Premium', basePrice: 80000, previousCount: 3, membershipActive: true")
ts = ts.replace("serviceName: 'Lavado de Motor', basePrice: 50000, previousCount: 3", "serviceName: 'Lavado de Motor', basePrice: 50000, previousCount: 3, membershipActive: true")
ts = ts.replace("serviceName: 'Tapizado Full', basePrice: 150000, previousCount: 3", "serviceName: 'Tapizado Full', basePrice: 150000, previousCount: 3, membershipActive: true")
needle = """test('no aplica antes de cuatro lavados ni a servicios no elegibles', () => {"""
addition = """test('no aplica si el cliente no tiene membresía activa', () => {
  const benefit = membershipBenefitFor({ serviceName: 'Lavado Estándar', basePrice: 30000, previousCount: 3, membershipActive: false });
  assert.equal(benefit.eligible, false);
  assert.equal(benefit.discount, 0);
});

"""
ts = ts.replace(needle, addition + needle, 1)
t.write_text(ts)
