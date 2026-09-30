# Implementación de selección inteligente de vehículos

## Alcance

Se implementó la mejora del flujo público de reservas de LavaderoCF manteniendo la arquitectura existente, la persistencia actual y los campos históricos de las reservas.

El flujo activo en producción es el HTML monolítico `index.html`, por lo que la implementación principal se conectó a su función `renderReserva()`. También se actualizó el módulo alternativo `js/modules/turnos.js` para mantener ambos caminos compatibles con el mismo catálogo.

## Cambios realizados

### Catálogo local

Nuevo archivo: `js/data/vehiculos.js`.

Incluye:

- 82 modelos frecuentes del mercado argentino/regional.
- 14 marcas, incluyendo Volkswagen, Toyota, Chevrolet, Fiat, Ford, Honda, Nissan, Peugeot, Renault, Citroën, Jeep, Mercedes-Benz, BMW y Audi.
- Búsqueda normalizada, tolerante a mayúsculas, minúsculas y acentos.
- Aliases por marca/modelo y modelo individual.
- Categorías normalizadas:
  - `auto`
  - `familiar`
  - `suv`
- Metadata visual y mapeo de compatibilidad con valores históricos.

### Matriz de precios

| Servicio | Auto | Familiar / Rural | SUV / Pick-up / 4x4 |
|---|---:|---:|---:|
| Lavado Estándar | $30.000 | $35.000 | $40.000 |
| Lavado Premium | $80.000 | $95.000 | $110.000 |

Los precios Premium se conservaron según la matriz existente del proyecto.

Para otros servicios existentes se mantienen sus precios guardados, utilizando sus campos específicos por categoría cuando están disponibles.

### Experiencia de reserva

En la etapa de selección se agregó:

- Buscador por marca o modelo.
- Sugerencias autocompletables.
- Selección exacta de modelo.
- Detección automática de categoría.
- Tarifa visible y recalculada al seleccionar vehículo/servicio.
- Fallback visual explícito:
  - Auto / Sedán / Hatchback.
  - Familiar chico / Rural.
  - SUV / Pick-up / 4x4.
  - Moto, conservada por compatibilidad con los servicios existentes.
- Resumen previo a la confirmación con:
  - Marca/modelo.
  - Categoría.
  - Servicio.
  - Fecha y hora.
  - Precio final.

### Compatibilidad y persistencia

- Se conserva el campo histórico `tipoVehiculo` mediante un mapeo explícito:
  - Auto → `auto`
  - Familiar → `camioneta`
  - SUV → `4x4`
  - Moto → `moto`
- Se agregan de forma aditiva los campos `vehiculoCategoria`, `vehiculoMarca` y `vehiculoModelo`.
- Al pasar un turno a la cola de lavados, se propagan patente, marca, modelo y categoría, con fallback a los campos antiguos cuando corresponde.
- No se modifica el esquema de IndexedDB, endpoints ni stores existentes.

### Rendimiento y caché

- La carga del catálogo y la inicialización de datos se realizan en paralelo en `appInit()`.
- El catálogo local no requiere peticiones remotas.
- Se mantiene el code splitting existente del módulo alternativo.
- Se actualizó la versión del Service Worker a `lavaderocf-v1.4.0`.
- Se agregó `js/data/vehiculos.js` al precache.
- El flujo alternativo de módulos usa `getTurnosByFecha()` cuando está disponible, evitando cargar innecesariamente todos los turnos.

## Validación ejecutada

Pasaron correctamente:

- `node --check js/data/vehiculos.js`
- `node --check js/modules/turnos.js`
- `node --check sw.js`
- Validación de sintaxis de los dos scripts inline extraídos de `index.html`.
- Pruebas de búsqueda para `Suran` y `T-Cross`.
- Pruebas de precios Standard: `30000`, `35000`, `40000`.
- Pruebas de precios Premium: `80000`, `95000`, `110000`.
- Verificación de los 36 assets precacheados del Service Worker.
- `git diff --check`.
- HTTP local: `index.html` y `js/data/vehiculos.js` responden `200`.
- HTTP público sandbox: `index.html` responde `200`.
- Revisión independiente de integración; los hallazgos detectados fueron corregidos y verificados nuevamente.

## Limitación de build

El repositorio no contiene `package.json`, lockfile ni configuración de bundler, por lo que no existe un comando formal `build` para ejecutar. La validación equivalente se realizó mediante comprobación sintáctica de JavaScript, análisis de imports, pruebas de reglas de negocio, verificación de assets y comprobaciones HTTP.

## Propuestas futuras

1. **Duración por categoría configurable:** mover los minutos de Auto/Familiar/SUV a configuración del negocio para que el dueño pueda ajustarlos sin tocar código.
2. **Adicionales y upselling:** ofrecer encerado, tratamiento de plásticos, limpieza de tapizados y otros extras con precio y duración independientes.
3. **Recordatorios automáticos:** enviar recordatorios por WhatsApp 30 días después del último lavado, con opt-in del cliente.
4. **Disponibilidad más precisa:** consultar slots por rango de fecha y calcular solapamientos con la duración real guardada en cada turno.
5. **Mantenimiento del catálogo:** agregar una pantalla administrativa para incorporar modelos nuevos y corregir categorías sin publicar código.
6. **Observabilidad:** registrar tiempos de carga, fallos de IndexedDB/Firestore y eventos de abandono del flujo para priorizar mejoras UX.
7. **Accesibilidad:** añadir navegación completa por teclado, `aria-activedescendant` para sugerencias y pruebas con lector de pantalla.
8. **PWA más eficiente:** revisar si módulos administrativos pueden salir del precache inicial y cargarse bajo demanda sin afectar el modo offline.
