let contratosData = [];
let contratosFiltrados = [];
let listaResidentesOriginal = [];
let timeoutBusqueda = null;
let contratoSeleccionado = null;
let chipActivo = 'todos';
let nomenclaturasAEliminarGlobal = [];
let paginaActualContratos = 1;
let filasPorPaginaContratos = 25;
let mostrarTodoContratos = false;

async function cargarContratosDesdeBD() {
    try {
        let response = await fetch('../API/api_contratos.php');
        contratosData = await response.json();
        contratosFiltrados = [...contratosData];
        
        let resResp = await fetch('../API/api_residentes.php');
        listaResidentesOriginal = await resResp.json();

        renderTablaContratos(contratosFiltrados);
        actualizarBadgeSidebarYNotificaciones();
    } catch (error) {
        console.error("Error al conectar con la base de datos:", error);
        mostrarNotificacion('Error al cargar contratos.', 'error');
    }
}

// PANEL Y CONTADOR DE NOTIFICACIONES ACTIVAS (CAMPANA)
function actualizarBadgeSidebarYNotificaciones() {
    let badgeSidebar = document.getElementById('sidebarBadgeContratosAlertas');
    let badgeHeader = document.getElementById('headerBadgeNotif');
    let listaContenido = document.getElementById('listaNotificacionesContenido');

    let pendientes = contratosData.filter(c => c.estado_vencimiento === 'Por vencer' || c.estado_vencimiento === 'Vencido');
    let total = pendientes.length;

    if (badgeSidebar) {
        badgeSidebar.innerText = total;
        badgeSidebar.style.display = total > 0 ? 'inline-block' : 'none';
    }
    if (badgeHeader) {
        badgeHeader.innerText = total;
        badgeHeader.style.display = total > 0 ? 'inline-block' : 'none';
    }

    if (listaContenido) {
        if (total === 0) {
            listaContenido.innerHTML = '<p style="font-size:0.85rem; color:var(--text-secondary); text-align:center; padding:10px 0;">No hay contratos pendientes ni por vencer.</p>';
        } else {
            listaContenido.innerHTML = '';
            pendientes.forEach(res => {
                let colorTag = res.estado_vencimiento === 'Vencido' ? '#ef4444' : '#f59e0b';
                let estadoTexto = res.estado_vencimiento === 'Vencido' ? `Vencido (${Math.abs(res.dias_restantes)} d.)` : `Por vencer (${res.dias_restantes} d.)`;
                
                listaContenido.innerHTML += `
                    <div style="background: var(--bg-main); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px 12px; font-size: 0.85rem;">
                        <div style="display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 4px;">
                            <span>${res.nombre_residente}</span>
                            <span style="color: ${colorTag}; font-size:0.78rem;">${estadoTexto}</span>
                        </div>
                        <div style="color: var(--text-secondary); font-size: 0.8rem; margin-bottom: 8px;">
                            Nomenclatura: <strong>${res.nomenclatura}</strong> | Vence: <strong>${res.fecha_move_out}</strong>
                        </div>
                        <div style="display: flex; gap: 6px; justify-content: flex-end;">
                            <button onclick="iniciarMoveOutDesdeNotif('${res.nomenclatura}')" style="background: #ef4444; color: #fff; border: none; padding: 4px 10px; border-radius: 4px; font-size: 0.78rem; font-weight: bold; cursor: pointer;">
                                🚪 Move-Out
                            </button>
                            <button onclick="abrirModalRenovar('${res.nomenclatura}'); togglePanelNotificaciones();" style="background: #10b981; color: #fff; border: none; padding: 4px 10px; border-radius: 4px; font-size: 0.78rem; font-weight: bold; cursor: pointer;">
                                🔄 Renovar
                            </button>
                        </div>
                    </div>
                `;
            });
        }
    }
}

function togglePanelNotificaciones() {
    let panel = document.getElementById('panelNotificaciones');
    if (panel) {
        panel.style.display = (panel.style.display === 'none' || !panel.style.display) ? 'block' : 'none';
    }
}

