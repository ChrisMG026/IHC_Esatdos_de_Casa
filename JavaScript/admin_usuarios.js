let rolesData = [];
let permisosData = [];

document.addEventListener('DOMContentLoaded', () => {
    cargarDatosAdmin();
});

async function cargarDatosAdmin() {
    try {
        let res = await fetch('../API/api_admin_usuarios.php');
        let data = await res.json();

        if (data.status === 'success') {
            rolesData = data.roles;
            permisosData = data.permisos;
            renderTablaUsuarios(data.usuarios);
            renderTablaRoles(data.roles);
            llenarSelectRoles(rolesData);
        } else {
            mostrarNotificacion("Error al cargar datos: " + data.message, 'error');
        }
    } catch (e) {
        console.error(e);
        mostrarNotificacion("Error de conexión con la base de datos.", 'error');
    }
}

function cambiarTabAdmin(tab, btn) {
    document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab_${tab}`).classList.add('active');

    // Si entra a la pestaña de logs, cargamos los datos frescos
    if (tab === 'logs') {
        cargarLogs();
    }
}

// ================= USUARIOS =================
function renderTablaUsuarios(usuarios) {
    let tbody = document.getElementById('tbodyUsuarios');
    tbody.innerHTML = '';
    
    usuarios.forEach(u => {
        let estadoBadge = u.activo == 1 
            ? `<span class="badge-status status-green">Activo</span>` 
            : `<span class="badge-status status-red">Inactivo</span>`;

        let botones = u.id_usuario == 1 
            ? `<span style="color:var(--text-secondary); font-size:0.8rem; font-weight:600;">Protegido</span>`
            : `<button class="btn-table" onclick="abrirModalEditarUsuario(${u.id_usuario}, ${u.id_rol}, ${u.activo})" title="Editar">✏️ Editar</button>`;

        tbody.innerHTML += `
            <tr>
                <td>${u.id_usuario}</td>
                <td><strong>${u.nombre_completo}</strong></td>
                <td><code>${u.username}</code></td>
                <td><span style="color: #6366f1; font-weight: 700;">${u.nombre_rol}</span></td>
                <td>${estadoBadge}</td>
                <td style="text-align: center;">${botones}</td>
            </tr>
        `;
    });
}

function llenarSelectRoles(roles) {
    let select = document.getElementById('newUserRol');
    select.innerHTML = '';
    roles.forEach(r => {
        select.innerHTML += `<option value="${r.id_rol}">${r.nombre_rol}</option>`;
    });
}

function abrirModalEditarUsuario(id, id_rol, activo) {
    document.getElementById('editUserId').value = id;
    document.getElementById('editUserPassword').value = ''; // Limpiamos el campo de contraseña
    
    let selectRol = document.getElementById('editUserRol');
    selectRol.innerHTML = '';
    rolesData.forEach(r => {
        selectRol.innerHTML += `<option value="${r.id_rol}" ${r.id_rol == id_rol ? 'selected' : ''}>${r.nombre_rol}</option>`;
    });
    document.getElementById('editUserActivo').value = activo;

    // Ocultar el botón de eliminar si es el Administrador Principal (ID 1)
    let btnEliminar = document.getElementById('btnEliminarUsuario');
    if (id == 1) {
        btnEliminar.style.display = 'none'; // Protegemos al admin principal
    } else {
        btnEliminar.style.display = 'block';
    }

    document.getElementById('modalEditUsuarioOverlay').style.display = 'flex';
}


function cerrarModalUsuario() {
    document.getElementById('modalUsuarioOverlay').style.display = 'none';
}

async function guardarEdicionUsuario() {
    let payload = {
        accion: 'editar_usuario',
        id_usuario: document.getElementById('editUserId').value,
        id_rol: document.getElementById('editUserRol').value,
        activo: document.getElementById('editUserActivo').value,
        nueva_password: document.getElementById('editUserPassword').value.trim() // <-- NUEVO
    };

    try {
        let res = await fetch('../API/api_admin_usuarios.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        let data = await res.json();
        
        if (data.status === 'success') {
            mostrarNotificacion(data.message, 'success');
            document.getElementById('modalEditUsuarioOverlay').style.display = 'none';
            cargarDatosAdmin();
        } else {
            mostrarNotificacion(data.message, 'error');
        }
    } catch (e) {
        mostrarNotificacion("Error de conexión.", 'error');
    }
}

async function guardarUsuario() {
    let btn = document.querySelector('#modalUsuarioOverlay .btn-save');
    btn.innerText = "Guardando...";
    btn.disabled = true;

    // Recopilamos los datos
    let payload = {
        accion: 'crear_usuario',
        nombre_completo: document.getElementById('newUserNombre').value.trim(),
        username: document.getElementById('newUserUsername').value.trim(),
        password: document.getElementById('newUserPassword').value,
        id_rol: document.getElementById('newUserRol').value,
        pregunta: document.getElementById('newUserPregunta').value.trim(),
        respuesta: document.getElementById('newUserRespuesta').value.trim()
    };

    // Validaciones en el Frontend
    if (!payload.nombre_completo || !payload.username || !payload.password || !payload.pregunta || !payload.respuesta) {
        mostrarNotificacion("Todos los campos son obligatorios. Por favor, llena la respuesta secreta.", 'error');
        btn.innerText = "Guardar Usuario";
        btn.disabled = false;
        return;
    }

    if (payload.password.length < 6) {
        mostrarNotificacion("La contraseña debe tener al menos 6 caracteres.", 'error');
        btn.innerText = "Guardar Usuario";
        btn.disabled = false;
        return;
    }

    try {
        let res = await fetch('../API/api_admin_usuarios.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        let data = await res.json();
        
        if (data.status === 'success') {
            mostrarNotificacion(data.message, 'success');
            cerrarModalUsuario();
            cargarDatosAdmin(); // Recargamos la tabla de usuarios
        } else {
            mostrarNotificacion(data.message, 'error');
        }
    } catch (e) {
        mostrarNotificacion("Error de conexión al guardar el usuario.", 'error');
    } finally {
        btn.innerText = "Guardar Usuario";
        btn.disabled = false;
    }
}


async function eliminarUsuario() {
    let id = document.getElementById('editUserId').value;
    if (id == 1) {
        mostrarNotificacion("El Administrador Principal no se puede eliminar.", 'error');
        return;
    }

    mostrarConfirmacionCustom(
        "¿Estás seguro de eliminar este usuario permanentemente? Esta acción no se puede deshacer.",
        async function() {
            try {
                let res = await fetch('../API/api_admin_usuarios.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ accion: 'eliminar_usuario', id_usuario: id })
                });
                let data = await res.json();
                
                if (data.status === 'success') {
                    mostrarNotificacion(data.message, 'success');
                    document.getElementById('modalEditUsuarioOverlay').style.display = 'none';
                    cargarDatosAdmin();
                } else {
                    mostrarNotificacion(data.message, 'error');
                }
            } catch (e) {
                mostrarNotificacion("Error de conexión.", 'error');
            }
        },
        { titulo: 'Eliminar Usuario', icono: '🗑️', btnAceptar: 'Sí, eliminar' }
    );
}

function abrirModalEditarUsuario(id, id_rol, activo) {
    document.getElementById('editUserId').value = id;
    let selectRol = document.getElementById('editUserRol');
    selectRol.innerHTML = '';
    rolesData.forEach(r => {
        selectRol.innerHTML += `<option value="${r.id_rol}" ${r.id_rol == id_rol ? 'selected' : ''}>${r.nombre_rol}</option>`;
    });
    document.getElementById('editUserActivo').value = activo;
    document.getElementById('modalEditUsuarioOverlay').style.display = 'flex';
}

async function guardarEdicionUsuario() {
    let payload = {
        accion: 'editar_usuario',
        id_usuario: document.getElementById('editUserId').value,
        id_rol: document.getElementById('editUserRol').value,
        activo: document.getElementById('editUserActivo').value
    };

    try {
        let res = await fetch('../API/api_admin_usuarios.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        let data = await res.json();
        
        if (data.status === 'success') {
            mostrarNotificacion(data.message, 'success');
            document.getElementById('modalEditUsuarioOverlay').style.display = 'none';
            cargarDatosAdmin();
        } else {
            mostrarNotificacion(data.message, 'error');
        }
    } catch (e) {
        mostrarNotificacion("Error de conexión.", 'error');
    }
}

// ================= ROLES =================
function renderTablaRoles(roles) {
    let tbody = document.getElementById('tbodyRoles');
    tbody.innerHTML = '';
    
    roles.forEach(r => {
        let permisosTags = r.permisos 
            ? r.permisos.split(',').map(p => `<span style="background: var(--bg-main); border: 1px solid var(--border-color); padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; margin: 2px; display:inline-block;">${p}</span>`).join('') 
            : '<span style="color: var(--text-secondary);">Ninguno</span>';

        let proteccion = r.es_admin_principal == 1 
            ? `<span class="badge-status" style="background:#fef9c3; color:#a16207; border: 1px solid #eab308;">🔒 Protegido</span>` 
            : `-`;

        let btnEditar = r.es_admin_principal == 1 
            ? `<button class="btn-table" disabled title="El rol de Admin principal no se puede editar" style="opacity:0.5; cursor:not-allowed;">✏️ Editar</button>`
            : `<button class="btn-table" onclick="abrirModalEditarRol(${r.id_rol})">✏️ Editar</button>`;

        tbody.innerHTML += `
            <tr>
                <td>${r.id_rol}</td>
                <td><strong>${r.nombre_rol}</strong></td>
                <td style="max-width: 400px;">${permisosTags}</td>
                <td>${proteccion}</td>
                <td style="text-align: center;">${btnEditar}</td>
            </tr>
        `;
    });
}

function pintarCheckboxesPermisos(permisosAsignados = []) {
    let container = document.getElementById('contenedorPermisos');
    container.innerHTML = '';
    permisosData.forEach(p => {
        let checked = permisosAsignados.includes(p.clave_permiso) ? 'checked' : '';
        let nombreBonito = p.clave_permiso.replace(/_/g, ' ').toUpperCase();
        container.innerHTML += `
            <label class="checkbox-item">
                <input type="checkbox" value="${p.clave_permiso}" ${checked}>
                <span>${nombreBonito}</span>
            </label>
        `;
    });
}

function abrirModalRol() {
    document.getElementById('tituloModalRol').innerText = "Crear Nuevo Rol";
    document.getElementById('nombreRol').value = '';
    document.getElementById('descripcionRol').value = '';
    document.getElementById('editIdRol').value = '0';
    pintarCheckboxesPermisos([]);
    document.getElementById('modalRolOverlay').style.display = 'flex';
}

function abrirModalEditarRol(id_rol) {
    let rol = rolesData.find(r => r.id_rol == id_rol);
    if (!rol) return;
    document.getElementById('tituloModalRol').innerText = `Editar Rol: ${rol.nombre_rol}`;
    document.getElementById('nombreRol').value = rol.nombre_rol;
    document.getElementById('descripcionRol').value = rol.descripcion || '';
    document.getElementById('editIdRol').value = id_rol;
    let permisosAsignados = rol.permisos ? rol.permisos.split(',') : [];
    pintarCheckboxesPermisos(permisosAsignados);
    document.getElementById('modalRolOverlay').style.display = 'flex';
}

function cerrarModalRol() {
    document.getElementById('modalRolOverlay').style.display = 'none';
}

async function guardarRol() {
    let id_rol = document.getElementById('editIdRol').value;
    let nombre = document.getElementById('nombreRol').value.trim();
    let desc = document.getElementById('descripcionRol').value.trim();
    let checkboxes = document.querySelectorAll('#contenedorPermisos input[type="checkbox"]:checked');
    let permisosMarcados = Array.from(checkboxes).map(cb => cb.value);

    if (!nombre) {
        mostrarNotificacion("El nombre del rol es obligatorio.", 'error');
        return;
    }

    let payload = {
        accion: id_rol == '0' ? 'crear_rol' : 'editar_rol',
        id_rol: id_rol,
        nombre: nombre,
        descripcion: desc,
        permisos: permisosMarcados
    };

    try {
        let res = await fetch('../API/api_admin_usuarios.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        let data = await res.json();
        if (data.status === 'success') {
            mostrarNotificacion(data.message, 'success');
            cerrarModalRol();
            cargarDatosAdmin();
        } else {
            mostrarNotificacion(data.message, 'error');
        }
    } catch (e) {
        mostrarNotificacion("Error de conexión.", 'error');
    }
}

// ================= UTILIDADES =================
function mostrarNotificacion(mensaje, tipo = 'success') {
    let container = document.getElementById('toastContainer');
    if (!container) return;
    let toast = document.createElement('div');
    toast.className = `app-toast ${tipo === 'success' ? 'toast-success' : 'toast-error'}`;
    let icono = tipo === 'success' ? '✅' : '❌';
    toast.innerHTML = `<span style="font-size: 1.2rem;">${icono}</span> <span style="flex: 1;">${mensaje}</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.remove(); }, 5000);
}

