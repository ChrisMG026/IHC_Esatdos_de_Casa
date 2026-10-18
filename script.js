let residentesData = [
    { id: 1, nivel: "PB", dep: "101", tipologia: "twin", nomenclatura: "101-A1", nombre: "Ana García López", vencimiento: "2026-11-15", status: "Vence pronto", cajon: "B12", placas: "XYZ-1234" },
    { id: 2, nivel: "PB", dep: "102", tipologia: "party", nomenclatura: "102-A1", nombre: "Carlos Mendoza Ruiz", vencimiento: "2027-03-20", status: "Vigente", cajon: "A05", placas: "ABC-9876" },
    { id: 3, nivel: "N2", dep: "201", tipologia: "twin", nomenclatura: "201-A1", nombre: "Juan Pérez Martínez", vencimiento: "2026-12-10", status: "Por vencer", cajon: "C01", placas: "LMN-4567" },
    { id: 4, nivel: "N2", dep: "202", tipologia: "party", nomenclatura: "202-A1", nombre: "Mariana Torres Silva", vencimiento: "2027-05-18", status: "Vigente", cajon: "B04", placas: "JHG-3321" },
    { id: 5, nivel: "N3", dep: "301", tipologia: "twin", nomenclatura: "301-A1", nombre: "Luis Fernando Gómez", vencimiento: "2026-10-30", status: "Vence pronto", cajon: "D10", placas: "PQR-1122" },
    { id: 6, nivel: "N3", dep: "302", tipologia: "party double", nomenclatura: "302-A1", nombre: "Sofía Hernández Cruz", vencimiento: "2027-08-01", status: "Vigente", cajon: "A12", placas: "STU-8899" },
    { id: 7, nivel: "N4", dep: "401", tipologia: "twin", nomenclatura: "401-A1", nombre: "Diego Ramírez Vega", vencimiento: "2027-01-15", status: "Vigente", cajon: "B08", placas: "VWX-5544" },
    { id: 8, nivel: "N4", dep: "402", tipologia: "party double", nomenclatura: "402-A1", nombre: "Valeria Morales Castro", vencimiento: "2026-11-28", status: "Por vencer", cajon: "C15", placas: "YZA-7711" },
    { id: 9, nivel: "N5", dep: "501", tipologia: "twin", nomenclatura: "501-B1", nombre: "Mateo Delgado Ortiz", vencimiento: "2027-06-10", status: "Vigente", cajon: "A02", placas: "BCD-9900" },
    { id: 10, nivel: "N5", dep: "502", tipologia: "party double", nomenclatura: "502-A1", nombre: "Camila Castillo Navarro", vencimiento: "2026-12-05", status: "Por vencer", cajon: "E04", placas: "EFG-3344" }
];

function inicializarFiltros() {
    let niveles = [...new Set(residentesData.map(item => item.nivel))];
    let deps = [...new Set(residentesData.map(item => item.dep))];
    let nomenclaturas = [...new Set(residentesData.map(item => item.nomenclatura))];
    let tipologias = [...new Set(residentesData.map(item => item.tipologia))];

    poblarSelect('filterNivel', niveles, 'Nivel ');
    poblarSelect('filterDep', deps, 'No. Dep ');
    poblarSelect('filterNomenclatura', nomenclaturas, 'Nomenclatura ');
    poblarSelect('filterTipologia', tipologias, 'Tipología ');
}

function poblarSelect(id, opciones, tituloDefault) {
    let select = document.getElementById(id);
    select.innerHTML = `<option value="">${tituloDefault}</option>`;
    opciones.sort().forEach(op => {
        select.innerHTML += `<option value="${op}">${op}</option>`;
    });
}

function aplicarFiltros() {
    let query = document.getElementById('searchInput').value.toLowerCase();
    let valNivel = document.getElementById('filterNivel').value;
    let valDep = document.getElementById('filterDep').value;
    let valNom = document.getElementById('filterNomenclatura').value;
    let valTipo = document.getElementById('filterTipologia').value;

    let filtrados = residentesData.filter(item => {
        let matchQuery = item.nombre.toLowerCase().includes(query) || item.nomenclatura.toLowerCase().includes(query);
        let matchNivel = !valNivel || item.nivel === valNivel;
        let matchDep = !valDep || item.dep === valDep;
        let matchNom = !valNom || item.nomenclatura === valNom;
        let matchTipo = !valTipo || item.tipologia === valTipo;

        return matchQuery && matchNivel && matchDep && matchNom && matchTipo;
    });

    renderTabla(filtrados);
}

