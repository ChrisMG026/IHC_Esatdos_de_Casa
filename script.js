let residentesData = [];

// 1. CARGAR DATOS DESDE LA BASE DE DATOS
async function cargarResidentesDesdeBD() {
    try {
        let response = await fetch('api_residentes.php');
        residentesData = await response.json();
        
        // Calcular estados y tiempo restante dinámicamente por fecha
        residentesData.forEach(item => {
            item.status = calcularEstadoContrato(item.fecha_move_out);
            item.tiempoRestante = calcularTiempoRestante(item.fecha_move_out);
        });

        inicializarFiltros();
        renderTabla();
    } catch (error) {
        console.error("Error al conectar con la base de datos:", error);
    }
}

// 2. CÁLCULO DE ESTADO DEL CONTRATO SEGÚN LA FECHA
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

// 3. CÁLCULO DE TIEMPO RESTANTE EN MESES Y DÍAS
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

// 4. FILTROS DINÁMICOS (CON FILTRO DE ESTADO EN LUGAR DE NOMENCLATURA)
function inicializarFiltros() {
    let niveles = [...new Set(residentesData.map(item => item.nivel).filter(Boolean))];
    let deps = [...new Set(residentesData.map(item => item.dep).filter(Boolean))];
    let estados = [...new Set(residentesData.map(item => item.status).filter(Boolean))];
    let tipologias = [...new Set(residentesData.map(item => item.tipologia).filter(Boolean))];

    poblarSelect('filterNivel', niveles, 'Nivel ');
    poblarSelect('filterDep', deps, 'No. Dep ');
    poblarSelect('filterEstado', estados, 'Estado ');
    poblarSelect('filterTipologia', tipologias, 'Tipología ');
}

function poblarSelect(id, opciones, tituloDefault) {
    let select = document.getElementById(id);
    if (!select) return;
    select.innerHTML = `<option value="">${tituloDefault}</option>`;
    opciones.sort().forEach(op => {
        select.innerHTML += `<option value="${op}">${op}</option>`;
    });
}

function aplicarFiltros() {
    let query = document.getElementById('searchInput').value.toLowerCase();
    let valNivel = document.getElementById('filterNivel').value;
    let valDep = document.getElementById('filterDep').value;
    let valEstado = document.getElementById('filterEstado').value;
    let valTipo = document.getElementById('filterTipologia').value;

    let filtrados = residentesData.filter(item => {
        let matchQuery = (item.nombre && item.nombre.toLowerCase().includes(query)) || 
                         (item.nomenclatura && item.nomenclatura.toLowerCase().includes(query));
        let matchNivel = !valNivel || item.nivel === valNivel;
        let matchDep = !valDep || item.dep == valDep;
        let matchEstado = !valEstado || item.status === valEstado;
        let matchTipo = !valTipo || item.tipologia === valTipo;

        return matchQuery && matchNivel && matchDep && matchEstado && matchTipo;
    });

    renderTabla(filtrados);
}

