// Este script se encarga de pedir la sesión y configurar la vista
document.addEventListener("DOMContentLoaded", async function() {
    
    // No ejecutar esto en la página de login
    if (window.location.pathname.includes('login.html')) return;

    try {
        let res = await fetch('../API/api_sesion.php');
        let sesion = await res.json();

        // 1. Si no está logueado, lo pateamos al login
        if (!sesion.logueado) {
            window.location.href = 'login.html';
            return;
        }

        // 2. Mostrar el nombre en el Header
        let userSpan = document.getElementById('nombreUsuarioHeader');
        if (userSpan) {
        userSpan.innerHTML = `👤 ${sesion.nombre}`; 
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
        let res = await fetch('../API/api_logout.php');
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
                <div class="modal-card" style="max-width: 400px; width: 90%; padding: 24px; text-align: center; border-radius: 12px; background: var(--bg-card); border: 1px solid var(--border-color);">
                    <div style="font-size: 2.5rem; margin-bottom: 10px;">🚪</div>
                    <h3 style="margin: 0 0 10px 0; color: var(--text-primary); font-size: 1.2rem;">¿Cerrar Sesión?</h3>
                    <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 24px;">
                        Estás a punto de salir del sistema. Tendrás que ingresar tus credenciales nuevamente para acceder.
                    </p>
                    <div style="display: flex; gap: 10px; justify-content: center;">
                        <button onclick="document.getElementById('modalCerrarSesion').style.display='none'" style="flex: 1; padding: 10px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-main); color: var(--text-primary); font-weight: bold; cursor: pointer;">
                            Cancelar
                        </button>
                        <button onclick="ejecutarCerrarSesion()" style="flex: 1; padding: 10px; border-radius: 6px; border: none; background: #ef4444; color: white; font-weight: bold; cursor: pointer;">
                            Sí, salir
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }
});