function renderTabla(datos = residentesData) {
    let tbody = document.getElementById('tablaBody');
    tbody.innerHTML = '';

    datos.forEach((item, index) => {
        let badgeDateClass = item.status === 'Vence pronto' ? 'bg-red' : (item.status === 'Por vencer' ? 'bg-yellow' : 'bg-green');
        let badgeStatusClass = item.status === 'Vence pronto' ? 'status-red' : (item.status === 'Por vencer' ? 'status-yellow' : 'status-green');

        let row = `
            <tr>
                <td><input type="checkbox" class="row-checkbox" value="${index}"></td>
                <td><strong>${item.nombre}</strong></td>
                <td>${item.nivel}</td>
                <td>Dep. ${item.dep}</td>
                <td><span style="font-weight:700; color:#4f46e5;">${item.nomenclatura}</span></td>
                <td><span style="font-size:0.8rem; background:#f1f5f9; padding:2px 6px; border-radius:4px;">${item.tipologia}</span></td>
                <td><span class="badge-date ${badgeDateClass}">${item.vencimiento}</span></td>
                <td>${item.cajon}</td>
                <td><span class="badge-status ${badgeStatusClass}">${item.status}</span></td>
                <td>
                    <button class="btn-table" onclick="editarResidente(${index})">✏️ Editar</button>
                    <button class="btn-table btn-delete" onclick="eliminarResidente(${index})">Move-out</button>
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

/* --- FUNCIONALIDAD: NUEVO REGISTRO (MOVE-IN) --- */
function abrirModalCrear() {
    document.getElementById('modalTitulo').innerText = 'Nuevo Registro (Move-in)';
    document.getElementById('editIndex').value = '-1';
    
    document.getElementById('inpNombre').value = '';
    document.getElementById('inpApellidos').value = '';
    document.getElementById('inpNivel').value = 'PB';
    document.getElementById('inpDep').value = '103';
    document.getElementById('inpNomenclatura').value = '103-A1';
    document.getElementById('inpTipologia').value = 'twin';
    document.getElementById('inpVencimiento').value = '2027-06-30';
    document.getElementById('inpEstado').value = 'Vigente';
    document.getElementById('inpCajon').value = 'B01';
    document.getElementById('inpPlacas').value = 'ABC-1234';

    document.getElementById('modalOverlay').style.display = 'flex';
}

/* --- FUNCIONALIDAD: EDITAR REGISTRO --- */
function editarResidente(index) {
    let res = residentesData[index];
    document.getElementById('modalTitulo').innerText = `Editar Expediente: ${res.nombre}`;
    document.getElementById('editIndex').value = index;

    let partes = res.nombre.split(' ');
    document.getElementById('inpNombre').value = partes[0] || '';
    document.getElementById('inpApellidos').value = partes.slice(1).join(' ') || '';
    document.getElementById('inpNivel').value = res.nivel;
    document.getElementById('inpDep').value = res.dep;
    document.getElementById('inpNomenclatura').value = res.nomenclatura;
    document.getElementById('inpTipologia').value = res.tipologia;
    document.getElementById('inpVencimiento').value = res.vencimiento;
    document.getElementById('inpEstado').value = res.status;
    document.getElementById('inpCajon').value = res.cajon;
    document.getElementById('inpPlacas').value = res.placas;

    document.getElementById('modalOverlay').style.display = 'flex';
}

/* --- GUARDAR RESIDENTE (ALTA O EDICIÓN) --- */
function guardarResidente() {
    let index = parseInt(document.getElementById('editIndex').value);
    let nombre = document.getElementById('inpNombre').value.trim();
    let apellidos = document.getElementById('inpApellidos').value.trim();
    let nombreCompleto = `${nombre} ${apellidos}`.trim();

    if (!nombreCompleto) {
        alert('Ingresa el nombre del residente.');
        return;
    }

    let nuevoResidente = {
        id: index >= 0 ? residentesData[index].id : Date.now(),
        nombre: nombreCompleto,
        nivel: document.getElementById('inpNivel').value || 'PB',
        dep: document.getElementById('inpDep').value || '101',
        nomenclatura: document.getElementById('inpNomenclatura').value || '101-A1',
        tipologia: document.getElementById('inpTipologia').value,
        vencimiento: document.getElementById('inpVencimiento').value || '2027-12-31',
        status: document.getElementById('inpEstado').value,
        cajon: document.getElementById('inpCajon').value || 'Sin asignar',
        placas: document.getElementById('inpPlacas').value || 'N/A'
    };

    if (index >= 0) {
        residentesData[index] = nuevoResidente;
    } else {
        residentesData.unshift(nuevoResidente);
    }

    cerrarModal();
    inicializarFiltros();
    aplicarFiltros();
}

/* --- FUNCIONALIDAD: REGISTRAR SALIDA (MOVE-OUT) POR BOTÓN PRINCIPAL --- */
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

/* --- SALIDA INDIVIDUAL POR FILA --- */
function eliminarResidente(index) {
    let res = residentesData[index];
    if (confirm(`¿Registrar salida (Move-out) de "${res.nombre}" del departamento ${res.dep}?`)) {
        residentesData.splice(index, 1);
        inicializarFiltros();
        aplicarFiltros();
    }
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

window.onload = function() {
    inicializarFiltros();
    renderTabla();
};