function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    let esOscuro = document.body.classList.contains('dark-mode');
    localStorage.setItem('theme', esOscuro ? 'dark' : 'light');
    let icon = document.getElementById('themeIcon');
    let text = document.getElementById('themeText');
    if (icon) icon.innerText = esOscuro ? '☀️' : '🌙';
    if (text) text.innerText = esOscuro ? 'Modo Claro' : 'Modo Oscuro';
}

async function cargarLogs() {
    try {
        let res = await fetch('../API/api_logs.php');
        let data = await res.json();
        let tbody = document.getElementById('tbodyLogs');

        if (data.status === 'success') {
            tbody.innerHTML = '';
            if (data.logs.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color: var(--text-secondary);">No hay actividad registrada.</td></tr>`;
                return;
            }

            data.logs.forEach(log => {
                let fecha = new Date(log.fecha_log).toLocaleString('es-MX');
                tbody.innerHTML += `
                    <tr>
                        <td>${fecha}</td>
                        <td><strong>${log.nombre_completo || 'Sistema'}</strong></td>
                        <td><span style="background: var(--bg-main); padding: 4px 8px; border-radius: 4px; border: 1px solid var(--border-color); font-size:0.8rem; font-weight:bold;">${log.accion}</span></td>
                        <td>${log.detalles || '-'}</td>
                        <td><code style="font-size:0.8rem;">${log.ip_usuario || 'Desconocida'}</code></td>
                    </tr>
                `;
            });
        }
    } catch (e) {
        console.error("Error al cargar logs:", e);
    }
}

