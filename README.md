# LavaderoCF — App de Gestión

> *El esplendor que tu coche merece.*

App de gestión completa para **LavaderoCF**, construida como una **Progressive Web App (PWA)** que funciona 100% offline y se instala en tu celular como una app nativa.

---

## 📱 Cómo instalar la app en el celular

### En Android (Chrome)

1. Abrí Chrome en tu celular y navegá a la URL donde está alojada la app.
2. Tocá el ícono de menú (⋮) en la esquina superior derecha.
3. Seleccioná **"Agregar a pantalla de inicio"** o **"Instalar app"**.
4. Confirmá. El ícono de LavaderoCF aparecerá en tu pantalla de inicio.

### En iPhone (Safari)

1. Abrí Safari y navegá a la URL de la app.
2. Tocá el botón de compartir (📤) en la barra inferior.
3. Seleccioná **"Agregar a pantalla de inicio"**.
4. Confirmá. La app queda instalada con su ícono.

> **Importante:** La app necesita estar servida desde un servidor web (HTTPS o localhost) para que el Service Worker funcione. No abrirla directamente como archivo (`file://`).

### Cómo servir localmente para pruebas

Si tenés Node.js instalado:
```bash
cd lavadero-cf-app
npx serve .
```
Luego abrí `http://localhost:3000` en el celular (conectado a la misma red Wi-Fi).

Alternativa con Python:
```bash
cd lavadero-cf-app
python -m http.server 8080
```

---

## 💾 Copia de seguridad

### Exportar datos

1. Iniciá sesión como **Dueño** (PIN: 0000 por defecto).
2. Ir a **Configuración** (última opción del menú).
3. Sección **"Copia de Seguridad"** → botón **"Descargar copia de seguridad (.json)"**.
4. Se descarga un archivo `lavaderocf-backup-YYYY-MM-DD.json` con todos los datos.

### Restaurar datos (cambio de celular o reseteo de app)

1. Ir a **Configuración** → **"Restaurar desde copia de seguridad"**.
2. Seleccioná el archivo `.json` previamente exportado.
3. Confirmá la restauración (⚠️ reemplaza todos los datos actuales).
4. La app se recarga con todos los datos restaurados.

> **Recomendación:** Hacé una copia de seguridad **al menos una vez por semana**. Guardala en Google Drive o en el email.

---

## 🔑 Accesos iniciales

| Rol | Nombre | PIN |
|-----|--------|-----|
| Dueño | Dueño 👑 | `0000` |

Para cambiar el PIN del dueño o agregar empleados: **Dueño → Empleados**.

---

## 📡 Conectar IA externa (Grok)

