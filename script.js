let residentesData = [];

// 1. CARGAR DATOS DESDE LA BASE DE DATOS
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
    } catch (error) {
        console.error("Error al conectar con la base de datos:", error);
    }
}

// 2. CÁLCULO DE ESTADO DEL CONTRATO
function calcularEstadoContrato(fechaMoveOut) {
    if (!fechaMoveOut) return "Sin Contrato";
    
    let hoy = new Date();
    let salida = new Date(fechaMoveOut);
    let diffDias = Math.ceil((salida - hoy) / (1000 * 60 * 60 * 24));

    if (diffDias < 0) return "Vencido";
    if (diffDias <= 30) return "Vence pronto";
    if (diffDias <= 90) return "Por vencer";
    return "Vigente";
}

// 3. CÁLCULO DE TIEMPO RESTANTE
function calcularTiempoRestante(fechaMoveOut) {
    if (!fechaMoveOut) return "N/A";
    let hoy = new Date();
    let fin = new Date(fechaMoveOut);
    
    if (fin < hoy) return "Contrato finalizado";

    let meses = (fin.getFullYear() - hoy.getFullYear()) * 12 + (fin.getMonth() - hoy.getMonth());
    let dias = fin.getDate() - hoy.getDate();

    if (dias < 0) {
        meses--;
        let ultimoDiaMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth(), 0).getDate();
        dias += ultimoDiaMesAnterior;
    }

    return `${meses} meses y ${dias} días restantes`;
}

// ORDENAR NIVELES (PB PRIMERO, LUEGO N1, N2... N12)
function ordenarNiveles(niveles) {
    return niveles.sort((a, b) => {
        let strA = String(a).trim().toUpperCase();
        let strB = String(b).trim().toUpperCase();

        if (strA === 'PB') return -1;
        if (strB === 'PB') return 1;

        let numA = parseInt(strA.replace(/\D/g, '')) || 0;
        let numB = parseInt(strB.replace(/\D/g, '')) || 0;

        return numA - numB;
    });
}

// 4. FILTROS TABLA PRINCIPAL
function actualizarOpcionesFiltros() {
    let residentesAsignados = residentesData.filter(r => r.nombre && r.nombre.trim() !== '');

    let query = document.getElementById('searchInput').value.toLowerCase();
    let valNivel = document.getElementById('filterNivel').value;
    let valDep = document.getElementById('filterDep').value;
    let valEstado = document.getElementById('filterEstado').value;
    let valTipo = document.getElementById('filterTipologia').value;

    let baseNiveles = residentesAsignados.filter(item => matchFiltrosExcepto(item, 'nivel', query, valNivel, valDep, valEstado, valTipo));
    let baseDeps = residentesAsignados.filter(item => matchFiltrosExcepto(item, 'dep', query, valNivel, valDep, valEstado, valTipo));
    let baseEstados = residentesAsignados.filter(item => matchFiltrosExcepto(item, 'estado', query, valNivel, valDep, valEstado, valTipo));
    let baseTipos = residentesAsignados.filter(item => matchFiltrosExcepto(item, 'tipologia', query, valNivel, valDep, valEstado, valTipo));

    let nivelesDisponibles = ordenarNiveles([...new Set(baseNiveles.map(item => item.nivel).filter(Boolean))]);
    let depsDisponibles = [...new Set(baseDeps.map(item => item.dep).filter(Boolean))].sort((a, b) => (parseInt(a) || 0) - (parseInt(b) || 0));
    let estadosDisponibles = [...new Set(baseEstados.map(item => item.status).filter(Boolean))].sort();
    let tipologiasDisponibles = [...new Set(baseTipos.map(item => item.tipologia).filter(Boolean))].sort();

    poblarSelectMantenimiento('filterNivel', nivelesDisponibles, 'Nivel', valNivel);
    poblarSelectMantenimiento('filterDep', depsDisponibles, 'No. Dep', valDep);
    poblarSelectMantenimiento('filterEstado', estadosDisponibles, 'Estado', valEstado);
    poblarSelectMantenimiento('filterTipologia', tipologiasDisponibles, 'Tipología', valTipo);
}

