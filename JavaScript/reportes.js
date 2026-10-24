let reportesData = {
    cambios_cajon: [],
    cambio_unidad: [],
    move_in: [],
    move_out: [],
    renovacion_contrato: [],
    departamentos_deshabilitados: [],
    cajones_deshabilitados: []
};

let reporteActivo = 'cambios_cajon';
let datosFiltradosReporteActivo = [];

// Control de paginación
let paginaActual = 1;
let filasPorPagina = 25;
let mostrarTodo = false;
let timeoutBusqueda = null;

async function cargarReportesDesdeBD() {
    try {
        let response = await fetch('../API/api_reportes.php');
        let res = await response.json();

        if (res.status === 'success') {
            reportesData.cambios_cajon = res.cambios_cajon || [];
            reportesData.cambio_unidad = res.cambio_unidad || [];
            reportesData.move_in = res.move_in || [];
            reportesData.move_out = res.move_out || [];
            reportesData.renovacion_contrato = res.renovacion_contrato || [];
            reportesData.departamentos_deshabilitados = res.departamentos_deshabilitados || [];
            reportesData.cajones_deshabilitados = res.cajones_deshabilitados || [];

            actualizarBadgesContadores();
            aplicarFiltroReporte();
        } else {
            mostrarNotificacion('Error al obtener datos: ' + res.message, 'error');
        }
    } catch (e) {
        console.error("Error al cargar reportes:", e);
        mostrarNotificacion('Error de conexión al cargar los reportes.', 'error');
    }
}