function iniciarMoveOutDesdeNotif(nomenclatura) {
    togglePanelNotificaciones();
    nomenclaturasAEliminarGlobal = [nomenclatura];
    let res = contratosData.find(c => c.nomenclatura === nomenclatura);
    if (!res) return;

    let contenedor = document.getElementById('moveoutDetallesContenedor');
    contenedor.innerHTML = '';
    document.getElementById('inpMotivoMoveOut').value = '';

    contenedor.innerHTML = `
        <div style="background-color: var(--bg-main); border: 1px solid var(--border-color); border-radius: 10px; padding: 18px 20px; font-size: 0.92rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; border-bottom: 1px dashed var(--border-color); padding-bottom: 10px;">
                <strong style="font-size: 1.1rem; color: var(--text-primary);">${res.nombre_residente}</strong>
                <span style="background: #6366f1; color: #fff; padding: 4px 10px; border-radius: 6px; font-weight: bold; font-size: 0.85rem;">${res.nomenclatura}</span>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 12px 24px; color: var(--text-primary); line-height: 1.6;">
                <div style="display: flex; flex-direction: column; gap: 6px;">
                    <p style="margin: 0;"><strong>📞 Teléfono:</strong> ${res.celular || 'No registrado'}</p>
                    <p style="margin: 0;"><strong>✉️ Correo:</strong> ${res.correo || 'No registrado'}</p>
                    <p style="margin: 0;"><strong>📍 Ubicación:</strong> Dep. ${res.numero_departamento || 'N/A'}</p>
                </div>
                <div style="display: flex; flex-direction: column; gap: 6px;">
                    <p style="margin: 0;"><strong>💵 Renta:</strong> $${parseFloat(res.renta || 0).toLocaleString('es-MX')} MXN</p>
                    <p style="margin: 0;"><strong>📅 Fecha Move-In:</strong> ${res.fecha_move_in || 'N/A'}</p>
                    <p style="margin: 0;"><strong>📅 Fecha Move-Out:</strong> ${res.fecha_move_out || 'N/A'}</p>
                </div>
            </div>
        </div>
    `;

    document.getElementById('modalMoveOutOverlay').style.display = 'flex';
}

function cerrarModalMoveOut() { 
    document.getElementById('modalMoveOutOverlay').style.display = 'none'; 
    nomenclaturasAEliminarGlobal = []; 
}