function matchFiltrosExcepto(item, omitir, query, valNivel, valDep, valEstado, valTipo) {
    let matchQuery = !query || (item.nombre && item.nombre.toLowerCase().includes(query)) || (item.nomenclatura && item.nomenclatura.toLowerCase().includes(query));
    let matchNivel = omitir === 'nivel' || !valNivel || item.nivel === valNivel;
    let matchDep = omitir === 'dep' || !valDep || item.dep == valDep;
    let matchEstado = omitir === 'estado' || !valEstado || item.status === valEstado;
    let matchTipo = omitir === 'tipologia' || !valTipo || item.tipologia === valTipo;

    return matchQuery && matchNivel && matchDep && matchEstado && matchTipo;
}

function poblarSelectMantenimiento(id, opciones, tituloDefault, valorActual) {
    let select = document.getElementById(id);
    if (!select) return;

    select.innerHTML = `<option value="">${tituloDefault}</option>`;
    opciones.forEach(op => {
        let selected = (op == valorActual) ? 'selected' : '';
        select.innerHTML += `<option value="${op}" ${selected}>${op}</option>`;
    });

    if (valorActual && !opciones.includes(valorActual) && !opciones.map(String).includes(String(valorActual))) {
        select.value = "";
    }
}

function aplicarFiltros() {
    actualizarOpcionesFiltros();

    let query = document.getElementById('searchInput').value.toLowerCase();
    let valNivel = document.getElementById('filterNivel').value;
    let valDep = document.getElementById('filterDep').value;
    let valEstado = document.getElementById('filterEstado').value;
    let valTipo = document.getElementById('filterTipologia').value;

    let residentesAsignados = residentesData.filter(r => r.nombre && r.nombre.trim() !== '');

    let filtrados = residentesAsignados.filter(item => {
        let matchQuery = !query || (item.nombre && item.nombre.toLowerCase().includes(query)) || (item.nomenclatura && item.nomenclatura.toLowerCase().includes(query));
        let matchNivel = !valNivel || item.nivel === valNivel;
        let matchDep = !valDep || item.dep == valDep;
        let matchEstado = !valEstado || item.status === valEstado;
        let matchTipo = !valTipo || item.tipologia === valTipo;

        return matchQuery && matchNivel && matchDep && matchEstado && matchTipo;
    });

    renderTabla(filtrados);
}

// 5. RENDERIZADO TABLA PRINCIPAL
function renderTabla(datos) {
    let residentesAsignados = datos || residentesData.filter(r => r.nombre && r.nombre.trim() !== '');
    let tbody = document.getElementById('tablaBody');
    tbody.innerHTML = '';

    residentesAsignados.forEach((item, index) => {
        let badgeStatusClass = 'status-green';
        let bgDateClass = 'bg-green';

        if (item.status === 'Vence pronto' || item.status === 'Vencido') {
            badgeStatusClass = 'status-red';
            bgDateClass = 'bg-red';
        } else if (item.status === 'Por vencer') {
            badgeStatusClass = 'status-yellow';
            bgDateClass = 'bg-yellow';
        } else if (item.status === 'Sin Contrato') {
            badgeStatusClass = 'status-green';
            bgDateClass = 'bg-green';
        }

        let row = `
            <tr>
                <td><input type="checkbox" class="row-checkbox" value="${index}"></td>
                <td><strong>${item.nombre}</strong></td>
                <td>${item.genero || 'N/A'}</td>
                <td>${item.nivel || 'N/A'}</td>
                <td>Dep. ${item.dep || 'N/A'}</td>
                <td><span style="font-weight:700; color:#6366f1;">${item.nomenclatura || 'N/A'}</span></td>
                <td>${item.fecha_move_in || 'N/A'}</td>
                <td><span class="badge-date ${bgDateClass}">${item.fecha_move_out || 'N/A'}</span></td>
                <td><span class="badge-status ${badgeStatusClass}">${item.status}</span></td>
                <td>
                    <button class="btn-table btn-details" onclick="verDetalles(${index})">👁️ Ver Detalles</button>
                    <button class="btn-table" onclick="editarResidente(${index})">✏️ Editar</button>
                </td>
            </tr>
        `;
        tbody.innerHTML += row;
    });

    document.getElementById('statTotal').innerText = residentesAsignados.length;
    let vigentes = residentesAsignados.filter(r => r.status === 'Vigente').length;
    document.getElementById('statVigentes').innerText = vigentes;
    document.getElementById('statPorVencer').innerText = residentesAsignados.length - vigentes;
}

