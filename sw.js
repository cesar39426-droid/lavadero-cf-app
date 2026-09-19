/**
 * sw.js — Service Worker de LavaderoCF
 * Estrategia: Cache-First para assets estáticos, Network-First para rutas de datos.
 * Versión: 1.0.0
 */

const CACHE_VERSION = 'lavaderocf-v1.2.0';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;

// Assets críticos que se cachean en la instalación
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/tokens.css',
  '/css/base.css',
  '/css/components.css',
  '/css/layout.css',
  '/css/animations.css',
  '/js/app.js',
  '/js/router.js',
  '/js/auth.js',
  '/js/db/db.js',
  '/js/db/schema.js',
  '/js/db/seeds.js',
  '/js/modules/login.js',
  '/js/modules/clientes.js',
  '/js/modules/registro.js',
  '/js/modules/vehiculos-dia.js',
  '/js/modules/turnos.js',
  '/js/modules/dashboard.js',
  '/js/modules/cierre-caja.js',
  '/js/modules/costos.js',
  '/js/modules/empleados.js',
  '/js/modules/servicios.js',
  '/js/modules/recordatorios.js',
  '/js/modules/configuracion.js',
  '/js/modules/ia.js',
  '/js/utils/format.js',
  '/js/utils/csv.js',
  '/js/utils/whatsapp.js',
  '/js/utils/calendar.js',
  '/js/utils/charts.js',
  '/assets/logo.jpg',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
];

// ─── Install ───────────────────────────────────────────────────────────────
// Pre-cachear todos los assets estáticos
self.addEventListener('install', event => {
  console.log('[SW] Instalando versión:', CACHE_VERSION);

  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('[SW] Cacheando assets estáticos...');
        // Usar addAll con manejo de errores individuales
        return Promise.allSettled(
          STATIC_ASSETS.map(url =>
            cache.add(url).catch(err => {
              console.warn(`[SW] No se pudo cachear ${url}:`, err);
            })
          )
        );
      })
      .then(() => {
        console.log('[SW] Assets cacheados. Activando inmediatamente...');
        return self.skipWaiting();
      })
  );
});

// ─── Activate ─────────────────────────────────────────────────────────────
// Limpiar caches antiguas
self.addEventListener('activate', event => {
  console.log('[SW] Activando versión:', CACHE_VERSION);

  event.waitUntil(
    caches.keys()
      .then(keys => {
        return Promise.all(
          keys
            .filter(key => key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
            .map(key => {
              console.log('[SW] Eliminando cache antigua:', key);
              return caches.delete(key);
            })
        );
      })
      .then(() => {
        console.log('[SW] Tomando control de todos los clientes...');
        return self.clients.claim();
      })
  );
});

// ─── Fetch ────────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Solo manejar requests HTTP/HTTPS del mismo origen o Google Fonts
  if (!request.url.startsWith('http')) return;

  // Ignorar requests de Chrome DevTools y extensiones
  if (url.hostname === 'chrome-extension') return;

  // Google Fonts — Network-First con fallback a cache
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(networkFirstWithCache(request, DYNAMIC_CACHE));
    return;
  }

  // QR API — Network-Only (no tiene sentido cachear)
  if (url.hostname.includes('api.qrserver.com')) {
    event.respondWith(fetch(request).catch(() => new Response('', { status: 503 })));
    return;
  }

  // API externa de IA — Network-Only
  if (url.pathname.includes('/api/') || url.hostname.includes('api.x.ai') || url.hostname.includes('api.openai.com')) {
    event.respondWith(fetch(request));
    return;
  }

  // Assets estáticos — Cache-First
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Todo lo demás — Network-First con fallback a cache
  event.respondWith(networkFirstWithCache(request, DYNAMIC_CACHE));
});

// ─── Estrategias de cache ─────────────────────────────────────────────────

/**
 * Cache-First: busca en cache, si no está va a la red y actualiza la cache.
 */
async function cacheFirst(request) {
  try {
    const cached = await caches.match(request);
    if (cached) return cached;

    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    console.warn('[SW] Cache-First falló para:', request.url);
    return new Response('Sin conexión', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}

/**
 * Network-First: intenta la red, guarda en cache, si falla usa cache.
 */
async function networkFirstWithCache(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;

    // Fallback para HTML: devolver index.html para rutas SPA
    if (request.headers.get('Accept')?.includes('text/html')) {
      const indexCache = await caches.match('/index.html');
      if (indexCache) return indexCache;
    }

    return new Response('Sin conexión. La app funciona offline una vez cargada por primera vez.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function isStaticAsset(url) {
  const staticExtensions = ['.css', '.js', '.png', '.jpg', '.jpeg', '.svg', '.ico', '.woff', '.woff2', '.ttf'];
  return staticExtensions.some(ext => url.pathname.endsWith(ext));
}

// ─── Mensajes desde la app ────────────────────────────────────────────────
// Permite forzar actualización desde la UI

self.addEventListener('message', event => {
  if (event.data?.action === 'skipWaiting') {
    console.log('[SW] Skip waiting solicitado desde la app.');
    self.skipWaiting();
  }

  if (event.data?.action === 'getCacheVersion') {
    event.ports[0]?.postMessage({ version: CACHE_VERSION });
  }
});
