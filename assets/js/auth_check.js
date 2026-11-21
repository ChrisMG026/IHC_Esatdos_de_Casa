// ==========================================
// ACCESIBILIDAD: saltar al contenido, Esc para cerrar ventanas, semántica de diálogo
// ==========================================
document.addEventListener("DOMContentLoaded", function() {
    if (window.location.pathname.includes('login.html')) return;
    let contenido = document.querySelector('.content');
    if (contenido) {
        contenido.id = contenido.id || 'contenido';
        let salto = document.createElement('a');
        salto.className = 'skip-link';
        salto.href = '#' + contenido.id;
        salto.innerText = 'Saltar al contenido';
        document.body.insertBefore(salto, document.body.firstChild);
    }
    document.addEventListener('keydown', function(e) {
        if (e.key !== 'Escape') return;
        document.querySelectorAll('.modal-overlay').forEach(m => {
            if (getComputedStyle(m).display !== 'none') m.style.display = 'none';
        });
    });
});
window.addEventListener('load', function() {
    document.querySelectorAll('.modal-card').forEach(c => {
        c.setAttribute('role', 'dialog');
        c.setAttribute('aria-modal', 'true');
    });
});

// ==========================================
// FOCO EN MODALES: foco inicial, Tab confinado y retorno al cerrar
// Se observa el cambio de display; no modifica ninguna funcion existente.
// ==========================================
(function () {
    let modalActivo = null;
    let focoAnterior = null;
    let observando = false;
    const selectorFoco = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    function focusables(modal) {
        return Array.from(modal.querySelectorAll(selectorFoco)).filter(el => el.getClientRects().length > 0);
    }

    function preparar(modal) {
        const card = modal.querySelector('.modal-card');
        if (!card) return;
        if (!card.hasAttribute('role')) card.setAttribute('role', 'dialog');
        if (!card.hasAttribute('aria-modal')) card.setAttribute('aria-modal', 'true');
        const titulo = card.querySelector('h1, h2, h3');
        if (titulo && !card.hasAttribute('aria-labelledby')) {
            if (!titulo.id) titulo.id = 'titulo-' + (modal.id || 'modal');
            card.setAttribute('aria-labelledby', titulo.id);
        }
    }

    function abrir(modal) {
        if (modalActivo === modal) return;
        modalActivo = modal;
        focoAnterior = document.activeElement;
        preparar(modal);
        const elementos = focusables(modal);
        const preferido = modal.querySelector('[autofocus]') ||
            elementos.find(el => ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)) ||
            elementos[0];
        if (preferido) {
            preferido.focus();
        } else {
            const card = modal.querySelector('.modal-card');
            if (card) {
                card.setAttribute('tabindex', '-1');
                card.focus();
            }
        }
    }

    function cerrar(modal) {
        if (modalActivo !== modal) return;
        modalActivo = null;
        if (focoAnterior && document.contains(focoAnterior) && focoAnterior.focus) focoAnterior.focus();
        focoAnterior = null;
    }

    function sincronizar() {
        document.querySelectorAll('.modal-overlay').forEach(modal => {
            if (getComputedStyle(modal).display !== 'none') abrir(modal);
            else cerrar(modal);
        });
    }

    document.addEventListener('keydown', function (e) {
        if (e.key !== 'Tab' || !modalActivo) return;
        const elementos = focusables(modalActivo);
        if (!elementos.length) { e.preventDefault(); return; }
        const primero = elementos[0];
        const ultimo = elementos[elementos.length - 1];
        if (e.shiftKey && document.activeElement === primero) {
            e.preventDefault();
            ultimo.focus();
        } else if (!e.shiftKey && document.activeElement === ultimo) {
            e.preventDefault();
            primero.focus();
        } else if (!modalActivo.contains(document.activeElement)) {
            e.preventDefault();
            primero.focus();
        }
    });

    document.addEventListener('DOMContentLoaded', function () {
        if (observando) return;
        observando = true;
        const observer = new MutationObserver(sincronizar);
        observer.observe(document.body, { attributes: true, attributeFilter: ['style'], childList: true, subtree: true });
        sincronizar();
    });
})();