// 6. DETALLES
function verDetalles(index) {
    let residentesAsignados = residentesData.filter(r => r.nombre && r.nombre.trim() !== '');
    let res = residentesAsignados[index];
    let claveHabitacion = res.clave_maestra || "1234-KEY";

    let htmlContenido = `
        <div style="display:flex; flex-direction:column; gap:12px;">
            <p><strong>Residente:</strong> ${res.nombre} (${res.genero || 'No especificado'})</p>
            <p><strong>Ubicación:</strong> Nivel ${res.nivel || 'N/A'} - Dep. ${res.dep || 'N/A'} (${res.nomenclatura || 'N/A'})</p>
            <p><strong>Tipología:</strong> ${res.tipologia || 'Sencilla'}</p>
            <p><strong>Monto Renta:</strong> $${parseFloat(res.renta || 0).toLocaleString('es-MX')} MXN</p>
            <hr style="border:none; border-top:1px solid var(--border-color);">
            <p><strong>Periodo Contrato:</strong> ${res.fecha_move_in || 'N/A'} al ${res.fecha_move_out || 'N/A'}</p>
            <p><strong>Tiempo Restante:</strong> <span style="color:#6366f1; font-weight:700;">${res.tiempoRestante}</span></p>
            <p><strong>Estacionamiento:</strong> ${res.cajon ? 'Cajón ' + res.cajon : 'Sin cajón asignado'}</p>
            <hr style="border:none; border-top:1px solid var(--border-color);">
            <div style="background:var(--bg-main); padding:12px; border-radius:8px; display:flex; align-items:center; justify-content:space-between; border:1px solid var(--border-color);">
                <div>
                    <strong style="font-size:0.85rem; color:var(--text-secondary);">Clave Maestra Habitación:</strong><br>
                    <input type="password" id="claveInput" value="${claveHabitacion}" readonly style="border:none; background:transparent; font-size:1.1rem; font-weight:bold; letter-spacing:3px; outline:none; width:130px; color:var(--text-primary);">
                </div>
                <button class="btn-table" onclick="toggleClave()">👁️ Mostrar / Ocultar</button>
            </div>
        </div>
    `;

    document.getElementById('detallesContenido').innerHTML = htmlContenido;
    document.getElementById('modalDetallesOverlay').style.display = 'flex';
}

function toggleClave() {
    let input = document.getElementById('claveInput');
    input.type = input.type === 'password' ? 'text' : 'password';
}

function cerrarModalDetalles() {
    document.getElementById('modalDetallesOverlay').style.display = 'none';
}

// -------------------------------------------------------------
// 7. CONTROL DE DISPONIBILIDAD Y BLOQUEO DE OFICINAS / MUESTRAS
// -------------------------------------------------------------

function estaEspacioDesocupado(item) {
    let dep = String(item.dep || '').trim();
    let nom = String(item.nomenclatura || '').trim().toUpperCase();

    // Bloquear todo el departamento 103 (oficinas / muestra)
    if (dep === '103') return false;

    // Bloquear específicamente la nomenclatura 104-A1
    if (nom === '104-A1') return false;

    // Verificar si ya tiene un residente asignado
    let tieneResidente = item.nombre && item.nombre.trim() !== '';
    return !tieneResidente;
}

