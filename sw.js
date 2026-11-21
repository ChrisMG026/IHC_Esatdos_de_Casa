/* ============================================================
   RESIDENTE HUB — Service Worker de precarga y cache
   Guarda CSS, JS y librerias en cache para que la navegacion
   entre pantallas sea inmediata. Nunca intercepta PHP ni
   peticiones de navegacion: la sesion y los datos siguen
   viniendo siempre del servidor.
   ============================================================ */

var CACHE_NAME = 'residente-hub-v6.4';

var PRECACHE = [
    './assets/css/styles.css?v=6.4',
    './assets/js/ui-estados.js?v=6.4',
    './assets/js/auth_check.js?v=6.4',
    './assets/js/tema.js?v=6.4',
    './assets/js/login.js?v=6.4',
    './assets/js/script.js?v=6.4',
    './assets/js/dashboard.js?v=6.4',
    './assets/js/contratos.js?v=6.4',
    './assets/js/estacionamiento.js?v=6.4',
    './assets/js/reportes.js?v=6.4',
    './assets/js/configuraciones.js?v=6.4',
    './assets/js/admin_usuarios.js?v=6.4',
    './assets/js/sw-register.js?v=6.4',
];

var CDNS = [
    'fonts.googleapis.com',
    'fonts.gstatic.com',
    'cdnjs.cloudflare.com',
    'cdn.jsdelivr.net'
];

self.addEventListener('install', function (event) {
    event.waitUntil(
        caches.open(CACHE_NAME).then(function (cache) {
            return Promise.all(PRECACHE.map(function (url) {
                return cache.add(new Request(url, { cache: 'reload' })).catch(function () {
                    return null; // un archivo ausente no debe impedir la instalacion
                });
            }));
        }).then(function () {
            return self.skipWaiting();
        })
    );
});

self.addEventListener('activate', function (event) {
    event.waitUntil(
        caches.keys().then(function (keys) {
            return Promise.all(keys.map(function (key) {
                if (key.indexOf('residente-hub-') === 0 && key !== CACHE_NAME) {
                    return caches.delete(key);
                }
                return null;
            }));
        }).then(function () {
            return self.clients.claim();
        })
    );
});

self.addEventListener('fetch', function (event) {
    var request = event.request;
    if (request.method !== 'GET') return;

    var url = new URL(request.url);

    // Seguridad: nunca cachear sesion, PHP ni navegacion.
    if (request.mode === 'navigate') return;
    if (url.pathname.toLowerCase().indexOf('.php') !== -1) return;
    if (url.origin !== self.location.origin && CDNS.indexOf(url.hostname) === -1) return;

    var esLocal = url.origin === self.location.origin &&
        /\.(css|js|woff2?|svg|png|jpe?g|webp|ico)(\?|$)/i.test(url.pathname + url.search);
    if (!esLocal && CDNS.indexOf(url.hostname) === -1) return;

    event.respondWith(
        caches.match(request).then(function (guardado) {
            var actualizar = fetch(request).then(function (respuesta) {
                if (respuesta && (respuesta.ok || respuesta.type === 'opaque')) {
                    var copia = respuesta.clone();
                    caches.open(CACHE_NAME).then(function (cache) {
                        cache.put(request, copia);
                    });
                }
                return respuesta;
            }).catch(function () {
                return guardado;
            });

            // Locales: cache primero (velocidad). CDN: cache primero y refresco en segundo plano.
            return guardado || actualizar;
        })
    );
});
