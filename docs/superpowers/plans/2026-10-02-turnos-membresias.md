# Turnos y membresías — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Corregir el flujo de reservas de LavaderoCF para evitar solapamientos y duplicados, permitir al dueño editar turnos y lavados, y aplicar automáticamente un beneficio mensual de `$5.000` en el cuarto Lavado Estándar/Completo del mismo vehículo.

**Architecture:** Mantener la aplicación estática y el patrón existente de `index.html` + Firestore. Extraer las reglas puras de duración, disponibilidad y membresía a un módulo ES independiente para poder probarlas con Node sin navegador; el shell actual las cargará dinámicamente junto con el catálogo de vehículos. Las modificaciones de UI y persistencia quedan en `index.html` para respetar la arquitectura existente.

**Tech Stack:** HTML/CSS/JavaScript vanilla, Firebase Firestore 10.12.2 vía CDN, Node test runner.

**Spec:** `docs/turnos-membresia-auditoria.md`

## Global Constraints

- No modificar `master` durante esta iteración; trabajar en la rama `lavaderocfapp`.
- Mantener los precios comerciales aprobados: Estándar `$30.000/$35.000/$40.000`, Premium `$80.000/$95.000/$110.000`, Motor `$50.000`, Tapizado `$150.000`, Moto 110 `$16.000`, Moto 150 `$18.000`.
- Premium y Motor deben mencionar limpieza y desinfección con máquina de vapor.
- La membresía descuenta exactamente `$5.000` en el cuarto lavado del mes del mismo vehículo y conserva `precioBase`, `descuentoMembresia` y `precio` en el lavado.
- Los intervalos activos de turnos son `pendiente` y `confirmado`; los cancelados o convertidos no bloquean disponibilidad.
- La acción de llegada no puede crear dos lavados para el mismo `turnoId`.
- Incrementar la versión del service worker para que los celulares reciban el código nuevo.

## Review Focus

- Dos reservas de distinta duración que se pisan parcialmente deben bloquearse.
- Editar un turno debe excluir su propio intervalo al verificar disponibilidad.
- Confirmar dos veces la llegada de un turno no debe duplicar el lavado.
- El cuarto lavado debe descontar `$5.000`; el tercero no y el cuarto de otra patente tampoco.
- Un lavado Premium, Motor, Tapizado o Moto no debe recibir la membresía.

---

### Task 1: Reglas puras de negocio

**Files:**
- Create: `js/domain/booking-rules.mjs`
- Create: `tests/booking-rules.test.mjs`

**Interfaces:**
- Produces `durationMinutesForVehicle`, `toMinutes`, `intervalsOverlap`, `isSlotAvailable`, `monthlyVehicleWashCount`, `membershipBenefitFor`.

- [x] Implementar funciones puras para convertir hora a minutos, calcular duración (`auto 60`, `familiar/camioneta 90`, `suv/4x4 120`, `moto 30`), detectar solapamiento y excluir el turno editado.
- [x] Implementar el conteo mensual por `clienteId` + patente normalizada solo para lavados `listo`/`archivado`.
- [x] Implementar el beneficio de `$5.000` cuando el conteo previo es exactamente `3` y el servicio es Estándar/Completo; devolver también progreso y precio final.
- [x] Escribir pruebas Node para solapamiento, exclusión, cuarto lavado, patente diferente y servicios no elegibles.
- [x] Ejecutar `node --test tests/booking-rules.test.mjs` y dejar todo en verde.

### Task 2: Reservas públicas seguras

**Files:**
- Modify: `index.html`
- Modify: `sw.js`

**Interfaces:**
- Consumes the functions from `js/domain/booking-rules.mjs` through the `bookingRules` namespace loaded at startup.

- [x] Cargar el módulo de reglas junto con el catálogo de vehículos.
- [x] Generar slots respetando duración y bloquear cualquier intervalo superpuesto, no solo la misma hora.
- [x] Revalidar disponibilidad justo antes de persistir el turno y guardar `duracionMinutos`.
- [x] Mostrar en el resumen el precio base y el beneficio solo cuando corresponda a un cliente/vehículo identificado.
- [x] Incrementar `CACHE_VERSION`.

### Task 3: Edición de turnos y conversión idempotente

**Files:**
- Modify: `index.html`

- [x] Agregar botón `Editar` en los turnos activos y un modal de edición para datos de cliente, patente, marca/modelo, categoría, servicio, fecha y hora.
- [x] Validar intervalos al guardar excluyendo el propio turno y recalcular precio/duración cuando cambien servicio o categoría.
- [x] Mostrar turnos ya convertidos sin un botón que vuelva a crear el lavado.
- [x] En `confirmarTurnoLlegada`, buscar primero un lavado con `turnoId`; si existe, no crear otro y navegar a Hoy.
- [x] Cambiar el turno a `ingresado` al convertirlo y conservar el `turnoId` en el lavado.

### Task 4: Edición del lavado del día y membresía

**Files:**
- Modify: `index.html`

- [x] Agregar `Editar` a cada ficha de lavado para que el dueño pueda corregir cliente, teléfono, patente, marca/modelo, tipo, servicio, estado, precio y notas.
- [x] Aplicar el cálculo de membresía al registrar desde mostrador y al convertir un turno, mostrando progreso y descuento.
- [x] Guardar `precioBase`, `descuentoMembresia`, `membresiaMes`, `membresiaVehiculo` y `membresiaAplicada` en el lavado.
- [x] Mostrar en la ficha del cliente el progreso del mes por vehículo y el historial del beneficio.
- [x] Actualizar las descripciones seed/migración de Premium y Motor con vapor sin cambiar precios.

### Task 5: Validación final

- [x] Ejecutar las pruebas de reglas puras.
- [x] Ejecutar comprobaciones sintácticas con `node --check` sobre scripts extraídos o mediante validación de estructura.
- [x] Levantar un servidor estático local, verificar `/`, `/reservar` y assets nuevos con HTTP 200.
- [x] Revisar `git diff --check` y el estado de la rama.
- [x] Hacer una revisión independiente de solo lectura antes de proponer push.


## Resultado de implementación

Todas las tareas del plan fueron implementadas en `lavaderocfapp`. Verificación final: 6/6 pruebas, sintaxis inline y módulos sin errores, `git diff --check` limpio.