function prepararCatalogosModal() {
    let nivelesLibres = residentesData
        .filter(r => estaEspacioDesocupado(r))
        .map(r => r.nivel)
        .filter(Boolean);

    let nivelesUnicos = ordenarNiveles([...new Set(nivelesLibres)]);
    let selNivel = document.getElementById('inpNivelModal');
    selNivel.innerHTML = `<option value="">-- Seleccionar --</option>`;
    nivelesUnicos.forEach(n => {
        selNivel.innerHTML += `<option value="${n}">${n}</option>`;
    });

    let cajonesOcupados = residentesData
        .filter(r => r.nombre && r.nombre.trim() !== '')
        .map(r => r.cajon)
        .filter(Boolean)
        .map(c => String(c).trim().toLowerCase());

    let selCajon = document.getElementById('inpCajonModal');
    selCajon.innerHTML = `<option value="">-- Seleccionar Cajón --</option>`;
    
    for (let i = 1; i <= 40; i++) {
        let nombreCajon = "Cajón " + i;
        let idSimplificado = "cajón " + i;
        
        if (!cajonesOcupados.includes(idSimplificado) && !cajonesOcupados.includes(String(i))) {
            selCajon.innerHTML += `<option value="${nombreCajon}">${nombreCajon}</option>`;
        }
    }
}

function evaluarTieneCarro() {
    let tieneCarro = document.getElementById('inpTieneCarro').value;
    let rowRegistrar = document.getElementById('rowDeseaRegistrarAuto');
    if (tieneCarro === 'SI') {
        rowRegistrar.style.display = 'flex';
    } else {
        rowRegistrar.style.display = 'none';
        document.getElementById('inpDeseaRegistrarAuto').value = 'NO';
        evaluarRegistrarAuto();
    }
}

function evaluarRegistrarAuto() {
    let deseaRegistrar = document.getElementById('inpDeseaRegistrarAuto').value;
    let tabAsignaciones = document.getElementById('tabHeaderAsignaciones');
    if (deseaRegistrar === 'SI') {
        tabAsignaciones.style.display = 'block';
    } else {
        tabAsignaciones.style.display = 'none';
        cambiarPestana('tab-personales', document.querySelectorAll('.tab-item')[0]);
    }
}

function onModalNivelChange() {
    let nivelSel = document.getElementById('inpNivelModal').value;
    let espaciosNivel = residentesData.filter(r => r.nivel === nivelSel);

    let depsDisponibles = espaciosNivel
        .filter(r => estaEspacioDesocupado(r))
        .map(r => r.dep)
        .filter(Boolean);

    let depsUnicos = [...new Set(depsDisponibles)].sort((a,b) => (parseInt(a) || 0) - (parseInt(b) || 0));

    let selDep = document.getElementById('inpDepModal');
    selDep.innerHTML = `<option value="">-- Seleccionar --</option>`;

    depsUnicos.forEach(d => {
        let objDep = espaciosNivel.find(r => r.dep == d);
        let tipo = objDep && objDep.tipologia ? objDep.tipologia.toUpperCase() : 'TWIN';
        selDep.innerHTML += `<option value="${d}">${d} - ${tipo}</option>`;
    });

    document.getElementById('inpTipologiaModal').value = '';
    onModalDepChange();
}

function onModalDepChange() {
    let depSel = document.getElementById('inpDepModal').value;
    let espaciosDep = residentesData.filter(r => r.dep == depSel);

    if (espaciosDep.length > 0) {
        document.getElementById('inpTipologiaModal').value = espaciosDep[0].tipologia || 'twin';
    }

    let recamarasLibres = [];
    espaciosDep.forEach(r => {
        if (estaEspacioDesocupado(r) && r.recamara) {
            if (!recamarasLibres.includes(r.recamara)) {
                recamarasLibres.push(r.recamara);
            }
        }
    });

    let selRec = document.getElementById('inpRecamaraModal');
    selRec.innerHTML = '';
    
    recamarasLibres.sort().forEach(rec => {
        selRec.innerHTML += `<option value="${rec}">${rec}</option>`;
    });

    onModalRecamaraChange();
}