// 5. RENDERIZADO DE TABLA PRINCIPAL
function renderTabla(datos = residentesData) {
    let tbody = document.getElementById('tablaBody');
    tbody.innerHTML = '';

    datos.forEach((item, index) => {
        let badgeStatusClass = 'status-green';
        let bgDateClass = 'bg-green';

        if (item.status === 'Vence pronto' || item.status === 'Vencido') {
            badgeStatusClass = 'status-red';
            bgDateClass = 'bg-red';
        } else if (item.status === 'Por vencer') {
            badgeStatusClass = 'status-yellow';
            bgDateClass = 'bg-yellow';
        } else if (item.status === 'Sin Contrato') {
            badgeStatusClass = 'status-green'; // o clase neutra según preferencia
            bgDateClass = 'bg-green';
        }

        let row = `
            <tr>
                <td><input type="checkbox" class="row-checkbox" value="${index}"></td>
                <td><strong>${item.nombre}</strong></td>
                <td>${item.genero || 'N/A'}</td>
                <td>${item.nivel || 'N/A'}</td>
                <td>Dep. ${item.dep || 'N/A'}</td>
                <td><span style="font-weight:700; color:#4f46e5;">${item.nomenclatura || 'N/A'}</span></td>
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

    document.getElementById('statTotal').innerText = residentesData.length;
    let vigentes = residentesData.filter(r => r.status === 'Vigente').length;
    document.getElementById('statVigentes').innerText = vigentes;
    document.getElementById('statPorVencer').innerText = residentesData.length - vigentes;
}

// 6. VENTANA FLOTANTE: VER DETALLES COMPLETOS
function verDetalles(index) {
    let res = residentesData[index];
    let claveHabitacion = res.clave_maestra || "1234-KEY";

    let htmlContenido = `
        <div style="display:flex; flex-direction:column; gap:12px;">
            <p><strong>Residente:</strong> ${res.nombre} (${res.genero || 'No especificado'})</p>
            <p><strong>Ubicación:</strong> Nivel ${res.nivel || 'N/A'} - Dep. ${res.dep || 'N/A'} (${res.nomenclatura || 'N/A'})</p>
            <p><strong>Tipología:</strong> ${res.tipologia || 'Sencilla'}</p>
            <p><strong>Monto Renta:</strong> $${parseFloat(res.renta || 0).toLocaleString('es-MX')} MXN</p>
            <hr style="border:none; border-top:1px solid #e2e8f0;">
            <p><strong>Periodo Contrato:</strong> ${res.fecha_move_in || 'N/A'} al ${res.fecha_move_out || 'N/A'}</p>
            <p><strong>Tiempo Restante:</strong> <span style="color:#6366f1; font-weight:700;">${res.tiempoRestante}</span></p>
            <p><strong>Estacionamiento:</strong> ${res.cajon ? 'Cajón ' + res.cajon : 'Sin cajón asignado'}</p>
            <hr style="border:none; border-top:1px solid #e2e8f0;">
            <div style="background:#f8fafc; padding:12px; border-radius:8px; display:flex; align-items:center; justify-content:space-between; border:1px solid #e2e8f0;">
                <div>
                    <strong style="font-size:0.85rem; color:#475569;">Clave Maestra Habitación:</strong><br>
                    <input type="password" id="claveInput" value="${claveHabitacion}" readonly style="border:none; background:transparent; font-size:1.1rem; font-weight:bold; letter-spacing:3px; outline:none; width:130px;">
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

// 7. FUNCIONES DE MODAL CREAR / EDITAR
function abrirModalCrear() {
    document.getElementById('modalTitulo').innerText = 'Nuevo Registro (Move-in)';
    document.getElementById('editIndex').value = '-1';
    
    document.getElementById('inpNombre').value = '';
    document.getElementById('inpApellidos').value = '';
    document.getElementById('inpGenero').value = 'Masculino';
    document.getElementById('inpNivel').value = 'N1';
    document.getElementById('inpDep').value = '101';
    document.getElementById('inpNomenclatura').value = '101-A1';
    document.getElementById('inpTipologia').value = 'twin';
    document.getElementById('inpMoveIn').value = '2026-07-01';
    document.getElementById('inpVencimiento').value = '2027-06-30';
    document.getElementById('inpCajon').value = '';
    document.getElementById('inpPlacas').value = '';

    document.getElementById('modalOverlay').style.display = 'flex';
}

function editarResidente(index) {
    let res = residentesData[index];
    document.getElementById('modalTitulo').innerText = `Editar Expediente: ${res.nombre}`;
    document.getElementById('editIndex').value = index;

    let partes = (res.nombre || '').split(' ');
    document.getElementById('inpNombre').value = partes[0] || '';
    document.getElementById('inpApellidos').value = partes.slice(1).join(' ') || '';
    document.getElementById('inpGenero').value = res.genero || 'Masculino';
    document.getElementById('inpNivel').value = res.nivel || '';
    document.getElementById('inpDep').value = res.dep || '';
    document.getElementById('inpNomenclatura').value = res.nomenclatura || '';
    document.getElementById('inpTipologia').value = res.tipologia || 'twin';
    document.getElementById('inpMoveIn').value = res.fecha_move_in || '';
    document.getElementById('inpVencimiento').value = res.fecha_move_out || '';
    document.getElementById('inpCajon').value = res.cajon || '';

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

function procesarSalidaSeleccionados() {
    let checkboxes = document.querySelectorAll('.row-checkbox:checked');
    if (checkboxes.length === 0) {
        alert('Selecciona al menos una casilla de la tabla para registrar la salida del residente.');
        return;
    }

    if (confirm(`¿Confirmas la salida (Move-out) de los ${checkboxes.length} residentes seleccionados?`)) {
        let indicesAEliminar = Array.from(checkboxes).map(cb => parseInt(cb.value)).sort((a, b) => b - a);
        indicesAEliminar.forEach(idx => residentesData.splice(idx, 1));
        
        document.getElementById('selectAll').checked = false;
        inicializarFiltros();
        aplicarFiltros();
    }
}

// CARGA INICIAL
window.onload = function() {
    cargarResidentesDesdeBD();
};