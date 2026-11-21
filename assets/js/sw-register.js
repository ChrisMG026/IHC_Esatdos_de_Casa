/* Registro silencioso del Service Worker: solo mejora velocidad,
   si el navegador no lo soporta la pagina sigue funcionando igual. */
(function () {
    if (!('serviceWorker' in navigator)) return;
    window.addEventListener('load', function () {
        navigator.serviceWorker.register('../sw.js', { scope: '../' }).catch(function () {});
    });
})();
