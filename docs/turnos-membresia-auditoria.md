# Auditoría y correcciones de la aplicación LavaderoCF

## Base revisada

- Repositorio: `cesar39426-droid/lavadero-cf-app`
- Branch de trabajo: `revision-membresia-datos-2026-10-08` + revisión operativa local del 2026-10-15.
- Runtime canónico servido por Vercel: `index.html` con Firestore 10.12.2 vía CDN.
- El árbol `js/app.js` + `js/modules/` es legado y no se carga desde `index.html`; tampoco se precachea en el service worker.

## Correcciones implementadas

1. **Disponibilidad por intervalos:** los turnos guardan `duracionMinutos`, los horarios respetan el cierre y la disponibilidad bloquea solapamientos parciales.
2. **Reserva concurrente:** cada turno nuevo crea, dentro de una transacción Firestore, documentos únicos en `turnoBloqueos` para cada intervalo de 30 minutos. Dos clientes no pueden confirmar la misma franja; al editar, cancelar o ingresar se actualizan/liberan esos bloqueos.
3. **Migración de datos existentes:** al iniciar, los turnos activos heredados reciben duración y bloqueos; si ya existe un conflicto se conserva el turno y se evita bloquear una franja adicional.
4. **Edición de turnos:** el dueño puede corregir cliente, teléfono, fecha, hora, patente, marca, modelo, categoría y servicio, con revalidación transaccional.
5. **Llegada idempotente:** la conversión usa `turnoId`, un id determinista (`turno-<id>`) y una transacción conjunta para no crear dos lavados aunque se pulse dos veces.
6. **Agenda visible:** se muestran todos los turnos futuros existentes; los turnos con estado `ingresado` dejan de aparecer como pendientes después de pasar al panel del día.
7. **Edición de fichas del día:** el dueño puede editar también lavados `listo`/`archivado`, además de los que están en espera o proceso.
8. **Detalle de finalizados:** las tarjetas `listo` y `archivado` muestran un detalle expandible con inicio, fin, cliente/vehículo, precio base, descuento, empleados, notas y servicio. El historial queda en la ficha y en el snapshot del cierre.
9. **Membresía mensual explícita:** el beneficio requiere que el dueño active manualmente la membresía en la ficha del cliente y seleccione las patentes incluidas. El cuarto Lavado Estándar del mismo `clienteId` + patente aplica exactamente `$5.000`; Premium, Motor, Tapizados y motos no reciben el beneficio. Se guarda el alta, las patentes y la fecha de actualización.
10. **Reserva pública y mostrador:** el cálculo consulta la ficha del cliente y no aplica descuento a clientes sin membresía activa para esa patente.
11. **Datos comerciales:** Premium y Lavado de Motor incluyen limpieza y desinfección con máquina de vapor sin alterar precios.
12. **Caché:** `CACHE_VERSION` pasa a `lavaderocf-v1.5.0`, con comentario consistente y solo los módulos del runtime canónico.
13. **Cliente y día de lavado:** al reservar, se busca por teléfono; si no existe se crea en `clientes`, y si ya existe se reutiliza su `clienteId` sin crear otra ficha. El turno conserva nombre, teléfono, patente y vehículo, aparece en la agenda para su fecha y, cuando llega el día, aparece en `Vehículos del Día` como “Ingresar al día”; al ingresarlo queda en espera con la acción `Iniciar`.
14. **Empleados:** la acción visible “Retirar del equipo” desactiva al empleado de manera reversible y conserva su historial y comisiones; “Reactivar” permite volver a asignarlo.
15. **Auto-cierre de caja:** después de las 20:00, el primer chequeo de sesión y un temporizador de un minuto cierran automáticamente una caja del día que tenga lavados finalizados y aún no tenga cierre. El cierre queda marcado `origen: auto-20:00`, archiva sin borrar y guarda snapshot detallado; es idempotente.
16. **Aviso de auto-cierre:** el dueño ve una notificación inmediata y el panel de Cierre de Caja identifica que el cierre fue automático.
17. **Edición concurrente:** las transacciones leen el turno vigente dentro de Firestore y calculan los bloqueos desde ese documento. Una llegada que detecta una edición simultánea no revierte datos: informa al dueño y le pide revisar la agenda.

## Evidencia de validación

- `npm test`: **8/8 pruebas exitosas**.
- `node --check`: módulo de reglas, pruebas y JavaScript inline del HTML sin errores.
- `git diff --check`: limpio.
- Scripts de parche reproducibles guardados en `scripts/`.

## Límites y operación

- Firestore debe permitir escritura en `turnos`, `turnoBloqueos`, `clientes`, `lavados`, `cierres` y `empleados` para los roles correspondientes; las reglas de seguridad deben validarse en el proyecto Firebase antes de producción.
- Los turnos antiguos que ya se solapaban no se borran automáticamente: la migración evita crear nuevos bloqueos ambiguos y deja el conflicto visible para que el dueño lo corrija desde el panel.
- El auto-cierre se ejecuta cuando existe una sesión abierta o cuando el dueño vuelve a abrir la app después de las 20:00; no depende de que el navegador haya permanecido abierto todo el día.
- “Retirar del equipo” es la operación segura recomendada: no se elimina físicamente un empleado porque eso rompería la trazabilidad histórica de comisiones.

## Reglas comerciales confirmadas — revisión 2026-10-08

- La membresía vive únicamente en la aplicación, no se comunica como promoción automática en la web.
- El conteo es por combinación cliente + patente y se reinicia cada mes calendario.
- El beneficio se aplica en el cuarto Lavado Estándar del mes y descuenta $5.000 del precio vigente; no aplica a Premium, Motor, Tapizados ni motos.
- El dueño puede corregir manualmente el precio y la ficha antes de guardar.
- Catálogo actualizado: Moto 250 $20.000 y Tapizado Full $150.000, con retiro de asientos y limpieza del piso.
- Cuando una reserva usa un teléfono existente, se reutiliza la ficha del cliente y solo se agrega una nueva patente/vehículo si corresponde. El turno queda visible en la agenda semanal y, al llegar su fecha, en el panel del día para ingresar el lavado.
