from pathlib import Path
p=Path('/home/ubuntu/lavadero-cf-app-work/index.html')
s=p.read_text()
marker="""async function exportCierre(fecha) {"""
insert=r'''async function autoCerrarCajaSiCorresponde() {
  if (!auth.get()) return false;
  const ahora = new Date();
  if (ahora.getHours() < 20) return false;
  const hoy = todayISO();
  const [cierres, lavados, empleados, costos] = await Promise.all([
    dbGetAll('cierres'), dbGetAll('lavados'), dbGetAll('empleados'), dbGetAll('costos')
  ]);
  if (cierres.some(c => c.fecha === hoy && c.estado === 'cerrado')) return false;
  const del = lavados.filter(l => l.fechaInicio?.startsWith(hoy) && ['listo','archivado'].includes(l.estado));
  if (!del.length) return false;
  const costosDia = costos.filter(c => c.fecha === hoy);
  const totalCostos = costosDia.reduce((sum, c) => sum + (c.monto || 0), 0);
  const bruto = del.reduce((sum, l) => sum + (l.precio || 0), 0);
  const comis = del.reduce((sum, l) => sum + (l.comisionMonto || 0), 0);
  const liquidacion = {};
  del.forEach(l => {
    if (l.comisionesGrupal?.length) l.comisionesGrupal.forEach(c => {
      if (!liquidacion[c.empleadoId]) liquidacion[c.empleadoId] = { nombre:c.nombre, total:0, cant:0 };
      liquidacion[c.empleadoId].total += c.monto || 0; liquidacion[c.empleadoId].cant++;
    });
    else if (l.empleadoId) {
      if (!liquidacion[l.empleadoId]) liquidacion[l.empleadoId] = { nombre:empleados.find(e=>e.id===l.empleadoId)?.nombre||'—', total:0, cant:0 };
      liquidacion[l.empleadoId].total += l.comisionMonto || 0; liquidacion[l.empleadoId].cant++;
    }
  });
  const snapshot = del.map(l => ({
    id:l.id, cliente:l.clienteNombre, telefono:l.clienteTelefono, patente:l.patente,
    marca:l.marcaVehiculo, modelo:l.modeloVehiculo, servicio:l.servicioNombre,
    precioBase:l.precioBase || l.precio, descuentoMembresia:l.descuentoMembresia || 0,
    precio:l.precio, estado:l.estado, empleadoId:l.empleadoId, empleadoNombre:l.empleadoNombre,
    fechaInicio:l.fechaInicio, fechaFin:l.fechaFin, notas:l.notas || '', comisionesGrupal:l.comisionesGrupal || []
  }));
  await dbPut('cierres', {
    fecha:hoy, cerradoEn:ahora.toISOString(), estado:'cerrado', origen:'auto-20:00',
    totalLavados:del.length, bruto, comisiones:comis, costos:totalCostos,
    neto:bruto-comis-totalCostos, liquidacion, lavadosIds:del.map(l=>l.id), snapshot
  });
  await Promise.all(del.map(l => dbPut('lavados', {...l, estado:'archivado'})));
  await dbCfg('aviso_cierre_auto', { fecha:hoy, creadoEn:ahora.toISOString(), totalLavados:del.length });
  toast(`Caja cerrada automáticamente a las 20:00 · ${del.length} lavado${del.length===1?'':'s'} archivado${del.length===1?'':'s'}`, 'info');
  return true;
}

'''
if marker not in s: raise SystemExit('export marker missing')
s=s.replace(marker, insert+marker, 1)
old="""  // Seeds en background (no bloquea el primer render)
  seeds().catch(e => console.warn('Seeds error:', e));
  migrateActiveTurnoLocks().catch(e => console.warn('Turno lock migration error:', e));"""
new="""  // Seeds y migraciones idempotentes. El auto-cierre solo opera sobre sesión de dueño.
  seeds().then(async () => {
    await migrateActiveTurnoLocks();
    await autoCerrarCajaSiCorresponde();
  }).catch(e => console.warn('Seeds/migration error:', e));
  if (!window._cajaAutoTimer) {
    window._cajaAutoTimer = setInterval(() => autoCerrarCajaSiCorresponde().catch(e => console.warn('Auto-close error:', e)), 60000);
  }"""
if old not in s: raise SystemExit('init marker missing')
s=s.replace(old,new,1)
# Add provenance note to an already closed card.
old="""<p class=\"text-muted\" style=\"font-size:.82rem\">Cerrado a las ${new Date(cierreHoy.cerradoEn).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'})}</p>"""
new="""<p class=\"text-muted\" style=\"font-size:.82rem\">Cerrado a las ${new Date(cierreHoy.cerradoEn).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'})}</p>
        ${cierreHoy.origen === 'auto-20:00' ? '<p style=\"font-size:.75rem;color:var(--gold);margin-top:6px\">Cierre automático de resguardo a las 20:00. El detalle queda en el historial.</p>' : ''}"""
if old not in s: raise SystemExit('close card marker missing')
s=s.replace(old,new,1)
p.write_text(s)