function actualizarBadgesContadores() {
    document.getElementById('badgeCambiosCajon').innerText = reportesData.cambios_cajon.length;
    document.getElementById('badgeCambioUnidad').innerText = reportesData.cambio_unidad.length;
    document.getElementById('badgeMoveIn').innerText = reportesData.move_in.length;
    document.getElementById('badgeMoveOut').innerText = reportesData.move_out.length;
    document.getElementById('badgeRenovacion').innerText = reportesData.renovacion_contrato.length;
    document.getElementById('badgeDepsDesh').innerText = reportesData.departamentos_deshabilitados.length;
    document.getElementById('badgeCajonesDesh').innerText = reportesData.cajones_deshabilitados.length;
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

function cambiarReporte(tipoReporte, el) {
    document.querySelectorAll('.report-tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.report-tab-content').forEach(tab => tab.classList.remove('active'));

    el.classList.add('active');
    document.getElementById(`tab_${tipoReporte}`).classList.add('active');

    reporteActivo = tipoReporte;
    paginaActual = 1;
    document.getElementById('searchInput').value = '';
    aplicarFiltroReporte();
}

function aplicarFiltroReporte() {
    clearTimeout(timeoutBusqueda);
    timeoutBusqueda = setTimeout(() => {
        let query = document.getElementById('searchInput').value.toLowerCase().trim();
        let datosBase = reportesData[reporteActivo] || [];

        datosFiltradosReporteActivo = datosBase.filter(item => {
            if (!query) return true;
            return Object.values(item).some(val => 
                String(val).toLowerCase().includes(query)
            );
        });

        renderReporteActivo();
    }, 250);
}

function renderReporteActivo() {
    let tbody = document.getElementById(`tbody_${reporteActivo}`);
    if (!tbody) return;

    tbody.innerHTML = '';
    let totalRegistros = datosFiltradosReporteActivo.length;
    let totalPaginas = mostrarTodo ? 1 : Math.ceil(totalRegistros / filasPorPagina) || 1;

    if (paginaActual > totalPaginas) paginaActual = totalPaginas;
    if (paginaActual < 1) paginaActual = 1;

    let inicio = mostrarTodo ? 0 : (paginaActual - 1) * filasPorPagina;
    let fin = mostrarTodo ? totalRegistros : Math.min(inicio + filasPorPagina, totalRegistros);

    let datosPaginados = datosFiltradosReporteActivo.slice(inicio, fin);

    if (datosPaginados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; color: var(--text-secondary); padding: 20px;">No se encontraron registros.</td></tr>`;
    } else {
        datosPaginados.forEach(item => {
            if (reporteActivo === 'cambios_cajon') {
                tbody.innerHTML += `
                    <tr>
                        <td><strong>${item.nombre_completo || 'N/A'}</strong></td>
                        <td>${item.numero_tag || '---'}</td>
                        <td><span style="font-weight:700; color:#6366f1;">${item.nomenclatura || '---'}</span></td>
                        <td>${item.cajon_anterior || '---'}</td>
                        <td><strong>${item.cajon_nuevo || '---'}</strong></td>
                        <td>${item.modelo_auto || '---'}</td>
                        <td>${item.color_auto || '---'}</td>
                        <td><strong style="font-family:monospace;">${item.placas || '---'}</strong></td>
                        <td>${item.motivo || 'N/R'}</td>
                        <td>${item.fecha_cambio || 'N/A'}</td>
                    </tr>`;
            } else if (reporteActivo === 'cambio_unidad') {
                tbody.innerHTML += `
                    <tr>
                        <td><strong>${item.residente || 'N/A'}</strong></td>
                        <td><span style="color:#ef4444; font-weight:bold;">${item.nomenclatura_inicial || '---'}</span></td>
                        <td><span style="color:#10b981; font-weight:bold;">${item.nomenclatura_nueva || '---'}</span></td>
                        <td>${item.motivo_cambio || 'N/R'}</td>
                        <td>${item.fecha_cambio || 'N/A'}</td>
                    </tr>`;
            } else if (reporteActivo === 'move_in') {
                tbody.innerHTML += `
                    <tr>
                        <td>Dep. ${item.numero_departamento || 'N/A'}</td>
                        <td>${item.tipologia || '---'}</td>
                        <td>${item.recamara || '---'}</td>
                        <td><span style="font-weight:700; color:#6366f1;">${item.nomenclatura || '---'}</span></td>
                        <td><strong>${item.nombre_residente || 'N/A'}</strong></td>
                        <td><span class="badge-date bg-green">${item.move_in || 'N/A'}</span></td>
                    </tr>`;
            } else if (reporteActivo === 'move_out') {
                tbody.innerHTML += `
                    <tr>
                        <td><span style="font-weight:700; color:#6366f1;">${item.nomenclatura || '---'}</span></td>
                        <td><strong>${item.nombre_residente || 'N/A'}</strong></td>
                        <td>${item.move_in || 'N/A'}</td>
                        <td><span class="badge-date bg-red">${item.move_out || 'N/A'}</span></td>
                        <td>${item.motivo_salida || 'N/R'}</td>
                    </tr>`;
            } else if (reporteActivo === 'renovacion_contrato') {
                let rAnt = parseFloat(item.renta_anterior || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
                let rNue = parseFloat(item.renta_nueva || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
                tbody.innerHTML += `
                    <tr>
                        <td><strong>${item.residente || 'N/A'}</strong></td>
                        <td>${item.nomenclatura_anterior || '---'}</td>
                        <td><span style="font-weight:700; color:#6366f1;">${item.nomenclatura_nueva || '---'}</span></td>
                        <td>${item.fecha_out_anterior || 'N/A'}</td>
                        <td><span class="badge-date bg-green">${item.fecha_out_nueva || 'N/A'}</span></td>
                        <td>${rAnt}</td>
                        <td><strong style="color:#10b981;">${rNue}</strong></td>
                        <td>${item.plazo_extension || 'N/A'}</td>
                        <td>${item.fecha_registro || 'N/A'}</td>
                    </tr>`;
            } else if (reporteActivo === 'departamentos_deshabilitados') {
                tbody.innerHTML += `
                    <tr>
                        <td><strong style="color:#6366f1;">${item.nomenclatura || '---'}</strong></td>
                        <td>Dep. ${item.numero_dep || '---'}</td>
                        <td>${item.razon || 'Sin motivo'}</td>
                        <td>${item.fecha_deshabilitacion || 'N/A'}</td>
                    </tr>`;
            } else if (reporteActivo === 'cajones_deshabilitados') {
                tbody.innerHTML += `
                    <tr>
                        <td><strong>Cajón ${item.nombre_cajon || '---'}</strong></td>
                        <td>${item.razon || 'Sin motivo'}</td>
                        <td>${item.fecha_deshabilitacion || 'N/A'}</td>
                    </tr>`;
            }
        });
    }

    actualizarControlesPaginacion(totalRegistros, totalPaginas, inicio, fin);
}

function actualizarControlesPaginacion(totalRegistros, totalPaginas, inicio, fin) {
    let selectPagina = document.getElementById('selectPaginaReportes');
    if (selectPagina) {
        selectPagina.innerHTML = '';
        for (let i = 1; i <= totalPaginas; i++) {
            selectPagina.innerHTML += `<option value="${i}" ${i === paginaActual ? 'selected' : ''}>${i}</option>`;
        }
        selectPagina.disabled = mostrarTodo;
    }

    let textoRango = document.getElementById('textoRangoFilas');
    if (textoRango) {
        if (totalRegistros === 0) {
            textoRango.innerText = 'Mostrando 0 de 0';
        } else {
            textoRango.innerText = `Mostrando ${inicio + 1} - ${fin} de ${totalRegistros}`;
        }
    }
}

function cambiarPaginaDirecta(num) {
    paginaActual = parseInt(num) || 1;
    renderReporteActivo();
}

function cambiarPaginaRelativa(delta) {
    paginaActual += delta;
    renderReporteActivo();
}

function cambiarFilasPorPagina(val) {
    filasPorPagina = parseInt(val) || 25;
    paginaActual = 1;
    renderReporteActivo();
}

function toggleMostrarTodo(checked) {
    mostrarTodo = checked;
    document.getElementById('selectFilasPorPagina').disabled = checked;
    paginaActual = 1;
    renderReporteActivo();
}

function exportarExcelReporteActivo() {
    if (datosFiltradosReporteActivo.length === 0) {
        mostrarNotificacion('No hay datos para exportar en este reporte.', 'error');
        return;
    }

    let worksheet = XLSX.utils.json_to_sheet(datosFiltradosReporteActivo);
    let workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, reporteActivo.toUpperCase());
    XLSX.writeFile(workbook, `Reporte_${reporteActivo}_UTower_${new Date().toISOString().slice(0,10)}.xlsx`);
    mostrarNotificacion(`Reporte ${reporteActivo} exportado con éxito.`, 'success');
}

function exportarTodasLasTablasExcel() {
    let tieneDatos = Object.values(reportesData).some(arr => arr && arr.length > 0);
    
    if (!tieneDatos) {
        mostrarNotificacion('No hay datos disponibles para exportar.', 'error');
        return;
    }

    let workbook = XLSX.utils.book_new();

    if (reportesData.cambios_cajon.length > 0) {
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(reportesData.cambios_cajon), "Cambios de Cajón");
    }
    if (reportesData.cambio_unidad.length > 0) {
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(reportesData.cambio_unidad), "Cambio de Unidad");
    }
    if (reportesData.move_in.length > 0) {
        let moveInLimpio = reportesData.move_in.map(item => ({
            "No. Departamento": item.numero_departamento,
            "Tipología": item.tipologia,
            "Recámara": item.recamara,
            "Nomenclatura": item.nomenclatura,
            "Nombre Residente": item.nombre_residente,
            "Fecha Move-In": item.move_in
        }));
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(moveInLimpio), "Move-In");
    }
    if (reportesData.move_out.length > 0) {
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(reportesData.move_out), "Move-Out");
    }
    if (reportesData.renovacion_contrato.length > 0) {
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(reportesData.renovacion_contrato), "Renovación de Contrato");
    }
    if (reportesData.departamentos_deshabilitados.length > 0) {
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(reportesData.departamentos_deshabilitados), "Deps Deshabilitados");
    }
    if (reportesData.cajones_deshabilitados.length > 0) {
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(reportesData.cajones_deshabilitados), "Cajones Deshabilitados");
    }

    XLSX.writeFile(workbook, `Reporte_General_Completo_UTower_${new Date().toISOString().slice(0,10)}.xlsx`);
    mostrarNotificacion('Libro completo de reportes (7 hojas) exportado con éxito.', 'success');
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
    cargarReportesDesdeBD();
};