function onModalRecamaraChange() {
    let depSel = document.getElementById('inpDepModal').value;
    let recSel = document.getElementById('inpRecamaraModal').value;

    let espaciosDepRec = residentesData.filter(r => r.dep == depSel && r.recamara === recSel);

    let camasLibres = [];
    espaciosDepRec.forEach(r => {
        if (estaEspacioDesocupado(r) && r.cama) {
            if (!camasLibres.includes(String(r.cama))) {
                camasLibres.push(String(r.cama));
            }
        }
    });

    let selCama = document.getElementById('inpCamaModal');
    selCama.innerHTML = '';

    camasLibres.sort().forEach(cama => {
        selCama.innerHTML += `<option value="${cama}">${cama}</option>`;
    });

    actualizarNomenclaturaModal();
}

function actualizarNomenclaturaModal() {
    let dep = document.getElementById('inpDepModal').value || '101';
    let recamara = document.getElementById('inpRecamaraModal').value || 'A';
    let cama = document.getElementById('inpCamaModal').value || '1';

    let nomenclaturaCalculada = `${dep}-${recamara}${cama}`;
    document.getElementById('inpNomenclaturaModal').value = nomenclaturaCalculada;
}

function recalcularFechasContrato() {
    let hoy = new Date();
    let yyyy = hoy.getFullYear();
    let mm = String(hoy.getMonth() + 1).padStart(2, '0');
    let dd = String(hoy.getDate()).padStart(2, '0');
    let fechaHoyStr = `${yyyy}-${mm}-${dd}`;

    document.getElementById('inpMoveInModal').value = fechaHoyStr;

    let tipoContrato = document.getElementById('inpTipoContrato').value;
    let fechaFin = new Date(hoy);
    if (tipoContrato === '12 meses') {
        fechaFin.setFullYear(fechaFin.getFullYear() + 1);
    } else {
        fechaFin.setMonth(fechaFin.getMonth() + 6);
    }

    let yyyyFin = fechaFin.getFullYear();
    let mmFin = String(fechaFin.getMonth() + 1).padStart(2, '0');
    let ddFin = String(fechaFin.getDate()).padStart(2, '0');

    document.getElementById('inpMoveOutModal').value = `${yyyyFin}-${mmFin}-${ddFin}`;
}

function abrirModalCrear() {
    document.getElementById('modalTitulo').innerText = 'Nuevo Registro';
    document.getElementById('editIndex').value = '-1';
    
    document.getElementById('inpNombre').value = '';
    document.getElementById('inpApellidos').value = '';
    document.getElementById('inpGenero').value = 'Masculino';
    document.getElementById('inpTelefono').value = '';
    document.getElementById('inpCorreo').value = '';
    document.getElementById('inpTieneCarro').value = 'NO';
    document.getElementById('inpDeseaRegistrarAuto').value = 'NO';
    evaluarTieneCarro();

    prepararCatalogosModal();
    document.getElementById('inpNivelModal').value = '';
    document.getElementById('inpDepModal').innerHTML = '<option value="">-- Seleccionar --</option>';
    document.getElementById('inpRenta').value = '10200';
    document.getElementById('inpTipoContrato').value = '12 meses';
    
    recalcularFechasContrato();
    actualizarNomenclaturaModal();

    cambiarPestana('tab-personales', document.querySelectorAll('.tab-item')[0]);
    document.getElementById('modalOverlay').style.display = 'flex';
}