1. Obtené una API key de [x.ai](https://x.ai) (plataforma de Grok).
2. En la app: **Configuración → Inteligencia Artificial → API Key de IA**.
3. Pegá la key y guardá.
4. Las recomendaciones del módulo de IA pasarán a usar Grok cuando haya internet.

---

## 🔗 Link de reservas para clientes

El link de reservas es:
```
[URL de la app]#/reserva
```

Compartí este link por WhatsApp o mostralo como QR (generado automáticamente en Configuración).

---

## 🛠️ Para el Agente (continuación del proyecto)

### Estructura del proyecto

```
lavadero-cf-app/
├── index.html              # Shell SPA
├── manifest.json           # Configuración PWA
├── sw.js                   # Service Worker (cache offline)
├── assets/
│   ├── logo.jpg            # Logo oficial
│   └── icons/              # Íconos PWA (192, 512)
├── css/
│   ├── tokens.css          # Variables de diseño (TOCAR PRIMERO al cambiar paleta)
│   ├── base.css            # Reset + tipografía
│   ├── components.css      # Botones, inputs, cards, modales
│   ├── layout.css          # Shell, header, bottom-nav
│   └── animations.css      # Transiciones y keyframes
└── js/
    ├── app.js              # Entry point, sistema de toasts
    ├── router.js           # Hash router SPA
    ├── auth.js             # Sesión y guard de rutas
    ├── db/
    │   ├── db.js           # Wrapper IndexedDB (FUENTE PRINCIPAL DE DATOS)
    │   ├── schema.js       # Stores e índices
    │   └── seeds.js        # Datos iniciales (servicios + dueño)
    ├── modules/            # Una pantalla = un módulo
    │   ├── login.js
    │   ├── clientes.js
    │   ├── registro.js
    │   ├── vehiculos-dia.js
    │   ├── turnos.js       # Panel público (sin login)
    │   ├── dashboard.js
    │   ├── cierre-caja.js
    │   ├── costos.js
    │   ├── empleados.js
    │   ├── servicios.js
    │   ├── recordatorios.js
    │   ├── configuracion.js
    │   └── ia.js
    └── utils/
        ├── format.js       # Moneda y fechas en español argentino
        ├── csv.js          # Exportar/importar CSV
        ├── whatsapp.js     # URLs de WhatsApp pre-armadas
        ├── calendar.js     # Descarga de archivos .ics
        └── charts.js       # Gráficos con Canvas API puro
```

### Contratos de módulos

Cada módulo en `js/modules/` sigue este patrón:
```js
export async function render(container) { /* Inyecta HTML en el container */ }
export async function init() { /* Configura event listeners */ }
```

El router llama a `render(appContainer)` y luego a `init()` al navegar.

### Cómo agregar un módulo nuevo

1. Crear `js/modules/nuevo-modulo.js` con las funciones `render` e `init`.
2. En `js/router.js`, agregar la ruta:
   ```js
   router.register('#/dueno/nuevo', {
     module: () => import('./modules/nuevo-modulo.js'),
     requiresAuth: true,
     requiredRole: 'dueno'
   });
   ```
3. En el bottom-nav correspondiente, agregar el link.
4. Actualizar `sw.js` → lista `STATIC_ASSETS` para que el módulo se cachee.
5. **Actualizar la directiva** `directivas/lavaderocf_app_SOP.md` con los cambios.

### Versionado del Service Worker

Al hacer cambios que deban reflejarse en dispositivos ya instalados:
1. Incrementar `CACHE_VERSION` en `sw.js` (ej: `lavaderocf-v1.0.1`).
2. Commitear el cambio.
3. El SW detectará la nueva versión y actualizará la cache automáticamente.

### Directiva del agente

La directiva de trabajo del agente está en:
```
directivas/lavaderocf_app_SOP.md
```
**Siempre leerla antes de tocar el proyecto.** Si se descubre una nueva restricción o comportamiento, actualizarla.

### Git — Convención de commits

```
feat(modulo): descripcion en español
fix(modulo): descripcion del error corregido
style(css): cambio visual específico
refactor(db): mejora de queries
docs: actualización de README o directiva
pwa: cambios en manifest o service worker
```

---

## 🏗️ Historial de construcción

| Módulo | Estado |
|--------|--------|
| CSS Layer (tokens, base, components, layout, animations) | ✅ |
| Utils (format, csv, whatsapp, calendar, charts) | ✅ |
| DB Layer (db, schema, seeds) | ✅ |
| Core JS (app, router, auth) | ✅ |
| Login/Splash | ✅ |
| Clientes | ✅ |
| Registro Rápido | ✅ |
| Vehículos del Día | ✅ |
| Dashboard | ✅ |
| Cierre de Caja | ✅ |
| Costos | ✅ |
| Empleados | ✅ |
| Servicios | ✅ |
| Recordatorios 30 días | ✅ |
| Motor IA (heurístico + hook Grok) | ✅ |
| Panel Público de Reservas | ✅ |
| Configuración (backup, API key, QR) | ✅ |
| manifest.json | ✅ |
| Service Worker | ✅ |
| Íconos PWA | ✅ |

---

## ⚠️ Notas técnicas

- **IndexedDB en iOS Safari:** Compatible, pero Safari puede borrar datos si el almacenamiento del dispositivo está lleno. Hacer copias de seguridad periódicas.
- **Service Worker:** Solo funciona en HTTPS o localhost. En producción, servir desde Hostinger u otro hosting con SSL.
- **Sin conexión a internet:** Todos los datos y la interfaz funcionan offline. Solo se necesita internet para Google Fonts (primer acceso), el QR, y las llamadas a la API de IA externa.
- **Backup recomendado:** Exportar el JSON semanalmente y guardarlo en la nube.