async function ejecutarMoveOutConfirmado() {
    if (nomenclaturasAEliminarGlobal.length === 0) return;
    let motivoIngresado = document.getElementById('inpMotivoMoveOut').value.trim();

    if (!motivoIngresado) {
        mostrarNotificacion('Por favor ingresa el motivo de la salida para continuar.', 'error');
        document.getElementById('inpMotivoMoveOut').focus();
        return;
    }

    let registrosSalida = nomenclaturasAEliminarGlobal.map(nom => ({ 
        nomenclatura: nom, 
        motivo_salida: motivoIngresado 
    }));

    try {
        let response = await fetch('../API/api_move_out.php', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ registros: registrosSalida }) 
        });
        
        let resultado = await response.json();
        if (resultado.status === 'success') {
            cerrarModalMoveOut();
            mostrarNotificacion('Salida del residente registrada correctamente', 'success');
            await cargarContratosDesdeBD();
        } else { 
            mostrarNotificacion('Error al procesar salida: ' + resultado.message, 'error'); 
        }
    } catch (error) { 
        mostrarNotificacion('Error crítico: Falló la conexión con el servidor.', 'error'); 
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

    let totalRegistros = datos.length;
    let totalPaginas = mostrarTodoContratos ? 1 : Math.ceil(totalRegistros / filasPorPaginaContratos) || 1;

    if (paginaActualContratos > totalPaginas) paginaActualContratos = totalPaginas;
    if (paginaActualContratos < 1) paginaActualContratos = 1;

    let inicio = mostrarTodoContratos ? 0 : (paginaActualContratos - 1) * filasPorPaginaContratos;
    let fin = mostrarTodoContratos ? totalRegistros : Math.min(inicio + filasPorPaginaContratos, totalRegistros);

    let datosPaginados = datos.slice(inicio, fin);

    let ingresoTotal = 0;
    let porVencerCount = 0;

    // Métricas sobre el total completo de datos
    datos.forEach(item => {
        ingresoTotal += parseFloat(item.renta || 0);
        if (item.estado_vencimiento !== 'Vigente') porVencerCount++;
    });

    datosPaginados.forEach((item) => {
        let rentaVal = parseFloat(item.renta || 0);
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
                    <div class="col-contacto">
                        <span class="tel-text"><i class="fas fa-phone" style="color: #ec4899; font-size: 0.75rem;"></i> ${item.celular || 'S/N'}</span>
                        <span class="email-text"><i class="fas fa-envelope" style="font-size: 0.75rem;"></i> ${item.correo || 'S/C'}</span>
                    </div>
                </td>
                <td>${badgeVehiculo}</td>
                <td><strong>${rentaFormatted}</strong></td>
                <td>
                    <div class="col-vigencia">
                        <span class="fecha-inicio">${item.fecha_move_in || 'N/A'}</span>
                        <span class="fecha-fin">${item.fecha_move_out || 'N/A'}</span>
                    </div>
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

    document.getElementById('statTotalContratos').innerText = totalRegistros;
    document.getElementById('statIngresoTotal').innerText = ingresoTotal.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
    let promedio = totalRegistros > 0 ? (ingresoTotal / totalRegistros) : 0;
    document.getElementById('statRentaPromedio').innerText = promedio.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
    document.getElementById('statPorVencer').innerText = porVencerCount;

    actualizarControlesPaginacionContratos(totalRegistros, totalPaginas, inicio, fin);
}

function actualizarControlesPaginacionContratos(totalRegistros, totalPaginas, inicio, fin) {
    let selectPagina = document.getElementById('selectPaginaContratos');
    if (selectPagina) {
        selectPagina.innerHTML = '';
        for (let i = 1; i <= totalPaginas; i++) {
            selectPagina.innerHTML += `<option value="${i}" ${i === paginaActualContratos ? 'selected' : ''}>${i}</option>`;
        }
        selectPagina.disabled = mostrarTodoContratos;
    }

    let textoRango = document.getElementById('textoRangoFilasContratos');
    if (textoRango) {
        if (totalRegistros === 0) {
            textoRango.innerText = 'Mostrando 0 de 0';
        } else {
            textoRango.innerText = `Mostrando ${inicio + 1} - ${fin} de ${totalRegistros}`;
        }
    }
}

function cambiarPaginaDirectaContratos(num) {
    paginaActualContratos = parseInt(num) || 1;
    renderTablaContratos(contratosFiltrados);
}

function cambiarPaginaRelativeContratos(delta) {
    paginaActualContratos += delta;
    renderTablaContratos(contratosFiltrados);
}

function cambiarFilasPorPaginaContratos(val) {
    filasPorPaginaContratos = parseInt(val) || 25;
    paginaActualContratos = 1;
    renderTablaContratos(contratosFiltrados);
}

function toggleMostrarTodoContratos(checked) {
    mostrarTodoContratos = checked;
    document.getElementById('selectFilasPorPaginaContratos').disabled = checked;
    paginaActualContratos = 1;
    renderTablaContratos(contratosFiltrados);
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
    
    // Si el departamento está deshabilitado en la base de datos, lo ignoramos por completo
    if (item.estado_dep === 'Deshabilitado' || item.estado === 'Deshabilitado') {
        return false;
    }

    if (dep === '103' || nom === '104-A1') return false;
    return !(item.nombre && item.nombre.trim() !== '');
}

function prepararNivelesRenovacion() {
    let libres = listaResidentesOriginal.filter(r => estaEspacioDesocupado(r)).map(r => r.nivel).filter(Boolean);
    let selNivel = document.getElementById('inpNivelRenov');
    selNivel.innerHTML = `<option value="">-- Seleccionar --</option>`;
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

    let nuevaFechaStr = document.getElementById('inpNuevaFechaOut').value;
    let nuevaRenta = parseFloat(document.getElementById('inpNuevaRenta').value);
    let cambiaUnidad = document.getElementById('inpCambiaUnidadRenovacion').value === 'SI';
    let nomNueva = cambiaUnidad ? document.getElementById('inpNomenclaturaRenov').value : contratoSeleccionado.nomenclatura;

    if (!nuevaFechaStr || isNaN(nuevaRenta)) {
        mostrarNotificacion('Ingresa valores válidos para la fecha y renta.', 'error');
        return;
    }

    let fechaOutAnterior = new Date(contratoSeleccionado.fecha_move_out);
    let nuevaFecha = new Date(nuevaFechaStr);

    if (nuevaFecha <= fechaOutAnterior) {
        mostrarNotificacion(`La nueva fecha de salida (${nuevaFechaStr}) debe ser posterior a la fecha de vencimiento actual (${contratoSeleccionado.fecha_move_out}).`, 'error');
        return;
    }

    let payload = {
        action: 'renovar',
        residente: contratoSeleccionado.nombre_residente,
        nomenclatura_anterior: contratoSeleccionado.nomenclatura,
        nomenclatura_nueva: nomNueva,
        fecha_out_anterior: contratoSeleccionado.fecha_move_out,
        nueva_fecha_out: nuevaFechaStr,
        renta_anterior: contratoSeleccionado.renta,
        nueva_renta: nuevaRenta,
        plazo_extension: document.getElementById('inpPlazoExtension').value + ' meses',
        dep_nuevo: cambiaUnidad ? document.getElementById('inpDepRenov').value : contratoSeleccionado.numero_departamento,
        recamara_nueva: cambiaUnidad ? (document.getElementById('inpRecamaraRenov').value + document.getElementById('inpCamaRenov').value) : contratoSeleccionado.recamara
    };

    try {
        let response = await fetch('../API/api_contratos.php', {
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

async function abrirModalAuto(nomenclatura) {
    contratoSeleccionado = contratosData.find(c => c.nomenclatura === nomenclatura);
    if (!contratoSeleccionado) return;

    document.getElementById('autoResidenteInfo').innerText = `${contratoSeleccionado.nombre_residente} (${contratoSeleccionado.nomenclatura})`;
    document.getElementById('inpMotivoAutoModal').value = '';
    evaluarOpcionAuto();
    document.getElementById('modalAutoOverlay').style.display = 'flex';
    
    try {
        // Cargar configuración para conocer cajones deshabilitados
        let configResp = await fetch('../API/api_configuraciones.php');
        let configRes = await configResp.json();
        let cajonesDeshabSet = new Set();
        if (configRes.status === 'success' && configRes.cajones) {
            configRes.cajones.forEach(c => {
                if (c.estado === 'Deshabilitado') {
                    let nc = String(c.nombre_cajon).trim().toLowerCase();
                    cajonesDeshabSet.add(nc);
                    cajonesDeshabSet.add(nc.replace('cajón ', '').replace('cajon ', ''));
                }
            });
        }

        let resp = await fetch(`../API/api_contratos.php?action=obtener_auto&nomenclatura=${encodeURIComponent(nomenclatura)}`);
        let res = await resp.json();

        let cajonesOcupados = listaResidentesOriginal
            .filter(r => r.nombre && r.nombre.trim() !== '' && r.nomenclatura !== nomenclatura)
            .map(r => r.cajon)
            .filter(Boolean)
            .map(c => String(c).trim().toLowerCase());

        let selCajon = document.getElementById('inpCajonAutoModal');
        selCajon.innerHTML = `<option value="">-- Seleccionar Cajón --</option>`;

        for (let i = 1; i <= 40; i++) {
            let nombreCajon = "cajón " + i;
            let numeroCajonStr = String(i);

            let estaOcupado = cajonesOcupados.includes(nombreCajon) || cajonesOcupados.includes(numeroCajonStr);
            let estaDeshabilitado = cajonesDeshabSet.has(numeroCajonStr) || cajonesDeshabSet.has(nombreCajon);

            if (!estaOcupado && !estaDeshabilitado) {
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
    } catch (e) { console.error(e); }

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
    let motivo = document.getElementById('inpMotivoAutoModal').value.trim();

    if (!motivo) {
        mostrarNotificacion('Por favor ingresa el motivo del cambio o asignación.', 'error');
        document.getElementById('inpMotivoAutoModal').focus();
        return;
    }

    if (opcion === 'RETIRAR') {
        let confirmar = confirm(`¿Estás seguro de retirar el vehículo y liberar el cajón de ${contratoSeleccionado.nombre_residente}?`);
        if (!confirmar) return;
    }

    let payload = {
        action: 'guardar_auto',
        nomenclatura: contratoSeleccionado.nomenclatura,
        residente: contratoSeleccionado.nombre_residente,
        opcion_auto: opcion,
        cajon: document.getElementById('inpCajonAutoModal').value,
        modelo: document.getElementById('inpModeloAutoModal').value.trim(),
        color: document.getElementById('inpColorAutoModal').value.trim(),
        tag: document.getElementById('inpTagAutoModal').value.trim(),
        placas: document.getElementById('inpPlacasAutoModal').value.trim(),
        motivo: motivo
    };

    if (opcion === 'ASIGNAR' && (!payload.cajon || !payload.placas)) {
        mostrarNotificacion('Por favor asigna un cajón y escribe las placas.', 'error');
        return;
    }

    try {
        let response = await fetch('../API/api_contratos.php', {
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

async function verHistorico(nomenclatura, residente) {
    let contenedor = document.getElementById('historicoContenido');
    contenedor.innerHTML = '<p>Cargando historial...</p>';
    document.getElementById('modalHistoricoOverlay').style.display = 'flex';

    try {
        let resp = await fetch(`../API/api_contratos.php?action=historico&nomenclatura=${encodeURIComponent(nomenclatura)}&residente=${encodeURIComponent(residente)}`);
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