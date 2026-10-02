# Auditoría y correcciones de la aplicación LavaderoCF

## Base revisada

- Repositorio: `cesar39426-droid/lavadero-cf-app`
- Branch de trabajo: `lavaderocfapp`
- Runtime canónico servido por Vercel: `index.html` con Firestore 10.12.2 vía CDN.
- El árbol `js/app.js` + `js/modules/` es legado y no se carga desde `index.html`; tampoco se precachea en el service worker.

## Correcciones implementadas

1. **Disponibilidad por intervalos:** los turnos guardan `duracionMinutos`, los horarios respetan el cierre y la disponibilidad bloquea solapamientos parciales.
2. **Reserva concurrente:** cada turno nuevo crea, dentro de una transacción Firestore, documentos únicos en `turnoBloqueos` para cada intervalo de 30 minutos. Dos clientes no pueden confirmar la misma franja; al editar, cancelar o ingresar se actualizan/liberan esos bloqueos.
3. **Migración de datos existentes:** al iniciar, los turnos activos heredados reciben duración y bloqueos; si ya existe un conflicto se conserva el turno y se evita bloquear una franja adicional.
4. **Edición de turnos:** el dueño puede corregir cliente, teléfono, fecha, hora, patente, marca, modelo, categoría y servicio, con revalidación transaccional.
5. **Llegada idempotente:** la conversión usa `turnoId`, un id determinista (`turno-<id>`) y una transacción conjunta para no crear dos lavados aunque se pulse dos veces.
6. **Agenda visible:** se muestran todos los turnos futuros existentes, no solo seis días; los ya ingresados quedan visibles sin botón de nueva conversión.
7. **Edición de fichas del día:** el dueño puede editar también lavados `listo`/`archivado`, además de los que están en espera o proceso.
8. **Membresía mensual:** el cuarto lavado completado del mismo `clienteId` + patente normalizada aplica exactamente `$5.000` en `Lavado Estándar` o `Lavado Completo`. Premium, Motor, Tapizado y motos no reciben el beneficio. Se guardan precio base, descuento, mes, vehículo y precio final.
9. **Reserva pública:** permite `Lavado Completo`, muestra el beneficio si corresponde, revalida disponibilidad antes de guardar y comunica un conflicto concurrente sin duplicar la reserva.
10. **Datos comerciales:** Premium y Lavado de Motor incluyen limpieza y desinfección con máquina de vapor sin alterar precios.
11. **Caché:** `CACHE_VERSION` pasa a `lavaderocf-v1.5.0`, con comentario consistente y solo los módulos del runtime canónico.

## Evidencia de validación

- `npm test`: **6/6 pruebas exitosas**.
- `node --check`: módulo de reglas, pruebas y JavaScript inline del HTML sin errores.
- `git diff --check`: limpio.
- Servidor estático local: `/`, `js/domain/booking-rules.mjs` y `sw.js` responden HTTP 200.

## Límites y operación

- Firestore debe permitir escritura en `turnos` y `turnoBloqueos` para el usuario que reserva; las reglas de seguridad deben validarse en el proyecto Firebase antes de producción.
- Los turnos antiguos que ya se solapaban no se borran automáticamente: la migración evita crear nuevos bloqueos ambiguos y deja el conflicto visible para que el dueño lo corrija desde el panel.
