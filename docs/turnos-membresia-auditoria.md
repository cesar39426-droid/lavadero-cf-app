# Auditoría de la aplicación LavaderoCF

## Base revisada

- Repositorio: `cesar39426-droid/lavadero-cf-app`
- Último estado de `master`: `1423368` (`feat(reserva): agregar selector inteligente y tarifas por vehiculo`)
- La rama remota `lavaderocfapp` **no existe**; se creó una rama local con ese nombre desde `master` para trabajar sin modificar `master`.
- La aplicación real se ejecuta principalmente desde `index.html` con módulos auxiliares y Firestore.

## Hallazgos funcionales

1. **No había membresía implementada.** La ficha de cliente no guardaba conteo mensual por vehículo, beneficio aplicado ni descuento.
2. **La reserva pública no guardaba una duración explícita.** La disponibilidad comparaba únicamente la misma hora, por lo que una reserva larga podía solaparse con otra de menor duración.
3. **La conversión de turno a lavado no era idempotente.** El botón `Llegó` podía crear más de un lavado para el mismo turno y dejar el turno en `confirmado`.
4. **El dueño no podía editar un turno futuro.** Solo existían cancelar y convertir a lavado.
5. **El dueño no podía editar la ficha del lavado del día.** La pantalla Hoy solo permitía iniciar, terminar, avisar o eliminar.
6. **La reserva pública no tenía una segunda validación robusta contra solapamientos justo antes de guardar.** Dos clientes podían intentar confirmar el mismo intervalo casi al mismo tiempo.
7. **Premium y Lavado de Motor tenían descripciones que no mencionaban la limpieza y desinfección con máquina de vapor**, aunque el requerimiento comercial ya lo definía.
8. **El service worker cachea la app**, por lo que cada cambio de funcionalidad necesita incrementar `CACHE_VERSION`.

## Correcciones previstas

- Añadir reglas puras y testeables de duración, solapamiento y membresía.
- Validar intervalos de turnos y repetir la validación antes de confirmar.
- Agregar edición de turnos futuros y de lavados desde el panel del dueño.
- Hacer idempotente la acción de llegada usando `turnoId`.
- Aplicar el beneficio de membresía en el cuarto lavado completado del mismo vehículo dentro del mes: descuento fijo de `$5.000`, conservando el precio base y dejando trazabilidad en el lavado.
- Aplicar la membresía al `Lavado Estándar`/`Lavado Completo` y no a Premium, Motor, Tapizado ni motos.
- Actualizar las descripciones comerciales de Premium y Motor con vapor.
- Versionar el service worker.