function abrirModalUsuario() {
    document.getElementById('newUserNombre').value = '';
    document.getElementById('newUserUsername').value = '';
    document.getElementById('newUserPassword').value = '';
    document.getElementById('newUserPregunta').value = '';
    document.getElementById('newUserRespuesta').value = '';
    document.getElementById('modalUsuarioOverlay').style.display = 'flex';
}

function cerrarModalUsuario() {
    document.getElementById('modalUsuarioOverlay').style.display = 'none';
}

function mostrarConfirmacionCustom(mensaje, onConfirm, opciones = {}) {
    document.getElementById('textoConfirmacion').innerText = mensaje;
    document.getElementById('tituloConfirmacion').innerText = opciones.titulo || 'Confirmación';
    document.getElementById('iconoConfirmacion').innerText = opciones.icono || '⚠️';
    document.getElementById('btnAceptarConfirmacion').innerText = opciones.btnAceptar || 'Aceptar';
    document.getElementById('btnAceptarConfirmacion').style.background = opciones.colorBoton || '#ef4444';
    document.getElementById('btnCancelarConfirmacion').style.display = opciones.ocultarCancelar ? 'none' : 'block';

    let contInput = document.getElementById('contenedorInputConfirmacion');
    let input = document.getElementById('inputTextoConfirmacion');
    
    if (opciones.pideInput) {
        contInput.style.display = 'block';
        input.value = '';
        input.placeholder = opciones.placeholderInput || '';
    } else {
        contInput.style.display = 'none';
    }

    // Removemos eventos anteriores
    let nuevoBtn = document.getElementById('btnAceptarConfirmacion').cloneNode(true);
    document.getElementById('btnAceptarConfirmacion').replaceWith(nuevoBtn);

    nuevoBtn.onclick = function() {
        let valorInput = opciones.pideInput ? input.value.trim() : '';
        if (opciones.pideInput && valorInput === '') {
            mostrarNotificacion('Este campo es obligatorio.', 'error');
            return;
        }
        cerrarConfirmacionCustom();
        onConfirm(valorInput);
    };

    document.getElementById('modalConfirmacionCustom').style.display = 'flex';
}

function cerrarConfirmacionCustom() {
    document.getElementById('modalConfirmacionCustom').style.display = 'none';
}