// ==========================================
// MENÚ LATERAL DESPLEGABLE (tablets y celulares)
// ==========================================
document.addEventListener("DOMContentLoaded", function() {
    if (window.location.pathname.includes('login.html')) return;
    let header = document.querySelector('header');
    let aside = document.querySelector('aside');
    if (!header || !aside) return;

    let btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'menu-toggle';
    btn.setAttribute('aria-label', 'Abrir menú');
    btn.setAttribute('aria-expanded', 'false');
    header.insertBefore(btn, header.firstChild);

    let overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    document.body.appendChild(overlay);

    let cerrar = () => document.body.classList.remove('sidebar-open');
    btn.addEventListener('click', () => {
        let abierto = document.body.classList.toggle('sidebar-open');
        btn.setAttribute('aria-expanded', abierto ? 'true' : 'false');
    });
    overlay.addEventListener('click', cerrar);
    aside.querySelectorAll('a').forEach(a => a.addEventListener('click', cerrar));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') cerrar(); });
    window.addEventListener('resize', () => { if (window.innerWidth > 900) cerrar(); });
});

// Este script se encarga de pedir la sesión y configurar la vista
document.addEventListener("DOMContentLoaded", async function() {
    
    // No ejecutar esto en la página de login
    if (window.location.pathname.includes('login.html')) return;

    try {
        let res = await fetch('../controllers/AuthController.php');
        let sesion = await res.json();

        // 1. Si no está logueado, lo pateamos al login
        if (!sesion.logueado) {
            window.location.href = 'login.html';
            return;
        }

        // 2. Mostrar el nombre en el Header
        let userSpan = document.getElementById('nombreUsuarioHeader');
        if (userSpan) {
        userSpan.innerHTML = '<span class="ui-ico ui-ico-user"></span> ' + sesion.nombre;
        document.body.setAttribute('data-permisos', sesion.permisos.join(','));
        }

        

        // 3. CONTROL DE MENÚS (Sidebar)
        // Si no tiene permiso para configuraciones, le ocultamos el botón del menú
        if (!sesion.permisos.includes('ver_configuraciones')) {
            let navConfig = document.querySelector('a[href="Configuraciones.html"]');
            if (navConfig) navConfig.parentElement.style.display = 'none';
        }

        // ==========================================
        // 4. CONTROL DE BOTONES CRÍTICOS Y VISTAS
        // ==========================================
        
        // 4.1 Backup SQL (Configuraciones.html)
        let btnBackup = document.querySelector('button[onclick*="api_backup"]');
        if (btnBackup && !sesion.permisos.includes('backup_sql')) {
            btnBackup.style.display = 'none';
        }

        // 4.2 Carga Masiva DEV (Residentes y Contratos)
        let btnsDev = document.querySelectorAll('button[onclick*="abrirModalDevMasivo"]');
        btnsDev.forEach(btn => {
            if (!sesion.permisos.includes('carga_masiva_dev')) btn.style.display = 'none';
        });

        // 4.3 Botones de Move-In y Move-Out (Residentes y Contratos)
        let btnMoveIn = document.querySelector('.btn-movein');
        if (btnMoveIn && !sesion.permisos.includes('editar_residentes')) {
            btnMoveIn.style.display = 'none';
        }

        let btnMoveOut = document.querySelector('.btn-moveout');
        if (btnMoveOut && !sesion.permisos.includes('borrar_residentes')) {
            btnMoveOut.style.display = 'none';
        }

        // 4.4 Editar Cajones de Administración (Estacionamiento.html)
        let btnsEditAdmin = document.querySelectorAll('button[onclick*="abrirModalAdmin"]');
        btnsEditAdmin.forEach(btn => {
            if (!sesion.permisos.includes('editar_admin_parking')) btn.style.display = 'none';
        });

        // 4.5 Botón de Editar Claves Maestras (Configuraciones.html)
        if (!sesion.permisos.includes('editar_claves')) {
            // Le ponemos una clase al body para que configuraciones.js sepa que no debe pintar el botón
            document.body.classList.add('rol-sin-editar-claves');
        }

        // 4.6 Ocultar campana si no puede editar residentes
        if (!sesion.permisos.includes('editar_residentes')) {
            let campana = document.getElementById('btnNotificaciones');
            if (campana) campana.style.display = 'none';
        }

        // 5. Mostrar el menú de Administración solo si tiene el permiso
        if (sesion.permisos.includes('gestionar_usuarios')) {
        let menuAdmin = document.getElementById('menuAdminUsuarios');
        if (menuAdmin) {
        menuAdmin.style.display = 'block';
        }

        
    }


    } catch (e) {
        console.error("Error verificando sesión:", e);
    }
});

function cerrarSesion(e) {
    if (e) e.preventDefault();
    // Mostramos nuestro modal bonito en lugar del alert feo del navegador
    document.getElementById('modalCerrarSesion').style.display = 'flex';
}

