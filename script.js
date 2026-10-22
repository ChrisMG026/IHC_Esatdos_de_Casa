let residentesData = [];
let residentesFiltradosMemoria = [];
let nomenclaturasAEliminarGlobal = [];
let timeoutBusqueda = null;

async function cargarResidentesDesdeBD() {
    try {
        let response = await fetch('api_residentes.php');
        residentesData = await response.json();
        residentesData.forEach(item => {
            item.status = calcularEstadoContrato(item.fecha_move_out);
            item.tiempoRestante = calcularTiempoRestante(item.fecha_move_out);
        });
        actualizarOpcionesFiltros();
        renderTabla();
        prepararCatalogosModal();
        actualizarBadgeSidebarYNotificaciones();
    } catch (error) {
        console.error("Error al conectar con la base de datos:", error);
        mostrarNotificacion('Error crítico: Falló la conexión con el servidor al cargar datos.', 'error');
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

function calcularEstadoContrato(fechaMoveOut) {
    if (!fechaMoveOut) return "Sin Contrato";
    let hoy = new Date(), salida = new Date(fechaMoveOut);
    let diffDias = Math.ceil((salida - hoy) / (1000 * 60 * 60 * 24));
    if (diffDias < 0) return "Vencido";
    if (diffDias <= 30) return "Vence pronto";
    if (diffDias <= 90) return "Por vencer";
    return "Vigente";
}

function calcularTiempoRestante(fechaMoveOut) {
    if (!fechaMoveOut) return "N/A";
    let hoy = new Date(), fin = new Date(fechaMoveOut);
    if (fin < hoy) return "Contrato finalizado";
    let meses = (fin.getFullYear() - hoy.getFullYear()) * 12 + (fin.getMonth() - hoy.getMonth());
    let dias = fin.getDate() - hoy.getDate();
    if (dias < 0) { meses--; dias += new Date(hoy.getFullYear(), hoy.getMonth(), 0).getDate(); }
    return `${meses} meses y ${dias} días restantes`;
}

// PANEL Y CONTADOR DE NOTIFICACIONES ACTIVAS
function actualizarBadgeSidebarYNotificaciones() {
    let badgeSidebar = document.getElementById('sidebarBadgeAlertas');
    let badgeHeader = document.getElementById('headerBadgeNotif');
    let listaContenido = document.getElementById('listaNotificacionesContenido');

    let pendientes = residentesData.filter(r => r.nombre && r.nombre.trim() !== '' && (r.status === 'Por vencer' || r.status === 'Vence pronto' || r.status === 'Vencido'));

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
                let colorTag = res.status === 'Vencido' ? '#ef4444' : '#f59e0b';
                listaContenido.innerHTML += `
                    <div style="background: var(--bg-main); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px 12px; font-size: 0.85rem;">
                        <div style="display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 4px;">
                            <span>${res.nombre}</span>
                            <span style="color: ${colorTag}; font-size:0.78rem;">${res.status}</span>
                        </div>
                        <div style="color: var(--text-secondary); font-size: 0.8rem; margin-bottom: 8px;">
                            Nomenclatura: <strong>${res.nomenclatura}</strong> | Vence: <strong>${res.fecha_move_out}</strong>
                        </div>
                        <div style="display: flex; gap: 6px; justify-content: flex-end;">
                            <button onclick="iniciarMoveOutDesdeNotif('${res.nomenclatura}')" style="background: #ef4444; color: #fff; border: none; padding: 4px 10px; border-radius: 4px; font-size: 0.78rem; font-weight: bold; cursor: pointer;">
                                🚪 Move-Out
                            </button>
                            <button onclick="irARenovarContrato('${res.nomenclatura}')" style="background: #10b981; color: #fff; border: none; padding: 4px 10px; border-radius: 4px; font-size: 0.78rem; font-weight: bold; cursor: pointer;">
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

// ACCIÓN 1: MOVES OUT DIRECTO DESDE NOTIFICACIÓN
function iniciarMoveOutDesdeNotif(nomenclatura) {
    togglePanelNotificaciones();
    nomenclaturasAEliminarGlobal = [nomenclatura];
    let res = residentesData.find(r => r.nomenclatura === nomenclatura);
    
    if (!res) return;

    let contenedor = document.getElementById('moveoutDetallesContenedor');
    contenedor.innerHTML = '';
    document.getElementById('inpMotivoMoveOut').value = '';

    let recamaraLetra = res.recamara || (res.nomenclatura ? res.nomenclatura.split('-')[1]?.charAt(0) : 'N/A');
    let camaNum = res.cama || (res.nomenclatura ? res.nomenclatura.replace(/.*[A-Z]/, '') : 'N/A');

    contenedor.innerHTML = `
        <div style="background-color: var(--bg-main); border: 1px solid var(--border-color); border-radius: 10px; padding: 18px 20px; font-size: 0.92rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; border-bottom: 1px dashed var(--border-color); padding-bottom: 10px;">
                <strong style="font-size: 1.1rem; color: var(--text-primary);">${res.nombre}</strong>
                <span style="background: #6366f1; color: #fff; padding: 4px 10px; border-radius: 6px; font-weight: bold; font-size: 0.85rem;">${res.nomenclatura || 'N/A'}</span>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 12px 24px; color: var(--text-primary); line-height: 1.6;">
                <div style="display: flex; flex-direction: column; gap: 6px;">
                    <p style="margin: 0;"><strong>📞 Teléfono:</strong> ${res.telefono || 'No registrado'}</p>
                    <p style="margin: 0;"><strong>✉️ Correo:</strong> ${res.correo || 'No registrado'}</p>
                    <p style="margin: 0;"><strong>📍 Ubicación:</strong> Nivel ${res.nivel || 'N/A'} - Dep. ${res.dep || 'N/A'}</p>
                </div>
                <div style="display: flex; flex-direction: column; gap: 6px;">
                    <p style="margin: 0;"><strong>🛏️ Recámara / Cama:</strong> Recámara ${recamaraLetra} - Cama ${camaNum}</p>
                    <p style="margin: 0;"><strong>💵 Renta:</strong> $${parseFloat(res.renta || 0).toLocaleString('es-MX')} MXN</p>
                    <p style="margin: 0;"><strong>📅 Fecha Move-In:</strong> ${res.fecha_move_in || 'N/A'}</p>
                </div>
            </div>
        </div>
    `;

    document.getElementById('modalMoveOutOverlay').style.display = 'flex';
}

// ACCIÓN 2: REDIRECCIÓN Y RENOVAR CONTRATO EN PESTAÑA CONTRATOS
function irARenovarContrato(nomenclatura) {
    window.location.href = `Contratos.html?renovar=${encodeURIComponent(nomenclatura)}`;
}

function ordenarNiveles(niveles) {
    return niveles.sort((a, b) => {
        let strA = String(a).trim().toUpperCase(), strB = String(b).trim().toUpperCase();
        if (strA === 'PB') return -1; if (strB === 'PB') return 1;
        return (parseInt(strA.replace(/\D/g, '')) || 0) - (parseInt(strB.replace(/\D/g, '')) || 0);
    });
}

function actualizarOpcionesFiltros() {
    let residentesAsignados = residentesData.filter(r => r.nombre && r.nombre.trim() !== '');
    let valNivel = document.getElementById('filterNivel').value, valDep = document.getElementById('filterDep').value, valEstado = document.getElementById('filterEstado').value, valTipo = document.getElementById('filterTipologia').value;

    poblarSelectMantenimiento('filterNivel', ordenarNiveles([...new Set(residentesAsignados.map(i => i.nivel).filter(Boolean))]), 'Nivel', valNivel);
    poblarSelectMantenimiento('filterDep', [...new Set(residentesAsignados.map(i => i.dep).filter(Boolean))].sort((a,b)=>(parseInt(a)||0)-(parseInt(b)||0)), 'No. Dep', valDep);
    poblarSelectMantenimiento('filterEstado', [...new Set(residentesAsignados.map(i => i.status).filter(Boolean))].sort(), 'Estado', valEstado);
    poblarSelectMantenimiento('filterTipologia', [...new Set(residentesAsignados.map(i => i.tipologia).filter(Boolean))].sort(), 'Tipología', valTipo);
}

function poblarSelectMantenimiento(id, opciones, tituloDefault, valorActual) {
    let select = document.getElementById(id);
    if (!select) return;
    select.innerHTML = `<option value="">${tituloDefault}</option>`;
    opciones.forEach(op => { select.innerHTML += `<option value="${op}" ${op == valorActual ? 'selected' : ''}>${op}</option>`; });
}

function aplicarFiltros() {
    clearTimeout(timeoutBusqueda);
    timeoutBusqueda = setTimeout(() => {
        let query = document.getElementById('searchInput').value.toLowerCase();
        let valNivel = document.getElementById('filterNivel').value;
        let valDep = document.getElementById('filterDep').value;
        let valEstado = document.getElementById('filterEstado').value;
        let valTipo = document.getElementById('filterTipologia').value;
        let valVehiculo = document.getElementById('filterVehiculo')?.value || '';
        let valGenero = document.getElementById('filterGenero')?.value || '';

        let residentesAsignados = residentesData.filter(r => r.nombre && r.nombre.trim() !== '');

        let filtrados = residentesAsignados.filter(item => {
            let matchQuery = !query || item.nombre.toLowerCase().includes(query) || item.nomenclatura.toLowerCase().includes(query);
            let matchNivel = !valNivel || item.nivel === valNivel;
            let matchDep = !valDep || item.dep == valDep;
            let matchEstado = !valEstado || item.status === valEstado;
            let matchTipo = !valTipo || item.tipologia === valTipo;

            let tieneAuto = (item.tiene_carro && item.tiene_carro.toLowerCase() === 'si') || (item.cajon && item.cajon.trim() !== '');
            let matchVehiculo = !valVehiculo || (valVehiculo === 'SI' ? tieneAuto : !tieneAuto);
            let matchGenero = !valGenero || (item.genero && item.genero.toLowerCase() === valGenero.toLowerCase());

            return matchQuery && matchNivel && matchDep && matchEstado && matchTipo && matchVehiculo && matchGenero;
        });

        renderTabla(filtrados);
    }, 300);
}

function renderTabla(datos) {
    let residentesAsignados = datos || residentesData.filter(r => r.nombre && r.nombre.trim() !== '');
    residentesFiltradosMemoria = residentesAsignados;

    let tbody = document.getElementById('tablaBody');
    tbody.innerHTML = '';

    residentesAsignados.forEach((item, index) => {
        let badgeStatusClass = 'status-green', bgDateClass = 'bg-green';
        if (item.status === 'Vence pronto' || item.status === 'Vencido') { badgeStatusClass = 'status-red'; bgDateClass = 'bg-red'; }
        else if (item.status === 'Por vencer') { badgeStatusClass = 'status-yellow'; bgDateClass = 'bg-yellow'; }
        let tieneAuto = (item.tiene_carro && item.tiene_carro.toLowerCase() === 'si') || (item.cajon && item.cajon.trim() !== '');
let badgeVehiculo = tieneAuto 
    ? `<span class="badge-status status-green" title="${item.cajon || 'Con Auto'}">🚗 ${item.cajon || 'Si'}</span>` 
    : `<span style="color: var(--text-secondary); font-size: 0.85rem;">🚫 No</span>`;

        tbody.innerHTML += `
            <tr>
                <td><input type="checkbox" class="row-checkbox" value="${index}"></td>
                <td><strong>${item.nombre}</strong></td>
                <td>${item.genero || 'N/A'}</td>
                <td>${badgeVehiculo}</td>
                <td>${item.nivel || 'N/A'}</td>
                <td>Dep. ${item.dep || 'N/A'}</td>
                <td><span style="font-weight:700; color:#6366f1;">${item.nomenclatura || 'N/A'}</span></td>
                <td>${item.fecha_move_in || 'N/A'}</td>
                <td><span class="badge-date ${bgDateClass}">${item.fecha_move_out || 'N/A'}</span></td>
                <td><span class="badge-status ${badgeStatusClass}">${item.status}</span></td>
                <td style="text-align: center;">
                    <div style="display: flex; gap: 4px; justify-content: center;">
                        <button class="btn-table btn-details" onclick="verDetalles(${index})" title="Ver detalles">👁️</button>
                        <button class="btn-table" onclick="editarResidente(${index})" title="Editar">✏️</button>
                        <button class="btn-table" onclick="generarCredencialResidente(${index})" title="Imprimir Credencial / Expediente">🪪</button>
                    </div>
                </td>
            </tr>
        `;
    });

    document.getElementById('statTotal').innerText = residentesAsignados.length;
    let vigentes = residentesAsignados.filter(r => r.status === 'Vigente').length;
    document.getElementById('statVigentes').innerText = vigentes;
    document.getElementById('statPorVencer').innerText = residentesAsignados.length - vigentes;
}

function exportarResidentesExcel() {
    let datosAExportar = residentesFiltradosMemoria.length > 0 ? residentesFiltradosMemoria : residentesData.filter(r => r.nombre && r.nombre.trim() !== '');

    if (datosAExportar.length === 0) {
        mostrarNotificacion('No hay datos de residentes para exportar.', 'error');
        return;
    }

    let dataExcel = datosAExportar.map(item => ({
        "Residente": item.nombre,
        "Género": item.genero || 'N/A',
        "Nivel": item.nivel || 'N/A',
        "Departamento": item.dep || 'N/A',
        "Nomenclatura": item.nomenclatura || 'N/A',
        "Tipología": item.tipologia || 'N/A',
        "Teléfono": item.telefono || 'N/R',
        "Correo": item.correo || 'N/R',
        "Renta Mensual": parseFloat(item.renta || 0),
        "Fecha Move-In": item.fecha_move_in || 'N/A',
        "Fecha Move-Out": item.fecha_move_out || 'N/A',
        "Estado Contrato": item.status,
        "Cajón Estacionamiento": item.cajon || 'Ninguno',
        "Placas Auto": item.placas || 'N/A'
    }));

    let worksheet = XLSX.utils.json_to_sheet(dataExcel);
    let workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Residentes U-Tower");
    XLSX.writeFile(workbook, `Residentes_UTower_${new Date().toISOString().slice(0,10)}.xlsx`);
    mostrarNotificacion('Lista de residentes exportada exitosamente.', 'success');
}

function generarCredencialResidente(index) {
    let res = residentesFiltradosMemoria[index];
    if (!res) return;

    let ventana = window.open('', '_blank');
    ventana.document.write(`
        <html>
        <head>
            <title>Credencial_${res.nomenclatura}_${res.nombre}</title>
            <style>
                body { font-family: 'Segoe UI', Arial, sans-serif; padding: 30px; background: #f8fafc; color: #0f172a; }
                .card { max-width: 500px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 2px solid #6366f1; padding: 25px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); }
                .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 20px; }
                .logo { font-size: 20px; font-weight: 800; color: #4338ca; }
                .badge-nom { background: #6366f1; color: #ffffff; padding: 6px 14px; border-radius: 8px; font-weight: bold; font-size: 16px; }
                .field { margin-bottom: 12px; }
                .label { font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: bold; margin-bottom: 2px; }
                .val { font-size: 15px; font-weight: 600; color: #1e293b; }
                .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
                .footer { text-align: center; margin-top: 25px; padding-top: 15px; border-top: 1px dashed #cbd5e1; font-size: 12px; color: #64748b; }
            </style>
        </head>
        <body>
            <div class="card">
                <div class="header">
                    <div class="logo">🏢 U-TOWER RESIDENCIAL</div>
                    <div class="badge-nom">${res.nomenclatura}</div>
                </div>

                <div class="field">
                    <div class="label">Nombre del Residente</div>
                    <div class="val" style="font-size: 18px; color: #312e81;">${res.nombre}</div>
                </div>

                <div class="grid" style="margin-top: 15px;">
                    <div class="field"><div class="label">Ubicación</div><div class="val">Nivel ${res.nivel || 'N/A'} - Dep. ${res.dep || 'N/A'}</div></div>
                    <div class="field"><div class="label">Género</div><div class="val">${res.genero || 'N/A'}</div></div>
                    <div class="field"><div class="label">Teléfono Contacto</div><div class="val">${res.telefono || 'No registrado'}</div></div>
                    <div class="field"><div class="label">Correo Electrónico</div><div class="val">${res.correo || 'No registrado'}</div></div>
                    <div class="field"><div class="label">Ingreso (Move-In)</div><div class="val">${res.fecha_move_in || 'N/A'}</div></div>
                    <div class="field"><div class="label">Salida (Move-Out)</div><div class="val">${res.fecha_move_out || 'N/A'}</div></div>
                    <div class="field"><div class="label">Estacionamiento</div><div class="val">${res.cajon || 'Sin cajón'}</div></div>
                    <div class="field"><div class="label">Placas Auto</div><div class="val">${res.placas || 'N/A'}</div></div>
                </div>

                <div class="footer">
                    Expediente Digital Oficial - U-Tower Management System
                </div>
            </div>
            <script>window.onload = function() { window.print(); }<\/script>
        </body>
        </html>
    `);
    ventana.document.close();
}

function verDetalles(index) {
    let res = residentesFiltradosMemoria[index];
    document.getElementById('detallesContenido').innerHTML = `
        <div style="display:flex; flex-direction:column; gap:10px; font-size:0.9rem;">
            <p><strong>Residente:</strong> ${res.nombre} (${res.genero || 'N/A'})</p>
            <p><strong>Ubicación:</strong> Nivel ${res.nivel || 'N/A'} - Dep. ${res.dep || 'N/A'} (${res.nomenclatura || 'N/A'})</p>
            <p><strong>Renta:</strong> $${parseFloat(res.renta || 0).toLocaleString('es-MX')} MXN</p>
            <p><strong>Contrato:</strong> ${res.fecha_move_in || 'N/A'} al ${res.fecha_move_out || 'N/A'}</p>
            <p><strong>Restante:</strong> <span style="color:#6366f1; font-weight:700;">${res.tiempoRestante}</span></p>
        </div>
    `;
    document.getElementById('modalDetallesOverlay').style.display = 'flex';
}
function cerrarModalDetalles() { document.getElementById('modalDetallesOverlay').style.display = 'none'; }

function estaEspacioDesocupado(item) {
    let dep = String(item.dep || '').trim(), nom = String(item.nomenclatura || '').trim().toUpperCase();
    if (dep === '103' || nom === '104-A1') return false;
    return !(item.nombre && item.nombre.trim() !== '');
}

function prepararCatalogosModal() {
    let nivelesLibres = residentesData.filter(r => estaEspacioDesocupado(r)).map(r => r.nivel).filter(Boolean);
    let selNivel = document.getElementById('inpNivelModal');
    selNivel.innerHTML = `<option value="">-- Seleccionar --</option>`;
    ordenarNiveles([...new Set(nivelesLibres)]).forEach(n => { selNivel.innerHTML += `<option value="${n}">${n}</option>`; });

    let cajonesOcupados = residentesData.filter(r => r.nombre && r.nombre.trim() !== '').map(r => r.cajon).filter(Boolean).map(c => String(c).trim().toLowerCase());
    let selCajon = document.getElementById('inpCajonModal');
    selCajon.innerHTML = `<option value="">-- Seleccionar Cajón --</option>`;
    for (let i = 1; i <= 40; i++) {
        if (!cajonesOcupados.includes("cajón " + i) && !cajonesOcupados.includes(String(i))) {
            selCajon.innerHTML += `<option value="Cajón ${i}">Cajón ${i}</option>`;
        }
    }
}

function evaluarTieneCarro() {
    let tieneCarro = document.getElementById('inpTieneCarro').value;
    document.getElementById('rowDeseaRegistrarAuto').style.display = (tieneCarro === 'SI') ? 'block' : 'none';
    if (tieneCarro !== 'SI') { document.getElementById('inpDeseaRegistrarAuto').value = 'NO'; evaluarRegistrarAuto(); }
}

function evaluarRegistrarAuto() {
    document.getElementById('tabHeaderAsignaciones').style.display = (document.getElementById('inpDeseaRegistrarAuto').value === 'SI') ? 'block' : 'none';
}

function onModalNivelChange() {
    let nivelSel = document.getElementById('inpNivelModal').value;
    let espaciosNivel = residentesData.filter(r => r.nivel === nivelSel);
    let depsDisponibles = [...new Set(espaciosNivel.filter(r => estaEspacioDesocupado(r)).map(r => r.dep).filter(Boolean))].sort((a,b)=>(parseInt(a)||0)-(parseInt(b)||0));

    let selDep = document.getElementById('inpDepModal');
    selDep.innerHTML = `<option value="">-- Seleccionar --</option>`;
    depsDisponibles.forEach(d => {
        let obj = espaciosNivel.find(r => r.dep == d);
        selDep.innerHTML += `<option value="${d}">${d} - ${(obj?.tipologia||'twin').toUpperCase()}</option>`;
    });
    onModalDepChange();
}

function onModalDepChange() {
    let depSel = document.getElementById('inpDepModal').value;
    let espaciosDep = residentesData.filter(r => r.dep == depSel);
    if (espaciosDep.length > 0) document.getElementById('inpTipologiaModal').value = espaciosDep[0].tipologia || 'twin';

    let recamarasLibres = [];
    espaciosDep.forEach(r => { if (estaEspacioDesocupado(r) && r.recamara && !recamarasLibres.includes(r.recamara)) recamarasLibres.push(r.recamara); });

    let selRec = document.getElementById('inpRecamaraModal');
    selRec.innerHTML = '';
    recamarasLibres.sort().forEach(rec => { selRec.innerHTML += `<option value="${rec}">${rec}</option>`; });
    onModalRecamaraChange();
}

function onModalRecamaraChange() {
    let depSel = document.getElementById('inpDepModal').value, recSel = document.getElementById('inpRecamaraModal').value;
    let camasLibres = [];
    residentesData.filter(r => r.dep == depSel && r.recamara === recSel).forEach(r => {
        if (estaEspacioDesocupado(r) && r.cama && !camasLibres.includes(String(r.cama))) camasLibres.push(String(r.cama));
    });

    let selCama = document.getElementById('inpCamaModal');
    selCama.innerHTML = '';
    camasLibres.sort().forEach(c => { selCama.innerHTML += `<option value="${c}">${c}</option>`; });
    actualizarNomenclaturaModal();
}

function actualizarNomenclaturaModal() {
    let dep = document.getElementById('inpDepModal').value || '101';
    let rec = document.getElementById('inpRecamaraModal').value || 'A';
    let cama = document.getElementById('inpCamaModal').value || '1';
    document.getElementById('inpNomenclaturaModal').value = `${dep}-${rec}${cama}`;
}

function recalcularFechasContrato() {
    let hoy = new Date();
    let yyyy = hoy.getFullYear(), mm = String(hoy.getMonth() + 1).padStart(2, '0'), dd = String(hoy.getDate()).padStart(2, '0');
    document.getElementById('inpMoveInModal').value = `${yyyy}-${mm}-${dd}`;

    let tipo = document.getElementById('inpTipoContrato').value;
    let fin = new Date(hoy);
    if (tipo === '12 meses') fin.setFullYear(fin.getFullYear() + 1);
    else fin.setMonth(fin.getMonth() + 6);
    document.getElementById('inpMoveOutModal').value = `${fin.getFullYear()}-${String(fin.getMonth() + 1).padStart(2, '0')}-${String(fin.getDate()).padStart(2, '0')}`;
}

function abrirModalCrear() {
    document.getElementById('modalTitulo').innerText = 'Nuevo Registro';
    document.getElementById('editIndex').value = '-1';
    document.getElementById('btnGuardarModal').innerText = 'Guardar Residente';
    
    document.getElementById('colTieneCarro').style.display = 'block';

    document.getElementById('tabHeaderContrato').style.display = 'block';
    document.getElementById('rowPreguntaCambioContrato').style.display = 'none';
    
    document.getElementById('seccionAsignacionUnidadDirecta').style.display = 'block';
    document.getElementById('bloqueCambioUnidadEdicion').style.display = 'none';

    document.getElementById('inpMoveInModal').readOnly = false;
    document.getElementById('inpMoveOutModal').readOnly = false;
    document.getElementById('inpMoveInModal').style.cursor = 'default';
    document.getElementById('inpMoveOutModal').style.cursor = 'default';

    document.getElementById('inpNombre').value = '';
    document.getElementById('inpApellidos').value = '';
    document.getElementById('inpTelefono').value = '';
    document.getElementById('inpCorreo').value = '';
    document.getElementById('inpTieneCarro').value = 'NO';
    evaluarTieneCarro();

    prepararCatalogosModal();
    document.getElementById('inpRenta').value = '10200';
    document.getElementById('inpTipoContrato').value = '12 meses';
    recalcularFechasContrato();
    actualizarNomenclaturaModal();

    cambiarPestana('tab-personales', document.querySelectorAll('.tab-item')[0]);
    document.getElementById('modalOverlay').style.display = 'flex';
}

function editarResidente(index) {
    let res = residentesFiltradosMemoria[index];
    
    document.getElementById('modalTitulo').innerText = `Editar Expediente: ${res.nombre}`;
    document.getElementById('editIndex').value = index;
    document.getElementById('btnGuardarModal').innerText = 'Guardar Cambios';

    document.getElementById('colTieneCarro').style.display = 'none';
    document.getElementById('rowDeseaRegistrarAuto').style.display = 'none';
    document.getElementById('tabHeaderAsignaciones').style.display = 'none';

    document.getElementById('rowPreguntaCambioContrato').style.display = 'block';
    document.getElementById('inpCambiaContrato').value = 'NO';
    document.getElementById('tabHeaderContrato').style.display = 'none';

    document.getElementById('seccionAsignacionUnidadDirecta').style.display = 'none';
    document.getElementById('bloqueCambioUnidadEdicion').style.display = 'block';
    document.getElementById('inpCambiaUnidad').value = 'NO';
    evaluarCambioUnidad();

    document.getElementById('inpMoveInModal').readOnly = true;
    document.getElementById('inpMoveOutModal').readOnly = true;
    document.getElementById('inpMoveInModal').style.cursor = 'not-allowed';
    document.getElementById('inpMoveOutModal').style.cursor = 'not-allowed';

    let partes = (res.nombre || '').split(' ');
    document.getElementById('inpNombre').value = partes[0] || '';
    document.getElementById('inpApellidos').value = partes.slice(1).join(' ') || '';
    document.getElementById('inpGenero').value = res.genero || 'Masculino';
    document.getElementById('inpTelefono').value = res.telefono || '';
    document.getElementById('inpCorreo').value = res.correo || '';
    document.getElementById('inpRenta').value = res.renta || '';

    window.residenteEnEdicion = res;
    cambiarPestana('tab-personales', document.querySelectorAll('.tab-item')[0]);
    document.getElementById('modalOverlay').style.display = 'flex';
}

function evaluarCambioContrato() {
    let cambia = document.getElementById('inpCambiaContrato').value;
    let tabContrato = document.getElementById('tabHeaderContrato');
    
    if (cambia === 'SI') {
        tabContrato.style.display = 'block';
        cambiarPestana('tab-contrato', tabContrato);
    } else {
        tabContrato.style.display = 'none';
        cambiarPestana('tab-personales', document.querySelectorAll('.tab-item')[0]);
        document.getElementById('inpCambiaUnidad').value = 'NO';
        evaluarCambioUnidad();
    }
}

function evaluarCambioUnidad() {
    let cambiaUnidad = document.getElementById('inpCambiaUnidad').value;
    let seccionDirecta = document.getElementById('seccionAsignacionUnidadDirecta');
    let groupMotivo = document.getElementById('groupMotivoCambio');
    
    if (cambiaUnidad === 'SI') {
        seccionDirecta.style.display = 'block';
        groupMotivo.style.display = 'block';
        prepararCatalogosModal();
    } else {
        seccionDirecta.style.display = 'none';
        groupMotivo.style.display = 'none';
        document.getElementById('inpMotivoCambioUnidad').value = '';
    }
}

function cerrarModal() { document.getElementById('modalOverlay').style.display = 'none'; }

async function guardarResidente() {
    let indexEdit = document.getElementById('editIndex').value;
    let esEdicion = indexEdit !== '-1';
    let cambiaContrato = esEdicion ? document.getElementById('inpCambiaContrato').value === 'SI' : true;
    let cambiaUnidad = esEdicion && cambiaContrato && document.getElementById('inpCambiaUnidad').value === 'SI';
    let motivoCambio = document.getElementById('inpMotivoCambioUnidad').value.trim();

    if (esEdicion && cambiaUnidad && !motivoCambio) {
        mostrarNotificacion('Debes ingresar el motivo de cambio de unidad para continuar.', 'error');
        document.getElementById('inpMotivoCambioUnidad').focus();
        return;
    }

    if (esEdicion && cambiaUnidad) {
        let resOriginal = window.residenteEnEdicion;
        let payloadCambio = {
            nomenclatura_anterior: resOriginal.nomenclatura,
            nomenclatura_nueva: document.getElementById('inpNomenclaturaModal').value,
            residente: resOriginal.nombre,
            motivo_cambio: motivoCambio,
            dep_nuevo: document.getElementById('inpDepModal').value,
            recamara_nueva: document.getElementById('inpRecamaraModal').value + document.getElementById('inpCamaModal').value,
            cambia_contrato: 'SI',
            renta_nueva: parseFloat(document.getElementById('inpRenta').value) || resOriginal.renta
        };

        try {
            let res = await fetch('api_cambio_unidad.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payloadCambio) });
            let result = await res.json();
            if (result.status === 'success') {
                mostrarNotificacion('Cambios y unidad actualizados con éxito.', 'success');
                await cargarResidentesDesdeBD();
                cerrarModal();
            } else { mostrarNotificacion('Error: ' + result.message, 'error'); }
        } catch (e) { mostrarNotificacion('Fallo al procesar el cambio de unidad.', 'error'); }
        return;
    }

    let nombre = document.getElementById('inpNombre').value.trim();
    let apellidos = document.getElementById('inpApellidos').value.trim();
    if (!nombre || !apellidos) { mostrarNotificacion('Por favor completa el nombre y apellidos.', 'error'); return; }

    let payload = {
        nombre_completo: `${nombre} ${apellidos}`,
        genero: document.getElementById('inpGenero').value,
        telefono: document.getElementById('inpTelefono').value.trim(),
        correo: document.getElementById('inpCorreo').value.trim(),
        tiene_carro: document.getElementById('inpTieneCarro').value === 'SI' ? 'Si' : 'No',
        desea_registrar_auto: document.getElementById('inpDeseaRegistrarAuto').value,
        dep: document.getElementById('inpDepModal').value || '101',
        recamara: (document.getElementById('inpRecamaraModal').value || 'A') + (document.getElementById('inpCamaModal').value || '1'),
        cama: document.getElementById('inpCamaModal').value || '1',
        nomenclatura: document.getElementById('inpNomenclaturaModal').value,
        tipologia: document.getElementById('inpTipologiaModal').value || 'twin',
        renta: parseFloat(document.getElementById('inpRenta').value) || 0,
        fecha_move_in: document.getElementById('inpMoveInModal').value,
        fecha_move_out: document.getElementById('inpMoveOutModal').value,
        cajon: document.getElementById('inpCajonModal').value || null,
        modelo_auto: document.getElementById('inpModeloAuto')?.value.trim() || '',
        color_auto: document.getElementById('inpColorAuto')?.value.trim() || '',
        numero_tag: document.getElementById('inpNumeroTag')?.value.trim() || '',
        placas: document.getElementById('inpPlacasModal')?.value.trim() || ''
    };

    try {
        let response = await fetch('api_guardar_residente.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        let resultado = await response.json();
        if (resultado.status === 'success') {
            mostrarNotificacion(esEdicion ? 'Cambios guardados correctamente' : 'Residente registrado correctamente', 'success');
            await cargarResidentesDesdeBD();
            cerrarModal();
        } else { mostrarNotificacion('Error en la base de datos: ' + resultado.message, 'error'); }
    } catch (error) { mostrarNotificacion('Error crítico: Falló la conexión con el servidor.', 'error'); }
}

function procesarSalidaSeleccionados() {
    let checkboxes = document.getElementById('tablaBody').querySelectorAll('.row-checkbox:checked');
    
    if (checkboxes.length === 0) { 
        mostrarNotificacion('Selecciona al menos una casilla de la tabla para registrar la salida.', 'error'); 
        return; 
    }

    nomenclaturasAEliminarGlobal = [];
    let contenedor = document.getElementById('moveoutDetallesContenedor');
    contenedor.innerHTML = '';
    document.getElementById('inpMotivoMoveOut').value = '';

    checkboxes.forEach(cb => {
        let index = parseInt(cb.value);
        let res = residentesFiltradosMemoria[index];

        if (res && res.nomenclatura) {
            nomenclaturasAEliminarGlobal.push(res.nomenclatura);

            let recamaraLetra = res.recamara || (res.nomenclatura ? res.nomenclatura.split('-')[1]?.charAt(0) : 'N/A');
            let camaNum = res.cama || (res.nomenclatura ? res.nomenclatura.replace(/.*[A-Z]/, '') : 'N/A');

            let cardHtml = `
                <div style="background-color: var(--bg-main); border: 1px solid var(--border-color); border-radius: 10px; padding: 18px 20px; font-size: 0.92rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; border-bottom: 1px dashed var(--border-color); padding-bottom: 10px;">
                        <strong style="font-size: 1.1rem; color: var(--text-primary);">${res.nombre}</strong>
                        <span style="background: #6366f1; color: #fff; padding: 4px 10px; border-radius: 6px; font-weight: bold; font-size: 0.85rem;">
                            ${res.nomenclatura || 'N/A'}
                        </span>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 12px 24px; color: var(--text-primary); line-height: 1.6;">
                        <div style="display: flex; flex-direction: column; gap: 6px;">
                            <p style="margin: 0;"><strong>📞 Teléfono:</strong> ${res.telefono || 'No registrado'}</p>
                            <p style="margin: 0;"><strong>✉️ Correo:</strong> ${res.correo || 'No registrado'}</p>
                            <p style="margin: 0;"><strong>📍 Ubicación:</strong> Nivel ${res.nivel || 'N/A'} - Dep. ${res.dep || 'N/A'}</p>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 6px;">
                            <p style="margin: 0;"><strong>🛏️ Recámara / Cama:</strong> Recámara ${recamaraLetra} - Cama ${camaNum}</p>
                            <p style="margin: 0;"><strong>💵 Renta:</strong> $${parseFloat(res.renta || 0).toLocaleString('es-MX')} MXN</p>
                            <p style="margin: 0;"><strong>📅 Fecha Move-In:</strong> ${res.fecha_move_in || 'N/A'}</p>
                        </div>
                    </div>
                </div>
            `;
            contenedor.innerHTML += cardHtml;
        }
    });

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
        let response = await fetch('api_move_out.php', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ registros: registrosSalida }) 
        });
        
        let resultado = await response.json();

        if (resultado.status === 'success') {
            cerrarModalMoveOut();
            mostrarNotificacion('Salida del residente registrada correctamente', 'success');
            let masterCheckbox = document.getElementById('selectAll');
            if (masterCheckbox) masterCheckbox.checked = false;
            await cargarResidentesDesdeBD();
        } else { 
            mostrarNotificacion('Error al procesar salida: ' + resultado.message, 'error'); 
        }
    } catch (error) { 
        mostrarNotificacion('Error crítico: Falló la conexión con el servidor.', 'error'); 
    }
}

function cambiarPestana(idContenido, el) {
    document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    document.getElementById(idContenido).classList.add('active');
}

function toggleSelectAll(master) { document.querySelectorAll('.row-checkbox').forEach(cb => cb.checked = master.checked); }

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
    cargarResidentesDesdeBD();
};