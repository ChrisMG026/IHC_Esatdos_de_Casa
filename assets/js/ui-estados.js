/* ============================================================
   RESIDENTE HUB — ESTADOS DE INTERFAZ
   Progreso global de peticiones, estados vacios/error y sello
   de actualizacion. No altera el flujo de datos ni los endpoints.
   ============================================================ */
(function () {
    'use strict';

    function esc(valor) {
        return String(valor == null ? '' : valor).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function ico(nombre) {
        return '<span class="ui-ico ui-ico-' + esc(nombre) + '" aria-hidden="true"></span>';
    }

    function actualizarSello() {
        document.querySelectorAll('[data-estado-datos]').forEach(function (el) {
            el.textContent = 'Actualizado ' + new Date().toLocaleTimeString('es-MX', {
                hour: '2-digit', minute: '2-digit'
            });
        });
    }

    let pendientes = 0;
    function terminar() {
        pendientes = Math.max(0, pendientes - 1);
        if (pendientes === 0) {
            document.body.classList.remove('cargando');
            document.body.removeAttribute('aria-busy');
            actualizarSello();
        }
    }

    /* Barra de progreso automatica: envuelve fetch de forma transparente. */
    if (window.fetch) {
        const fetchOriginal = window.fetch.bind(window);
        window.fetch = function () {
            pendientes++;
            if (document.body) {
                document.body.classList.add('cargando');
                document.body.setAttribute('aria-busy', 'true');
            }
            return fetchOriginal.apply(window, arguments).then(
                function (respuesta) { terminar(); return respuesta; },
                function (error) { terminar(); throw error; }
            );
        };
    }

    window.UIEstados = {
        vacio: function (titulo, descripcion, icono) {
            return '<div class="estado-vacio">' + ico(icono || 'box') +
                '<strong>' + esc(titulo) + '</strong>' +
                (descripcion ? '<p>' + esc(descripcion) + '</p>' : '') + '</div>';
        },
        error: function (titulo, descripcion) {
            return '<div class="estado-error">' + ico('warning') +
                '<strong>' + esc(titulo) + '</strong>' +
                (descripcion ? '<p>' + esc(descripcion) + '</p>' : '') + '</div>';
        },
        cargando: function (texto) {
            return '<div class="estado-carga" role="status">' + esc(texto || 'Cargando información...') + '</div>';
        },
        filaVacia: function (colspan, titulo, descripcion, icono) {
            return '<tr class="fila-estado"><td colspan="' + Number(colspan) + '">' +
                window.UIEstados.vacio(titulo, descripcion, icono) + '</td></tr>';
        },
        filaError: function (colspan, titulo, descripcion) {
            return '<tr class="fila-estado"><td colspan="' + Number(colspan) + '">' +
                window.UIEstados.error(titulo, descripcion) + '</td></tr>';
        },
        filaCargando: function (colspan) {
            return '<tr class="fila-estado" data-esqueleto="true"><td colspan="' + Number(colspan) + '">' +
                '<div class="skeleton-tabla" aria-hidden="true">' +
                '<span class="skeleton-line"></span><span class="skeleton-line"></span><span class="skeleton-line"></span>' +
                '</div><span class="sr-only">Cargando información...</span></td></tr>';
        },
        mostrarErrorGlobal: function (mensaje) {
            let alerta = document.getElementById('alertaGlobalError');
            if (!alerta) {
                const contenedor = document.querySelector('.content') || document.body;
                alerta = document.createElement('div');
                alerta.id = 'alertaGlobalError';
                alerta.className = 'alerta-global';
                alerta.setAttribute('role', 'alert');
                contenedor.insertBefore(alerta, contenedor.firstChild);
            }
            alerta.innerHTML = ico('warning') +
                '<span><strong>No se pudo actualizar la información.</strong> ' +
                esc(mensaje || 'Revisa tu conexión e inténtalo de nuevo.') + '</span>' +
                '<button type="button" class="btn-ghost" onclick="location.reload()">Reintentar</button>';

            document.querySelectorAll('tr[data-esqueleto="true"]').forEach(function (fila) {
                const columnas = fila.querySelector('td').colSpan || 1;
                fila.outerHTML = window.UIEstados.filaError(
                    columnas, 'No se pudo cargar esta sección', 'Usa el botón Reintentar de la parte superior.'
                );
            });
        }
    };

    /* Esqueletos iniciales: solo en tablas vacías; el render real los reemplaza. */
    document.addEventListener('DOMContentLoaded', function () {
        document.querySelectorAll('table tbody').forEach(function (tbody) {
            if (tbody.children.length) return;
            const head = tbody.closest('table').querySelector('thead tr');
            const columnas = head ? head.children.length : 4;
            tbody.innerHTML = window.UIEstados.filaCargando(columnas);
        });
    });
})();