async function ejecutarCerrarSesion() {
    let btn = document.querySelector('#modalCerrarSesion button:last-child');
    btn.innerText = "Cerrando...";
    btn.disabled = true;

    try {
        let res = await fetch('../controllers/AuthController.php?action=logout');
        let data = await res.json();
        
        if (data.status === 'success') {
            window.location.href = 'login.html';
        }
    } catch (error) {
        console.error("Error al cerrar sesión", error);
        window.location.href = 'login.html';
    }
}

// Inyectar el modal de cerrar sesión en el DOM
document.addEventListener("DOMContentLoaded", () => {
    if (!window.location.pathname.includes('login.html')) {
        let modalHTML = `
            <div id="modalCerrarSesion" class="modal-overlay" style="display: none; align-items: center; justify-content: center; z-index: 10000;">
                <div class="modal-card" style="max-width: 400px; width: 90%; padding: 24px; text-align: center;">
                    <div style="font-size: 2.5rem; margin-bottom: 10px;"><span class="ui-ico ui-ico-door"></span></div>
                    <h3 style="margin: 0 0 10px 0; color: var(--text-primary); font-size: 1.2rem;">¿Cerrar Sesión?</h3>
                    <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 24px;">
                        Estás a punto de salir del sistema. Tendrás que ingresar tus credenciales nuevamente para acceder.
                    </p>
                    <div style="display: flex; gap: 10px; justify-content: center;">
                        <button class="btn-ghost" onclick="document.getElementById('modalCerrarSesion').style.display='none'" style="flex: 1;">
                            Cancelar
                        </button>
                        <button class="btn-danger" onclick="ejecutarCerrarSesion()" style="flex: 1;">
                            Sí, salir
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }
});

// ==========================================
// FUNCIONES GLOBALES DE CONFIRMACIÓN CUSTOM
// ==========================================
function mostrarConfirmacionCustom(mensaje, onConfirm, opciones = {}) {
    // Si el modal no existe en la página, lo inyectamos
    if (!document.getElementById('modalConfirmacionCustom')) {
        let modalHTML = `
            <div id="modalConfirmacionCustom" class="modal-overlay" style="display: none; align-items: center; justify-content: center; z-index: 10001;">
                <div class="modal-card" style="max-width: 400px; width: 90%; padding: 24px; text-align: center;">
                    <div id="iconoConfirmacion" style="font-size: 2.5rem; margin-bottom: 10px;"><span class="ui-ico ui-ico-warning"></span></div>
                    <h3 id="tituloConfirmacion" style="margin: 0 0 10px 0; color: var(--text-primary); font-size: 1.2rem;">Confirmación</h3>
                    <p id="textoConfirmacion" style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 24px;"></p>
                    <div style="display: flex; gap: 10px; justify-content: center;">
                        <button class="btn-ghost" id="btnCancelarConfirmacion" onclick="cerrarConfirmacionCustom()" style="flex: 1;">
                            Cancelar
                        </button>
                        <button class="btn-danger" id="btnAceptarConfirmacion" style="flex: 1;">
                            Aceptar
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    document.getElementById('textoConfirmacion').innerText = mensaje;
    document.getElementById('tituloConfirmacion').innerText = opciones.titulo || 'Confirmación';
    var mapaIconosConfirmacion = { '🗑️': 'trash', '⚠️': 'warning', '🚗': 'car', '📤': 'upload', '📥': 'download', '🔒': 'lock' };
    var nombreIcono = mapaIconosConfirmacion[opciones.icono] || 'warning';
    document.getElementById('iconoConfirmacion').innerHTML = '<span class="ui-ico ui-ico-' + nombreIcono + '"></span>';
    document.getElementById('btnAceptarConfirmacion').innerText = opciones.btnAceptar || 'Aceptar';
    document.getElementById('btnAceptarConfirmacion').style.background = opciones.colorBoton || '#ef4444';

    // Clonar el botón para limpiar eventos anteriores
    let btnAceptar = document.getElementById('btnAceptarConfirmacion');
    let nuevoBtn = btnAceptar.cloneNode(true);
    btnAceptar.replaceWith(nuevoBtn);

    nuevoBtn.onclick = function() {
        cerrarConfirmacionCustom();
        onConfirm();
    };

    document.getElementById('modalConfirmacionCustom').style.display = 'flex';
}

function cerrarConfirmacionCustom() {
    let modal = document.getElementById('modalConfirmacionCustom');
    if (modal) modal.style.display = 'none';
}