async function guardarResidente() {
    let nombre = document.getElementById('inpNombre').value.trim();
    let apellidos = document.getElementById('inpApellidos').value.trim();

    if (!nombre || !apellidos) {
        alert('Por favor completa el nombre y apellidos del residente.');
        return;
    }

    let dep = document.getElementById('inpDepModal').value || '101';
    let recamaraVal = (document.getElementById('inpRecamaraModal').value || 'A') + (document.getElementById('inpCamaModal').value || '1');

    let payload = {
        nombre_completo: `${nombre} ${apellidos}`,
        genero: document.getElementById('inpGenero').value,
        telefono: document.getElementById('inpTelefono').value.trim(),
        correo: document.getElementById('inpCorreo').value.trim(),
        tiene_carro: document.getElementById('inpTieneCarro').value === 'SI' ? 'Si' : 'No',
        desea_registrar_auto: document.getElementById('inpDeseaRegistrarAuto').value,
        
        dep: dep,
        recamara: recamaraVal,
        nomenclatura: document.getElementById('inpNomenclaturaModal').value,
        tipologia: document.getElementById('inpTipologiaModal').value || 'twin',
        renta: parseFloat(document.getElementById('inpRenta').value) || 0,
        fecha_move_in: document.getElementById('inpMoveInModal').value,
        fecha_move_out: document.getElementById('inpMoveOutModal').value,

        cajon: document.getElementById('inpCajonModal').value || null,
        modelo_auto: document.getElementById('inpModeloAuto').value.trim(),
        color_auto: document.getElementById('inpColorAuto').value.trim(),
        numero_tag: document.getElementById('inpNumeroTag').value.trim(),
        placas: document.getElementById('inpPlacasModal').value.trim()
    };

    try {
        let response = await fetch('api_guardar_residente.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        let resultado = await response.json();

        if (resultado.status === 'success') {
            alert('¡Registro guardado correctamente en la base de datos!');
            await cargarResidentesDesdeBD();
            cerrarModal();
        } else {
            alert('Error en la base de datos: ' + resultado.message);
        }
    } catch (error) {
        console.error("Error al guardar residente:", error);
        alert("Hubo un fallo de conexión con el servidor backend.");
    }
}

function editarResidente(index) {
    let residentesAsignados = residentesData.filter(r => r.nombre && r.nombre.trim() !== '');
    let res = residentesAsignados[index];
    abrirModalCrear();

    document.getElementById('modalTitulo').innerText = `Editar Expediente: ${res.nombre}`;
    document.getElementById('editIndex').value = index;

    let partes = (res.nombre || '').split(' ');
    document.getElementById('inpNombre').value = partes[0] || '';
    document.getElementById('inpApellidos').value = partes.slice(1).join(' ') || '';
    document.getElementById('inpGenero').value = res.genero || 'Masculino';
    document.getElementById('inpNivelModal').value = res.nivel || '';
    
    onModalNivelChange();
    document.getElementById('inpDepModal').value = res.dep || '';
    onModalDepChange();

    document.getElementById('inpRenta').value = res.renta || '';
    document.getElementById('modalOverlay').style.display = 'flex';
}

function cerrarModal() {
    document.getElementById('modalOverlay').style.display = 'none';
}

function cambiarPestana(idContenido, el) {
    document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    document.getElementById(idContenido).classList.add('active');
}

function toggleSelectAll(master) {
    document.querySelectorAll('.row-checkbox').forEach(cb => cb.checked = master.checked);
}

// Arreglo global temporal para almacenar las nomenclaturas a eliminar durante la confirmación
let nomenclaturasAEliminarGlobal = [];

function procesarSalidaSeleccionados() {
    let residentesAsignados = residentesData.filter(r => r.nombre && r.nombre.trim() !== '');
    let checkboxes = document.getElementById('tablaBody').querySelectorAll('.row-checkbox:checked');
    
    if (checkboxes.length === 0) {
        alert('Selecciona al menos una casilla de la tabla para registrar la salida del residente.');
        return;
    }

    let residentesSeleccionados = [];
    nomenclaturasAEliminarGlobal = [];

    checkboxes.forEach(cb => {
        let index = parseInt(cb.value);
        let res = residentesAsignados[index];
        if (res && res.nomenclatura) {
            residentesSeleccionados.push(res);
            nomenclaturasAEliminarGlobal.push(res.nomenclatura);
        }
    });

    if (residentesSeleccionados.length === 0) {
        alert('No se encontraron nomenclaturas válidas para los registros seleccionados.');
        return;
    }

    // Renderizar la información cargada de la tabla contrato en el modal
    let contenedor = document.getElementById('moveoutDetallesContenedor');
    contenedor.innerHTML = '';

    residentesSeleccionados.forEach(res => {
        let recamaraLetra = res.recamara || (res.nomenclatura ? res.nomenclatura.split('-')[1]?.charAt(0) : 'N/A');
        let camaNum = res.cama || (res.nomenclatura ? res.nomenclatura.replace(/.*[A-Z]/, '') : 'N/A');

        let lineaCajon = (res.cajon && String(res.cajon).trim() !== '') 
            ? `<p style="margin: 0;"><strong>🚗 Estacionamiento:</strong> Cajón ${res.cajon}</p>` 
            : '';

        let cardHtml = `
            <div style="background-color: var(--bg-main); border: 1px solid var(--border-color); border-radius: 10px; padding: 18px 20px; font-size: 0.92rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; border-bottom: 1px dashed var(--border-color); padding-bottom: 10px;">
                    <strong style="font-size: 1.1rem; color: var(--text-primary); letter-spacing: 0.2px;">${res.nombre}</strong>
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
                        ${lineaCajon}
                    </div>
                </div>
            </div>
        `;
        contenedor.innerHTML += cardHtml;
    });

    document.getElementById('modalMoveOutOverlay').style.display = 'flex';
}

function cerrarModalMoveOut() {
    document.getElementById('modalMoveOutOverlay').style.display = 'none';
    nomenclaturasAEliminarGlobal = [];
}

async function ejecutarMoveOutConfirmado() {
    if (nomenclaturasAEliminarGlobal.length === 0) return;

    try {
        let response = await fetch('api_move_out.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ nomenclaturas: nomenclaturasAEliminarGlobal })
        });

        let resultado = await response.json();

        if (resultado.status === 'success') {
            cerrarModalMoveOut();
            alert('¡Salida (Move-out) registrada correctamente en la base de datos!');
            
            let masterCheckbox = document.getElementById('selectAll');
            if (masterCheckbox) masterCheckbox.checked = false;

            // Recargar datos desde la base de datos MySQL
            await cargarResidentesDesdeBD();
        } else {
            alert('Error al procesar salida: ' + resultado.message);
        }
    } catch (error) {
        console.error("Error al procesar Move-out:", error);
        alert("Hubo un fallo de conexión al intentar comunicarse con el servidor.");
    }
}

// 8. LÓGICA MODO OSCURO CON PERSISTENCIA
function toggleDarkMode() {
    let body = document.body;
    body.classList.toggle('dark-mode');

    let esOscuro = body.classList.contains('dark-mode');
    localStorage.setItem('theme', esOscuro ? 'dark' : 'light');

    actualizarBotonTema(esOscuro);
}

function actualizarBotonTema(esOscuro) {
    let icon = document.getElementById('themeIcon');
    let text = document.getElementById('themeText');
    if (icon && text) {
        icon.innerText = esOscuro ? '☀️' : '🌙';
        text.innerText = esOscuro ? 'Modo Claro' : 'Modo Oscuro';
    }
}

function aplicarTemaGuardado() {
    let temaGuardado = localStorage.getItem('theme');
    if (temaGuardado === 'dark') {
        document.body.classList.add('dark-mode');
        actualizarBotonTema(true);
    }
}

// CARGA INICIAL
window.onload = function() {
    aplicarTemaGuardado();
    cargarResidentesDesdeBD();
};