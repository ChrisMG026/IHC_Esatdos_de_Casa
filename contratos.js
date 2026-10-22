let contratosData = [];
let contratosFiltrados = [];
let listaResidentesOriginal = [];
let timeoutBusqueda = null;
let contratoSeleccionado = null;
let chipActivo = 'todos';

async function cargarContratosDesdeBD() {
    try {
        let response = await fetch('api_contratos.php');
        contratosData = await response.json();
        contratosFiltrados = [...contratosData];
        
        // Cargar catálogo de residentes para cambios de unidad
        let resResp = await fetch('api_residentes.php');
        listaResidentesOriginal = await resResp.json();

        renderTablaContratos(contratosFiltrados);
    } catch (error) {
        console.error("Error al conectar con la base de datos:", error);
        mostrarNotificacion('Error al cargar contratos.', 'error');
    }
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

function renderTablaContratos(datos) {
    let tbody = document.getElementById('tablaContratosBody');
    tbody.innerHTML = '';

    let ingresoTotal = 0;
    let porVencerCount = 0;

    datos.forEach((item) => {
        let rentaVal = parseFloat(item.renta || 0);
        ingresoTotal += rentaVal;

        if (item.estado_vencimiento !== 'Vigente') {
            porVencerCount++;
        }

        let badgeClass = 'vencimiento-vigente';
        let estadoTexto = `Vigente (${item.dias_restantes} d.)`;

        if (item.estado_vencimiento === 'Por vencer') {
            badgeClass = 'vencimiento-por-vencer';
            estadoTexto = `⚠️ Por vencer (${item.dias_restantes} d.)`;
        } else if (item.estado_vencimiento === 'Vencido') {
            badgeClass = 'vencimiento-vencido';
            estadoTexto = `🚨 Vencido (${Math.abs(item.dias_restantes)} d.)`;
        }

        let rentaFormatted = rentaVal.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

        let tieneAuto = (item.tiene_carro && item.tiene_carro.toLowerCase() === 'si');
        let badgeVehiculo = tieneAuto 
            ? `<span class="badge-status status-green" style="font-size:0.75rem; padding: 2px 6px;">🚗 Si</span>` 
            : `<span style="color: var(--text-secondary); font-size:0.82rem;">🚫 No</span>`;

        tbody.innerHTML += `
            <tr>
                <td>
                    <span style="font-weight: 700; color: var(--text-primary);">Dep. ${item.numero_departamento || 'N/A'}</span>
                    <span style="font-size: 0.78rem; color: var(--text-secondary);">(${item.recamara || 'N/A'})</span>
                </td>
                <td><span style="font-weight: 700; color: #6366f1; font-size: 0.88rem;">${item.nomenclatura || 'N/A'}</span></td>
                <td><strong>${item.nombre_residente || 'N/A'}</strong></td>
                <td>
                    <span style="font-size: 0.82rem; color: var(--text-secondary);" title="${item.correo || ''}">
                        📞 ${item.celular || 'S/N'}
                    </span>
                </td>
                <td>${badgeVehiculo}</td>
                <td><strong>${rentaFormatted}</strong></td>
                <td style="font-size: 0.82rem; white-space: nowrap;">
                    ${item.fecha_move_in || 'N/A'} ➔ <strong>${item.fecha_move_out || 'N/A'}</strong>
                </td>
                <td>
                    <span class="badge-status ${item.tipo_contrato === '12 meses' ? 'status-green' : 'status-yellow'}" style="font-size: 0.75rem; padding: 2px 6px;">
                        ${item.tipo_contrato}
                    </span>
                </td>
                <td><span class="badge-vencimiento ${badgeClass}">${estadoTexto}</span></td>
                <td style="text-align: center;">
                    <div class="action-buttons-group" style="justify-content: center;">
                        <button class="btn-table" onclick="abrirModalRenovar('${item.nomenclatura}')" title="Renovar Contrato">🔄</button>
                        <button class="btn-table" onclick="abrirModalAuto('${item.nomenclatura}')" title="Gestionar Auto">🚗</button>
                        <button class="btn-table" onclick="generarPDFContrato('${item.nomenclatura}')" title="Imprimir PDF">📄</button>
                        <button class="btn-table" onclick="verHistorico('${item.nomenclatura}', '${item.nombre_residente}')" title="Ver Histórico">📜</button>
                    </div>
                </td>
            </tr>
        `;
    });

    document.getElementById('statTotalContratos').innerText = datos.length;
    document.getElementById('statIngresoTotal').innerText = ingresoTotal.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
    let promedio = datos.length > 0 ? (ingresoTotal / datos.length) : 0;
    document.getElementById('statRentaPromedio').innerText = promedio.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
    document.getElementById('statPorVencer').innerText = porVencerCount;
}

function aplicarFiltrosContratos() {
    clearTimeout(timeoutBusqueda);
    timeoutBusqueda = setTimeout(() => {
        let query = document.getElementById('searchInput').value.toLowerCase();
        let valTipo = document.getElementById('filterTipoContrato').value;
        let valEstado = document.getElementById('filterEstadoVencimiento').value;

        contratosFiltrados = contratosData.filter(item => {
            let matchQuery = !query || 
                (item.nombre_residente && item.nombre_residente.toLowerCase().includes(query)) || 
                (item.nomenclatura && item.nomenclatura.toLowerCase().includes(query)) ||
                (item.numero_departamento && item.numero_departamento.toLowerCase().includes(query));
            
            let matchTipo = !valTipo || item.tipo_contrato === valTipo;
            let matchEstado = !valEstado || item.estado_vencimiento === valEstado;

            let matchChip = true;
            if (chipActivo === 'por_vencer') matchChip = item.estado_vencimiento === 'Por vencer';
            else if (chipActivo === 'vencidos') matchChip = item.estado_vencimiento === 'Vencido';
            else if (chipActivo === 'renta_alta') matchChip = parseFloat(item.renta || 0) > 10000;
            else if (chipActivo === '12_meses') matchChip = item.tipo_contrato === '12 meses';
            else if (chipActivo === '6_meses') matchChip = item.tipo_contrato === '6 meses';

            return matchQuery && matchTipo && matchEstado && matchChip;
        });

        renderTablaContratos(contratosFiltrados);
    }, 300);
}

function filtrarPorChip(tipo, el) {
    document.querySelectorAll('.chip-btn').forEach(btn => btn.classList.remove('active'));
    el.classList.add('active');
    chipActivo = tipo;
    aplicarFiltrosContratos();
}

// ----------------------------------------------------
// LÓGICA 1: RENOVACIÓN CON/SIN CAMBIO DE DEPARTAMENTO
// ----------------------------------------------------
function abrirModalRenovar(nomenclatura) {
    contratoSeleccionado = contratosData.find(c => c.nomenclatura === nomenclatura);
    if (!contratoSeleccionado) return;

    document.getElementById('renovarResidenteInfo').innerText = `${contratoSeleccionado.nombre_residente} (${contratoSeleccionado.nomenclatura})`;
    document.getElementById('inpNuevaRenta').value = contratoSeleccionado.renta;
    document.getElementById('inpCambiaUnidadRenovacion').value = 'NO';
    evaluarCambioUnidadRenovacion();

    calcularNuevaFechaSalidaModal();
    document.getElementById('modalRenovarOverlay').style.display = 'flex';
}

function calcularNuevaFechaSalidaModal() {
    if (!contratoSeleccionado) return;
    let meses = parseInt(document.getElementById('inpPlazoExtension').value);
    let baseFecha = new Date(contratoSeleccionado.fecha_move_out);
    if (isNaN(baseFecha.getTime())) baseFecha = new Date();

    baseFecha.setMonth(baseFecha.getMonth() + meses);

    let yyyy = baseFecha.getFullYear();
    let mm = String(baseFecha.getMonth() + 1).padStart(2, '0');
    let dd = String(baseFecha.getDate()).padStart(2, '0');

    document.getElementById('inpNuevaFechaOut').value = `${yyyy}-${mm}-${dd}`;
}

function evaluarCambioUnidadRenovacion() {
    let cambia = document.getElementById('inpCambiaUnidadRenovacion').value;
    let sec = document.getElementById('seccionNuevasOpcionesUnidad');
    if (cambia === 'SI') {
        sec.style.display = 'block';
        prepararNivelesRenovacion();
    } else {
        sec.style.display = 'none';
    }
}

function estaEspacioDesocupado(item) {
    let dep = String(item.dep || '').trim(), nom = String(item.nomenclatura || '').trim().toUpperCase();
    if (dep === '103' || nom === '104-A1') return false;
    return !(item.nombre && item.nombre.trim() !== '');
}

function prepararNivelesRenovacion() {
    let libres = listaResidentesOriginal.filter(r => estaEspacioDesocupado(r)).map(r => r.nivel).filter(Boolean);
    let selNivel = document.getElementById('inpNivelRenov');
    selNivel.innerHTML = `<option value="">-- Seleccionar --</option>`;
    
    // ORDENAMIENTO CORRECTO: PB -> N2 -> N3 ... -> N12
    ordenarNiveles([...new Set(libres)]).forEach(n => { 
        selNivel.innerHTML += `<option value="${n}">${n}</option>`; 
    });
}

function onNivelRenovChange() {
    let nSel = document.getElementById('inpNivelRenov').value;
    let espaciosNivel = listaResidentesOriginal.filter(r => r.nivel === nSel);
    let depsDisponibles = [...new Set(espaciosNivel.filter(r => estaEspacioDesocupado(r)).map(r => r.dep).filter(Boolean))].sort((a,b)=>(parseInt(a)||0)-(parseInt(b)||0));

    let selDep = document.getElementById('inpDepRenov');
    selDep.innerHTML = `<option value="">-- Seleccionar --</option>`;
    depsDisponibles.forEach(d => { selDep.innerHTML += `<option value="${d}">${d}</option>`; });
    onDepRenovChange();
}

function onDepRenovChange() {
    let depSel = document.getElementById('inpDepRenov').value;
    let recamarasLibres = [];
    listaResidentesOriginal.filter(r => r.dep == depSel).forEach(r => {
        if (estaEspacioDesocupado(r) && r.recamara && !recamarasLibres.includes(r.recamara)) recamarasLibres.push(r.recamara);
    });

    let selRec = document.getElementById('inpRecamaraRenov');
    selRec.innerHTML = '';
    recamarasLibres.sort().forEach(rec => { selRec.innerHTML += `<option value="${rec}">${rec}</option>`; });
    onRecamaraRenovChange();
}

function onRecamaraRenovChange() {
    let depSel = document.getElementById('inpDepRenov').value, recSel = document.getElementById('inpRecamaraRenov').value;
    let camasLibres = [];
    listaResidentesOriginal.filter(r => r.dep == depSel && r.recamara === recSel).forEach(r => {
        if (estaEspacioDesocupado(r) && r.cama && !camasLibres.includes(String(r.cama))) camasLibres.push(String(r.cama));
    });

    let selCama = document.getElementById('inpCamaRenov');
    selCama.innerHTML = '';
    camasLibres.sort().forEach(c => { selCama.innerHTML += `<option value="${c}">${c}</option>`; });
    actualizarNomenclaturaRenov();
}

function actualizarNomenclaturaRenov() {
    let dep = document.getElementById('inpDepRenov').value || '101';
    let rec = document.getElementById('inpRecamaraRenov').value || 'A';
    let cama = document.getElementById('inpCamaRenov').value || '1';
    document.getElementById('inpNomenclaturaRenov').value = `${dep}-${rec}${cama}`;
}

function cerrarModalRenovar() {
    document.getElementById('modalRenovarOverlay').style.display = 'none';
    contratoSeleccionado = null;
}

async function guardarRenovacion() {
    if (!contratoSeleccionado) return;

    let nuevaFecha = document.getElementById('inpNuevaFechaOut').value;
    let nuevaRenta = parseFloat(document.getElementById('inpNuevaRenta').value);
    let cambiaUnidad = document.getElementById('inpCambiaUnidadRenovacion').value === 'SI';
    let nomNueva = cambiaUnidad ? document.getElementById('inpNomenclaturaRenov').value : contratoSeleccionado.nomenclatura;

    if (!nuevaFecha || isNaN(nuevaRenta)) {
        mostrarNotificacion('Ingresa valores válidos para la fecha y renta.', 'error');
        return;
    }

    let payload = {
        action: 'renovar',
        residente: contratoSeleccionado.nombre_residente,
        nomenclatura_anterior: contratoSeleccionado.nomenclatura,
        nomenclatura_nueva: nomNueva,
        fecha_out_anterior: contratoSeleccionado.fecha_move_out,
        nueva_fecha_out: nuevaFecha,
        renta_anterior: contratoSeleccionado.renta,
        nueva_renta: nuevaRenta,
        plazo_extension: document.getElementById('inpPlazoExtension').value + ' meses',
        dep_nuevo: cambiaUnidad ? document.getElementById('inpDepRenov').value : contratoSeleccionado.numero_departamento,
        recamara_nueva: cambiaUnidad ? (document.getElementById('inpRecamaraRenov').value + document.getElementById('inpCamaRenov').value) : contratoSeleccionado.recamara
    };

    try {
        let response = await fetch('api_contratos.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        let res = await response.json();
        if (res.status === 'success') {
            mostrarNotificacion('Renovación guardada correctamente.', 'success');
            cerrarModalRenovar();
            await cargarContratosDesdeBD();
        } else {
            mostrarNotificacion('Error: ' + res.message, 'error');
        }
    } catch (e) {
        mostrarNotificacion('Error de conexión al renovar.', 'error');
    }
}

// ----------------------------------------------------
// LÓGICA 2: ASIGNACIÓN / GESTIÓN DE VEHÍCULO EN CONTRATOS
// ----------------------------------------------------
async function abrirModalAuto(nomenclatura) {
    contratoSeleccionado = contratosData.find(c => c.nomenclatura === nomenclatura);
    if (!contratoSeleccionado) return;

    document.getElementById('autoResidenteInfo').innerText = `${contratoSeleccionado.nombre_residente} (${contratoSeleccionado.nomenclatura})`;
    
    try {
        // 1. Consultar si ya tiene auto registrado
        let resp = await fetch(`api_contratos.php?action=obtener_auto&nomenclatura=${encodeURIComponent(nomenclatura)}`);
        let res = await resp.json();
        let cajonActual = (res.status === 'success' && res.data && res.data.cajon) ? String(res.data.cajon).trim().toLowerCase() : '';

        // 2. Obtener cajones ocupados por OTROS residentes
        let cajonesOcupados = listaResidentesOriginal
            .filter(r => r.nombre && r.nombre.trim() !== '' && r.nomenclatura !== nomenclatura)
            .map(r => r.cajon)
            .filter(Boolean)
            .map(c => String(c).trim().toLowerCase());

        let selCajon = document.getElementById('inpCajonAutoModal');
        selCajon.innerHTML = `<option value="">-- Seleccionar Cajón --</option>`;

        // 3. Poblar solo cajones libres o el actual del residente
        for (let i = 1; i <= 40; i++) {
            let nombreCajon = "cajón " + i;
            let numeroCajonStr = String(i);

            if (!cajonesOcupados.includes(nombreCajon) && !cajonesOcupados.includes(numeroCajonStr)) {
                selCajon.innerHTML += `<option value="Cajón ${i}">Cajón ${i}</option>`;
            }
        }

        if (res.status === 'success' && res.data) {
            document.getElementById('inpOpcionAuto').value = 'ASIGNAR';
            selCajon.value = res.data.cajon || '';
            document.getElementById('inpModeloAutoModal').value = res.data.modelo_auto || '';
            document.getElementById('inpColorAutoModal').value = res.data.color_auto || '';
            document.getElementById('inpTagAutoModal').value = res.data.numero_tag || '';
            document.getElementById('inpPlacasAutoModal').value = res.data.placas || '';
        } else {
            document.getElementById('inpOpcionAuto').value = 'ASIGNAR';
            selCajon.value = '';
            document.getElementById('inpModeloAutoModal').value = '';
            document.getElementById('inpColorAutoModal').value = '';
            document.getElementById('inpTagAutoModal').value = '';
            document.getElementById('inpPlacasAutoModal').value = '';
        }
    } catch (e) { 
        console.error(e); 
    }

    evaluarOpcionAuto();
    document.getElementById('modalAutoOverlay').style.display = 'flex';
}

function evaluarOpcionAuto() {
    let opt = document.getElementById('inpOpcionAuto').value;
    let bloque = document.getElementById('bloqueCamposAuto');
    let btn = document.getElementById('btnGuardarAuto');

    if (opt === 'RETIRAR') {
        bloque.style.display = 'none';
        btn.innerText = 'Confirmar Retiro de Vehículo';
        btn.style.background = '#ef4444';
    } else {
        bloque.style.display = 'block';
        btn.innerText = 'Guardar Asignación';
        btn.style.background = '#6366f1';
    }
}

function cerrarModalAuto() {
    document.getElementById('modalAutoOverlay').style.display = 'none';
    contratoSeleccionado = null;
}

async function guardarVehiculo() {
    if (!contratoSeleccionado) return;

    let opcion = document.getElementById('inpOpcionAuto').value;
    let payload = {
        action: 'guardar_auto',
        nomenclatura: contratoSeleccionado.nomenclatura,
        residente: contratoSeleccionado.nombre_residente,
        opcion_auto: opcion,
        cajon: document.getElementById('inpCajonAutoModal').value,
        modelo: document.getElementById('inpModeloAutoModal').value.trim(),
        color: document.getElementById('inpColorAutoModal').value.trim(),
        tag: document.getElementById('inpTagAutoModal').value.trim(),
        placas: document.getElementById('inpPlacasAutoModal').value.trim()
    };

    if (opcion === 'ASIGNAR' && (!payload.cajon || !payload.placas)) {
        mostrarNotificacion('Por favor asigna un cajón y escribe las placas.', 'error');
        return;
    }

    try {
        let response = await fetch('api_contratos.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        let res = await response.json();
        if (res.status === 'success') {
            mostrarNotificacion(res.message, 'success');
            cerrarModalAuto();
            await cargarContratosDesdeBD();
        } else {
            mostrarNotificacion('Error: ' + res.message, 'error');
        }
    } catch (e) {
        mostrarNotificacion('Error de conexión al guardar vehículo.', 'error');
    }
}

// ----------------------------------------------------
// HISTÓRICO COMBINADO (RENOVACIONES Y CAMBIOS)
// ----------------------------------------------------
async function verHistorico(nomenclatura, residente) {
    let contenedor = document.getElementById('historicoContenido');
    contenedor.innerHTML = '<p>Cargando historial...</p>';
    document.getElementById('modalHistoricoOverlay').style.display = 'flex';

    try {
        let resp = await fetch(`api_contratos.php?action=historico&nomenclatura=${encodeURIComponent(nomenclatura)}&residente=${encodeURIComponent(residente)}`);
        let res = await resp.json();

        if (res.status === 'success') {
            contenedor.innerHTML = '';
            let tieneDatos = false;

            if (res.renovaciones.length > 0) {
                tieneDatos = true;
                contenedor.innerHTML += '<h4 style="margin: 5px 0; color: #10b981;">🔄 Historial de Renovaciones:</h4>';
                res.renovaciones.forEach(r => {
                    contenedor.innerHTML += `
                        <div style="background: var(--bg-main); border: 1px solid var(--border-color); padding: 12px; border-radius: 8px;">
                            <div style="display: flex; justify-content: space-between; font-weight: bold;">
                                <span>${r.residente}</span>
                                <span style="color: #10b981;">${r.fecha_registro}</span>
                            </div>
                            <p style="margin: 4px 0; font-size: 0.88rem;">
                                <strong>Plazo:</strong> ${r.plazo_extension} | <strong>Renta:</strong> $${parseFloat(r.renta_anterior).toLocaleString('es-MX')} ➔ $${parseFloat(r.renta_nueva).toLocaleString('es-MX')} MXN
                            </p>
                            <p style="margin: 4px 0; font-size: 0.85rem; color: var(--text-secondary);">
                                <strong>Move-Out:</strong> ${r.fecha_out_anterior} ➔ ${r.fecha_out_nueva}
                            </p>
                        </div>
                    `;
                });
            }

            if (res.cambios.length > 0) {
                tieneDatos = true;
                contenedor.innerHTML += '<h4 style="margin: 12px 0 5px 0; color: #6366f1;">🔀 Historial de Cambios de Unidad:</h4>';
                res.cambios.forEach(c => {
                    contenedor.innerHTML += `
                        <div style="background: var(--bg-main); border: 1px solid var(--border-color); padding: 12px; border-radius: 8px;">
                            <div style="display: flex; justify-content: space-between; font-weight: bold;">
                                <span>${c.residente}</span>
                                <span style="color: #6366f1;">${c.fecha_cambio}</span>
                            </div>
                            <p style="margin: 4px 0; font-size: 0.88rem;">
                                <strong>Cambio:</strong> ${c.nomenclatura_inicial} ➔ ${c.nomenclatura_nueva}
                            </p>
                            <p style="margin: 4px 0; font-size: 0.85rem; color: var(--text-secondary);">
                                <strong>Motivo:</strong> ${c.motivo_cambio}
                            </p>
                        </div>
                    `;
                });
            }

            if (!tieneDatos) {
                contenedor.innerHTML = '<p style="color: var(--text-secondary);">No hay renovaciones ni cambios registrados para este espacio.</p>';
            }
        }
    } catch (e) {
        contenedor.innerHTML = '<p style="color: #ef4444;">Error al cargar historial.</p>';
    }
}

function cerrarModalHistorico() {
    document.getElementById('modalHistoricoOverlay').style.display = 'none';
}

function exportarExcel() {
    if (contratosFiltrados.length === 0) {
        mostrarNotificacion('No hay datos visibles para exportar.', 'error');
        return;
    }

    let dataExcel = contratosFiltrados.map(item => ({
        "Departamento": item.numero_departamento,
        "Recámara": item.recamara,
        "Nomenclatura": item.nomenclatura,
        "Residente": item.nombre_residente,
        "Celular": item.celular,
        "Correo": item.correo,
        "Renta Mensual": parseFloat(item.renta || 0),
        "Tiene Carro": item.tiene_carro,
        "Fecha Move-In": item.fecha_move_in,
        "Fecha Move-Out": item.fecha_move_out,
        "Tipo Contrato": item.tipo_contrato,
        "Estado Vencimiento": item.estado_vencimiento,
        "Días Restantes": item.dias_restantes
    }));

    let worksheet = XLSX.utils.json_to_sheet(dataExcel);
    let workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Contratos U-Tower");
    XLSX.writeFile(workbook, `Contratos_UTower_${new Date().toISOString().slice(0,10)}.xlsx`);
    mostrarNotificacion('Reporte Excel descargado correctamente.', 'success');
}

function generarPDFContrato(nomenclatura) {
    let item = contratosData.find(c => c.nomenclatura === nomenclatura);
    if (!item) return;

    let ventana = window.open('', '_blank');
    ventana.document.write(`
        <html>
        <head>
            <title>Contrato_UTower_${item.nomenclatura}</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 40px; color: #1e293b; line-height: 1.6; }
                .header { text-align: center; border-bottom: 2px solid #6366f1; padding-bottom: 15px; margin-bottom: 30px; }
                .title { font-size: 22px; font-weight: bold; color: #312e81; }
                .subtitle { font-size: 14px; color: #64748b; }
                .box { border: 1px solid #e2e8f0; padding: 20px; border-radius: 8px; background: #f8fafc; margin-bottom: 25px; }
                .row { display: flex; justify-content: space-between; margin-bottom: 10px; }
                .label { font-weight: bold; color: #475569; }
                .signatures { margin-top: 80px; display: flex; justify-content: space-between; text-align: center; }
                .line { width: 220px; border-top: 1px solid #000; margin-bottom: 5px; }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="title">RESIDENCIAL U-TOWER</div>
                <div class="subtitle">Comprobante de Contrato de Arrendamiento</div>
            </div>

            <div class="box">
                <div class="row"><span class="label">Residente:</span> <span>${item.nombre_residente}</span></div>
                <div class="row"><span class="label">Nomenclatura / Espacio:</span> <span>${item.nomenclatura} (Dep. ${item.numero_departamento})</span></div>
                <div class="row"><span class="label">Teléfono:</span> <span>${item.celular || 'N/R'}</span></div>
                <div class="row"><span class="label">Correo:</span> <span>${item.correo || 'N/R'}</span></div>
                <div class="row"><span class="label">Duración del Contrato:</span> <span>${item.tipo_contrato}</span></div>
                <div class="row"><span class="label">Monto Renta Mensual:</span> <span>$${parseFloat(item.renta).toLocaleString('es-MX')} MXN</span></div>
                <div class="row"><span class="label">Fecha Vigencia:</span> <span>${item.fecha_move_in} al ${item.fecha_move_out}</span></div>
            </div>

            <p>Por medio del presente documento se hace constar el registro activo del contrato de hospedaje/arrendamiento en la unidad designada bajo el reglamento interno de U-Tower.</p>

            <div class="signatures">
                <div><div class="line"></div>Firma del Residente</div>
                <div><div class="line"></div>Administración U-Tower</div>
            </div>

            <script>window.onload = function() { window.print(); }<\/script>
        </body>
        </html>
    `);
    ventana.document.close();
}

function ordenarNiveles(niveles) {
    return niveles.sort((a, b) => {
        let strA = String(a).trim().toUpperCase(), strB = String(b).trim().toUpperCase();
        if (strA === 'PB') return -1; 
        if (strB === 'PB') return 1;
        return (parseInt(strA.replace(/\D/g, '')) || 0) - (parseInt(strB.replace(/\D/g, '')) || 0);
    });
}

function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    let esOscuro = document.body.classList.contains('dark-mode');
    localStorage.setItem('theme', esOscuro ? 'dark' : 'light');
    document.getElementById('themeIcon').innerText = esOscuro ? '☀️' : '🌙';
    document.getElementById('themeText').innerText = esOscuro ? 'Modo Claro' : 'Modo Oscuro';
}

window.onload = function() {
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-mode');
        document.getElementById('themeIcon').innerText = '☀️';
        document.getElementById('themeText').innerText = 'Modo Claro';
    }
    
    cargarContratosDesdeBD().then(() => {
        let params = new URLSearchParams(window.location.search);
        let nomRenovar = params.get('renovar');
        if (nomRenovar) {
            abrirModalRenovar(nomRenovar);
        }
    });
};