# Operación, membresía y cierre de caja — Plan de implementación

**Goal:** Completar la operación diaria de LavaderoCF sin perder historial: alta manual de membresía, gestión segura de empleados, detalle de lavados finalizados, auto-cierre de caja y limpieza correcta de turnos al ingresar.

**Architecture:** Mantener `index.html` como runtime canónico de la aplicación y extender las reglas puras de `js/domain/booking-rules.mjs` solo donde corresponda. La membresía se guardará en la ficha del cliente como acuerdo explícito del dueño; el descuento se calculará únicamente si el cliente está activo en membresía. El cierre será idempotente y conservará snapshots detallados para auditoría.

**Tech Stack:** HTML/JavaScript inline, Firestore vía wrapper existente, pruebas nativas de Node para reglas puras.

**Spec:** Reporte del dueño del 14/10/2026 y requisito persistente de guardar clientes, mostrar turnos por semana y pasar el vehículo al panel del día.

## Global Constraints

- No modificar `master`, `lavaderocfapp` ni publicar en Vercel durante esta revisión.
- No eliminar físicamente empleados ni lavados: usar desactivación/archivado reversible y conservar historial.
- La membresía es opt-in manual del dueño, por cliente + patente, reinicia por mes y descuenta $5.000 en el cuarto Lavado Estándar elegible.
- Los lavados finalizados deben conservar cliente, vehículo, servicio, precio, empleado, notas y horarios hasta y después del cierre mediante snapshot.
- Un turno ingresado debe dejar de aparecer entre pendientes/turnos activos y permanecer trazable como ingresado hasta su conversión.
- El auto-cierre no debe duplicar cierres ni liquidaciones.

## Review Focus

- Un cliente sin membresía no recibe descuento aunque tenga cuatro lavados.
- Un miembro activo con una patente distinta no consume el progreso de otra patente.
- Cerrar caja dos veces no crea dos cierres ni archiva datos de forma destructiva.
- Un turno ingresado no vuelve a mostrarse como pendiente ni permite crear un segundo lavado.
- Un empleado desactivado conserva sus comisiones e historial y deja de aparecer para nuevas asignaciones.

### Task 1: Membresía explícita en ficha de cliente

**Files:**
- Modify: `index.html` — ficha y edición de cliente, cálculo de membresía y alta desde mostrador.
- Modify: `js/domain/booking-rules.mjs` — aceptar condición de membresía activa.
- Test: `tests/booking-rules.test.mjs` — cubrir opt-in y exclusión.

**Interfaces:**
- `membershipBenefitFor({ serviceName, basePrice, previousCount, membershipActive })` devuelve beneficio solo cuando `membershipActive === true`.
- Cliente: `membresia: { activa: boolean, desde: string, porPatente: string[] }`.

- [ ] Agregar controles “Activar membresía” y “Desactivar membresía” en la ficha del cliente, exclusivos del dueño.
- [ ] Permitir seleccionar una o más patentes existentes al activar; si no hay patente, informar que primero debe registrarse.
- [ ] Calcular el descuento solo para cliente miembro, patente incluida y cuarto lavado estándar del mes.
- [ ] Guardar auditoría mínima: `membresia.activa`, `membresia.desde`, `membresia.porPatente`.
- [ ] Agregar pruebas de miembro inactivo, miembro activo con patente y servicio no elegible.

### Task 2: Empleados y finalizados auditables

**Files:**
- Modify: `index.html` — acciones de empleado y tarjetas/detalle de lavados listos/archivados.

**Interfaces:**
- “Eliminar del equipo” será desactivación reversible; no se borra el documento histórico.
- Cada lavado finalizado mostrará detalle expandible y acción de edición para el dueño mientras la caja del día no esté cerrada.

- [ ] Hacer visible la acción de retirar/desactivar empleado y explicar que conserva historial.
- [ ] Mostrar en finalizados cliente, patente, marca/modelo, servicio, precio base/final, descuento, empleado, notas, inicio y fin.
- [ ] Permitir editar detalle antes del cierre; después del cierre, permitir solo consulta/exportación.

### Task 3: Auto-cierre de caja y aviso al dueño

**Files:**
- Modify: `index.html` — función idempotente de cierre y llamada en arranque/dashboard.
- Modify: `tests/booking-rules.test.mjs` si se extrae una función pura de vencimiento.

- [ ] A las 20:00 hora local, si el día tiene lavados listos y no hay cierre, generar cierre automático con `origen: 'auto-20:00'`.
- [ ] Archivar los lavados incluidos conservando snapshot detallado.
- [ ] Mostrar al dueño un aviso de cierre automático la próxima vez que abra la aplicación.
- [ ] Si todavía no hay lavados finalizados, no generar un cierre vacío accidental.
- [ ] Mantener la operación manual idempotente y sin doble cierre.

### Task 4: Estado de turno al ingresar

**Files:**
- Modify: `index.html` — `confirmarTurnoLlegada`, filtros del banner del día y agenda semanal.
- Test: `tests/booking-rules.test.mjs` — estados activos vs ingresados.

- [ ] Al ingresar, cambiar el turno a `ingresado` y ocultarlo de la lista de turnos pendientes/confirmados.
- [ ] Conservarlo en historial/agenda con indicador “Ingresado” y vínculo al `lavadoId` determinista.
- [ ] Mostrar el lavado creado una sola vez en Vehículos del Día como `en_espera`.
- [ ] Si ya existe lavado para ese turno, no crear duplicado y retirar el turno de pendientes.

## Verification

- [ ] Ejecutar `npm test`.
- [ ] Ejecutar `node --check` sobre módulo, pruebas y JavaScript inline.
- [ ] Ejecutar `git diff --check`.
- [ ] Validar que la rama de revisión no tenga cambios fuera de este alcance.
- [ ] No publicar ni fusionar hasta revisión explícita del dueño.
