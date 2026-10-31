let estacionamientoData = [];
let estacionamientoFiltrados = [];
let timeoutBusqueda = null;
let pestañaActiva = 'residentes';

async function cargarEstacionamientoDesdeBD() {
    try {
        let response = await fetch('../API/api_estacionamiento.php');
        estacionamientoData = await response.json();
        estacionamientoFiltrados = [...estacionamientoData];
        renderTablasEstacionamiento(estacionamientoFiltrados);
    } catch (error) {
        console.error("Error al conectar con la base de datos:", error);
        mostrarNotificacion('Error al cargar la información de estacionamiento.', 'error');
    }
}

function esCajonAdministrativo(cajonStr) {
    let str = String(cajonStr).trim();
    // Si empieza con "Cajón", es de residente. Si no, es administrativo.
    return !str.toLowerCase().startsWith('cajón');
}

function mostrarNotificacion(mensaje, tipo = 'success') {
    let container = document.getElementById('toastContainer');
    if (!container) return;
    let toast = document.createElement('div');
    toast.className = `app-toast ${tipo === 'success' ? 'toast-success' : 'toast-error'}`;
    let icono = tipo === 'success' ? '✅' : '❌';
    toast.innerHTML = `<span style="font-size: 1.2rem;">${icono}</span> <span style="flex: 1;">${mensaje}</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.remove(); }, 8000);
}

function cambiarPestanaEstacionamiento(tipo, el) {
    document.querySelectorAll('.parking-tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.parking-tab-content').forEach(cont => cont.classList.remove('active'));
    
    el.classList.add('active');
    document.getElementById(tipo === 'residentes' ? 'tabResidentes' : 'tabAdmin').classList.add('active');
    pestañaActiva = tipo;
}

function renderTablasEstacionamiento(datos) {
    let tbodyResidentes = document.getElementById('tablaEstacionamientoBody');
    let tbodyAdmin = document.getElementById('tablaAdminBody');
    if (!tbodyResidentes || !tbodyAdmin) return;

    let permisosBody = document.body.getAttribute('data-permisos') || '';
    let puedeEditarAdmin = permisosBody.includes('editar_admin_parking');


    tbodyResidentes.innerHTML = '';
    tbodyAdmin.innerHTML = '';

    let ocupadosCount = 0;
    let disponiblesCount = 0;
    let totalResidentesCount = 0;

    datos.forEach((item) => {
        let esAdmin = esCajonAdministrativo(item.cajon);
        let tieneTag = item.numero_tag && item.numero_tag.trim() !== '' && item.numero_tag !== '---';
        
        let botonQR = tieneTag 
            ? `<button class="btn-table" onclick="abrirModalQR('${item.numero_tag}', '${item.nombre_completo || item.cajon}')" title="Ver QR de TAG para Plumas" style="background: rgba(99, 102, 241, 0.15); color: #6366f1; border-color: #6366f1;">📷 QR</button>`
            : `<span style="color:var(--text-secondary); font-size:0.75rem;">Sin TAG</span>`;

        if (esAdmin) {
            let botonEditarAdminHTML = puedeEditarAdmin 
            ? `<button class="btn-table" onclick='abrirModalAdmin(${JSON.stringify(item)})' title="Editar Cajón Exclusivo" style="background: rgba(147, 51, 234, 0.15); color: #c084fc; border-color: #a855f7;">✏️ Editar</button>`
            : `<span style="color:var(--text-secondary); font-size:0.8rem;">Protegido</span>`;
            tbodyAdmin.innerHTML += `
                <tr class="fila-admin">
                    <td><strong>${item.cajon}</strong> <span class="badge-admin">ADMINISTRACIÓN</span></td>
                    <td>${item.numero_tag || '<span style="color:var(--text-secondary)">---</span>'}</td>
                    <td><strong>${item.nombre_completo || '<span style="color:var(--text-secondary)">Sin asignar</span>'}</strong></td>
                    <td>${item.modelo_auto || '<span style="color:var(--text-secondary)">---</span>'}</td>
                    <td>${item.color_auto || '<span style="color:var(--text-secondary)">---</span>'}</td>
                    <td><strong style="font-family: monospace;">${item.placas || '---'}</strong></td>
                    <td style="text-align: center;">${botonQR}</td>
                    <td style="text-align: center;">
                        ${botonEditarAdminHTML}
                    </td>
                </tr>
            `;
        } else {
            totalResidentesCount++;
            let esOcupado = item.estado === 'Ocupado';
            if (esOcupado) ocupadosCount++;
            else disponiblesCount++;

            let badgeEstado = esOcupado 
                ? `<span class="badge-status" style="background: rgba(99, 102, 241, 0.15); color: #6366f1; border: 1px solid #6366f1;">Ocupado</span>` 
                : `<span class="badge-status" style="background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid #10b981;">Disponible</span>`;

            tbodyResidentes.innerHTML += `
                <tr>
                    <td><strong>Cajón ${item.cajon}</strong></td>
                    <td>${item.numero_tag || '<span style="color:var(--text-secondary)">---</span>'}</td>
                    <td><strong>${item.nombre_completo || '<span style="color:var(--text-secondary)">Libre</span>'}</strong></td>
                    <td><span style="font-weight: 600; color: #6366f1;">${item.nomenclatura || '---'}</span></td>
                    <td>${item.modelo_auto || '<span style="color:var(--text-secondary)">---</span>'}</td>
                    <td>${item.color_auto || '<span style="color:var(--text-secondary)">---</span>'}</td>
                    <td><strong style="font-family: monospace;">${item.placas || '---'}</strong></td>
                    <td style="text-align: center;">${badgeEstado}</td>
                    <td style="text-align: center;">${botonQR}</td>
                </tr>
            `;
        }
    });

    document.getElementById('statTotalCajones').innerText = totalResidentesCount;
    document.getElementById('statCajonesOcupados').innerText = ocupadosCount;
    document.getElementById('statCajonesDisponibles').innerText = disponiblesCount;
}

function abrirModalQR(tag, nombre) {
    document.getElementById('qrInfoSub').innerText = `Propietario: ${nombre}`;
    document.getElementById('qrTagTexto').innerText = `TAG: ${tag}`;
    
    let container = document.getElementById('qrcodeContainer');
    container.innerHTML = ''; // Limpiar QR anterior
    
    // Generar nuevo código QR con el número de TAG puro
    new QRCode(container, {
        text: String(tag),
        width: 160,
        height: 160,
        colorDark: "#0f172a",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
    });

    document.getElementById('modalQROverlay').style.display = 'flex';
}

function cerrarModalQR() {
    document.getElementById('modalQROverlay').style.display = 'none';
}

function abrirModalAdmin(item) {
    document.getElementById('modalAdminTitulo').innerText = `Editar: ${item.cajon}`;
    document.getElementById('adminCajonNombre').value = item.cajon;
    document.getElementById('adminNombre').value = item.nombre_completo || '';
    document.getElementById('adminTag').value = item.numero_tag || '';
    document.getElementById('adminPlacas').value = item.placas || '';
    document.getElementById('adminModelo').value = item.modelo_auto || '';
    document.getElementById('adminColor').value = item.color_auto || '';

    document.getElementById('modalAdminOverlay').style.display = 'flex';
}

function cerrarModalAdmin() {
    document.getElementById('modalAdminOverlay').style.display = 'none';
}

async function guardarCajonAdmin() {
    // Obtenemos el nombre del cajón (que será "Cajón 2", "Administracion", etc)
    let cajon = document.getElementById('adminCajonNombre').value;
    
    let payload = {
        action: 'actualizar_admin',
        cajon: cajon,
        nombre_completo: document.getElementById('adminNombre').value.trim(),
        numero_tag: document.getElementById('adminTag').value.trim(),
        placas: document.getElementById('adminPlacas').value.trim(),
        modelo_auto: document.getElementById('adminModelo').value.trim(),
        color_auto: document.getElementById('adminColor').value.trim()
    };

    try {
        let response = await fetch('../API/api_estacionamiento.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        let res = await response.json();

        if (res.status === 'success') {
            mostrarNotificacion(res.message, 'success');
            cerrarModalAdmin();
            await cargarEstacionamientoDesdeBD();
        } else {
            mostrarNotificacion('Error: ' + res.message, 'error');
        }
    } catch (e) {
        mostrarNotificacion('Error de conexión al actualizar el cajón.', 'error');
    }
}

function aplicarFiltrosEstacionamiento() {
    clearTimeout(timeoutBusqueda);
    timeoutBusqueda = setTimeout(() => {
        let query = document.getElementById('searchInput').value.toLowerCase();
        let valEstado = document.getElementById('filterEstadoCajon').value;

        estacionamientoFiltrados = estacionamientoData.filter(item => {
            let matchQuery = !query || 
                String(item.cajon).toLowerCase().includes(query) || 
                (item.nombre_completo && item.nombre_completo.toLowerCase().includes(query)) || 
                (item.nomenclatura && item.nomenclatura.toLowerCase().includes(query)) ||
                (item.placas && item.placas.toLowerCase().includes(query));
            
            let matchEstado = !valEstado || item.estado === valEstado;

            return matchQuery && matchEstado;
        });

        renderTablasEstacionamiento(estacionamientoFiltrados);
    }, 300);
}

function exportarExcelEstacionamiento() {
    if (estacionamientoFiltrados.length === 0) {
        mostrarNotificacion('No hay datos para exportar.', 'error');
        return;
    }

    let dataExcel = estacionamientoFiltrados.map(item => ({
        "Cajón": item.cajon,
        "Número de Tag": item.numero_tag || 'N/A',
        "Asignado A / Residente": item.nombre_completo || 'Libre',
        "Nomenclatura": item.nomenclatura || 'N/A',
        "Modelo Auto": item.modelo_auto || 'N/A',
        "Color Auto": item.color_auto || 'N/A',
        "Placas": item.placas || 'N/A',
        "Estado": item.estado
    }));

    let worksheet = XLSX.utils.json_to_sheet(dataExcel);
    let workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Estacionamiento U-Tower");
    XLSX.writeFile(workbook, `Estacionamiento_UTower_${new Date().toISOString().slice(0,10)}.xlsx`);
    mostrarNotificacion('Reporte de estacionamiento exportado con éxito.', 'success');
}

function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    let esOscuro = document.body.classList.contains('dark-mode');
    localStorage.setItem('theme', esOscuro ? 'dark' : 'light');
    document.getElementById('themeIcon').innerText = esOscuro ? '☀️' : '🌙';
    document.getElementById('themeText').innerText = esOscuro ? 'Modo Claro' : 'Modo Oscuro';
}

window.onload = function() {
    // Quitar la clase de preload del HTML
    document.documentElement.classList.remove('dark-mode-preload');

    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-mode');
        if(document.getElementById('themeIcon')) document.getElementById('themeIcon').innerText = '☀️';
        if(document.getElementById('themeText')) document.getElementById('themeText').innerText = 'Modo Claro';
    }
    cargarEstacionamientoDesdeBD();
};

