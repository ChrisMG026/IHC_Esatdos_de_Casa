let llavesData = [];
let departamentosData = [];

let llavesFiltradas = [];
let departamentosFiltrados = [];

let cajonesData = [];
let cajonesFiltrados = [];

let paginaCajones = 1;
let paginaLlaves = 1;
let paginaDepartamentos = 1;
const porPagina = 25;

let depSeleccionadoParaEditar = null;
let departamentoSeleccionadoParaCambio = null;

// Sombra y Toasts nativos del sistema
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

async function cargarDatosConfig() {
    try {
        let response = await fetch('../API/api_configuraciones.php');
        let res = await response.json();

        if (res.status === 'success') {
            llavesData = res.llaves || [];
            departamentosData = res.departamentos || [];
            cajonesData = res.cajones || [];
            
            llavesFiltradas = [...llavesData];
            departamentosFiltrados = [...departamentosData];
            cajonesFiltrados = [...cajonesData];
            
            actualizarOpcionesFiltrosConfig();
            renderTablaLlaves();
            renderTablaDepartamentos();
            renderTablaCajones();
        } else {
            console.error("Error al cargar datos:", res.message);
            mostrarNotificacion("Error al cargar datos: " + res.message, 'error');
        }
    } catch (e) {
        console.error("Error de conexión:", e);
        mostrarNotificacion("Error de conexión con el servidor.", 'error');
    }
}

// Poblar selects de filtros dinámicamente
function actualizarOpcionesFiltrosConfig() {
    let niveles = [...new Set(departamentosData.map(d => d.nivel).filter(Boolean))];
    let tipologias = [...new Set(departamentosData.map(d => d.tipologia).filter(Boolean))].sort();

    poblarSelectConfig('filterNivelConfig', ordenarNivelesConfig(niveles), 'Nivel');
    poblarSelectConfig('filterTipologiaConfig', tipologias, 'Tipología');
}

function poblarSelectConfig(id, opciones, tituloDefault) {
    let select = document.getElementById(id);
    if (!select) return;
    let valorActual = select.value;
    select.innerHTML = `<option value="">${tituloDefault}</option>`;
    opciones.forEach(op => {
        select.innerHTML += `<option value="${op}" ${op == valorActual ? 'selected' : ''}>${op}</option>`;
    });
}

function ordenarNivelesConfig(niveles) {
    return niveles.sort((a, b) => {
        let strA = String(a).trim().toUpperCase(), strB = String(b).trim().toUpperCase();
        if (strA === 'PB') return -1; if (strB === 'PB') return 1;
        return (parseInt(strA.replace(/\D/g, '')) || 0) - (parseInt(strB.replace(/\D/g, '')) || 0);
    });
}

// Filtrar tablas según búsqueda y selects
function aplicarFiltrosConfig() {
    let query = document.getElementById('searchInputConfig').value.toLowerCase().trim();
    let valNivel = document.getElementById('filterNivelConfig').value;
    let valTipologia = document.getElementById('filterTipologiaConfig').value;
    let valEstado = document.getElementById('filterEstadoConfig').value;

    // Filtrar Llaves Maestras
    llavesFiltradas = llavesData.filter(item => {
        let matchQuery = !query || 
            String(item.numero_departamento).toLowerCase().includes(query) || 
            String(item.clave_maestra).toLowerCase().includes(query) ||
            String(item.nivel).toLowerCase().includes(query);
        let matchNivel = !valNivel || item.nivel === valNivel;
        let matchTipologia = !valTipologia || item.tipologia === valTipologia;

        return matchQuery && matchNivel && matchTipologia;
    });

    // Filtrar Departamentos
    departamentosFiltrados = departamentosData.filter(item => {
        let matchQuery = !query || 
            String(item.numero_dep).toLowerCase().includes(query) || 
            String(item.nomenclatura).toLowerCase().includes(query) ||
            String(item.recamara).toLowerCase().includes(query);
        let matchNivel = !valNivel || item.nivel === valNivel;
        let matchTipologia = !valTipologia || item.tipologia === valTipologia;
        let estadoItem = item.estado || 'Disponible';
        let matchEstado = !valEstado || estadoItem === valEstado;

        return matchQuery && matchNivel && matchTipologia && matchEstado;
    });

    // Filtrar Cajones
    cajonesFiltrados = cajonesData.filter(item => {
        let matchQuery = !query || String(item.nombre_cajon).toLowerCase().includes(query);
        let estadoItem = item.estado || 'Disponible';
        let matchEstado = !valEstado || estadoItem === valEstado;
        return matchQuery && matchEstado;
    });
    
    
    paginaCajones = 1;
    paginaLlaves = 1;
    paginaDepartamentos = 1;
    renderTablaLlaves();
    renderTablaDepartamentos();
    renderTablaCajones();
}

// ================= RENDER LLAVES MAESTRAS =================
function renderTablaLlaves() {
    let tbody = document.getElementById('tbodyLlaves');
    if (!tbody) return;

    tbody.innerHTML = '';

    let totalItems = llavesFiltradas.length;
    let totalPaginas = Math.ceil(totalItems / porPagina) || 1;
    if (paginaLlaves > totalPaginas) paginaLlaves = totalPaginas;

    let inicio = (paginaLlaves - 1) * porPagina;
    let fin = inicio + porPagina;
    let datosPagina = llavesFiltradas.slice(inicio, fin);

    if (datosPagina.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color: var(--text-secondary); padding: 20px;">No se encontraron registros.</td></tr>`;
    } else {
        datosPagina.forEach(item => {
            tbody.innerHTML += `
                <tr>
                    <td><strong>${item.numero_departamento}</strong></td>
                    <td>${item.nivel}</td>
                    <td>${item.tipologia}</td>
                    <td>
                        <div style="display: flex; gap: 6px; align-items: center;">
                            <input type="password" id="inpLlave_${item.numero_departamento}" value="${item.clave_maestra || ''}" maxlength="4" oninput="this.value = this.value.replace(/[^0-9]/g, '')" disabled style="padding: 6px 10px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-main); color: var(--text-primary); font-weight:700; width: 100px; opacity: 0.7;">
                            
                            <button type="button" id="btnVer_${item.numero_departamento}" onclick="toggleVerClave('${item.numero_departamento}')" class="btn-table" title="Ver / Ocultar Clave" style="padding: 6px 10px; cursor: pointer;">Mostrar</button>

                            <button id="btnEdit_${item.numero_departamento}" onclick="solicitarPermisoCambio('${item.numero_departamento}')" style="background:#f59e0b; color:white; border:none; padding:6px 10px; border-radius:6px; cursor:pointer; font-weight:600; font-size:0.8rem;">Editar</button>
                            
                            <button id="btnSave_${item.numero_departamento}" onclick="guardarClave('${item.numero_departamento}')" style="display:none; background:#10b981; color:white; border:none; padding:6px 10px; border-radius:6px; cursor:pointer; font-weight:600; font-size:0.8rem;">Guardar</button>
                        </div>
                    </td>
                </tr>
            `;
        });
    }

    renderPaginacionGenerica('pagLlaves', paginaLlaves, totalPaginas, inicio, datosPagina.length, totalItems, (nuevaP) => {
        paginaLlaves = nuevaP;
        renderTablaLlaves();
    });
}

// Función para alternar la visibilidad de la clave maestra
function toggleVerClave(numDep) {
    let input = document.getElementById(`inpLlave_${numDep}`);
    let btnVer = document.getElementById(`btnVer_${numDep}`);
    
    if (input) {
        if (input.type === 'password') {
            input.type = 'text';
            if (btnVer) btnVer.innerText = 'Ocultar'; // Cambia el icono a ocultar
        } else {
            input.type = 'password';
            if (btnVer) btnVer.innerText = 'Mostrar'; // Cambia el icono a ver
        }
    }
}

// ================= RENDER DEPARTAMENTOS =================
function renderTablaDepartamentos() {
    let tbody = document.getElementById('tbodyDepartamentos');
    if (!tbody) return;

    tbody.innerHTML = '';

    let totalItems = departamentosFiltrados.length;
    let totalPaginas = Math.ceil(totalItems / porPagina) || 1;
    if (paginaDepartamentos > totalPaginas) paginaDepartamentos = totalPaginas;

    let inicio = (paginaDepartamentos - 1) * porPagina;
    let fin = inicio + porPagina;
    let datosPagina = departamentosFiltrados.slice(inicio, fin);

    if (datosPagina.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color: var(--text-secondary); padding: 20px;">No se encontraron departamentos registrados.</td></tr>`;
    } else {
        datosPagina.forEach(dep => {
            let esDeshabilitado = dep.estado === 'Deshabilitado';
            let btnText = esDeshabilitado ? '✔️ Habilitar' : '🚫 Deshabilitar';
            let btnClass = esDeshabilitado ? 'btn-enabled' : 'btn-disabled';

            tbody.innerHTML += `
                <tr>
                    <td>${dep.nivel}</td>
                    <td><strong>${dep.numero_dep}</strong></td>
                    <td>${dep.tipologia}</td>
                    <td>${dep.recamara}</td>
                    <td>${dep.cama}</td>
                    <td><strong style="color: #6366f1;">${dep.nomenclatura}</strong></td>
                    <td>${dep.estado || 'Disponible'}</td>
                    <td>
                        <button class="btn-status-toggle ${btnClass}" onclick="toggleEstadoDepartamento('${dep.nomenclatura}', '${dep.estado || 'Disponible'}')">
                            ${btnText}
                        </button>
                    </td>
                </tr>
            `;
        });
    }

    renderPaginacionGenerica('pagDepartamentos', paginaDepartamentos, totalPaginas, inicio, datosPagina.length, totalItems, (nuevaP) => {
        paginaDepartamentos = nuevaP;
        renderTablaDepartamentos();
    });
}


function toggleEstadoDepartamento(nomenclatura, estadoActual) {
    let nuevoEstado = (estadoActual === 'Deshabilitado') ? 'Disponible' : 'Deshabilitado';
    departamentoSeleccionadoParaCambio = { nomenclatura, nuevoEstado };

    let modalTitulo = document.querySelector('#modalRazonDep h3');
    let modalBtnConfirmar = document.getElementById('btnConfirmarRazonDep');

    if (nuevoEstado === 'Deshabilitado') {
        modalTitulo.innerText = '⚠️ Deshabilitar Departamento';
        modalTitulo.style.color = '#ef4444';
        document.getElementById('modalRazonTexto').innerText = `Indique la razón obligatoria por la cual desea deshabilitar el departamento ${nomenclatura}:`;
        if (modalBtnConfirmar) {
            modalBtnConfirmar.innerText = 'Deshabilitar';
            modalBtnConfirmar.style.background = '#ef4444';
        }
    } else {
        modalTitulo.innerText = '✅ Habilitar Departamento';
        modalTitulo.style.color = '#10b981';
        document.getElementById('modalRazonTexto').innerText = `Indique la razón obligatoria por la cual desea volver a habilitar el departamento ${nomenclatura}:`;
        if (modalBtnConfirmar) {
            modalBtnConfirmar.innerText = 'Habilitar';
            modalBtnConfirmar.style.background = '#10b981';
        }
    }

    document.getElementById('inputRazonDep').value = '';
    document.getElementById('modalRazonDep').style.display = 'flex';
}

function cerrarModalRazon() {
    departamentoSeleccionadoParaCambio = null;
    document.getElementById('modalRazonDep').style.display = 'none';
}

function confirmarCambioEstadoDep() {
    let razon = document.getElementById('inputRazonDep').value.trim();
    if (!razon) {
        mostrarNotificacion("Debe escribir obligatoriamente una razón para realizar este cambio de estado.", 'error');
        document.getElementById('inputRazonDep').focus();
        return;
    }

    if (!departamentoSeleccionadoParaCambio) return;

    let { nomenclatura, nuevoEstado } = departamentoSeleccionadoParaCambio;
    cerrarModalRazon();
    actualizarEstadoDepEnBD(nomenclatura, nuevoEstado, razon);
}

async function actualizarEstadoDepEnBD(nomenclatura, nuevoEstado, razon) {
    try {
        let response = await fetch('../API/api_configuraciones.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                accion: 'toggle_estado_dep',
                nomenclatura: nomenclatura,
                estado: nuevoEstado,
                razon: razon
            })
        });

        let res = await response.json();
        if (res.status === 'success') {
            mostrarNotificacion(res.message, 'success');
            cargarDatosConfig();
        } else {
            mostrarNotificacion("Error: " + res.message, 'error');
        }
    } catch (e) {
        mostrarNotificacion("Error de red al intentar actualizar el estado.", 'error');
    }
}

// ================= RENDER CAJONES DE ESTACIONAMIENTO =================
function renderTablaCajones() {
    let tbody = document.getElementById('tbodyCajones');
    if (!tbody) return;

    tbody.innerHTML = '';

    let totalItems = cajonesFiltrados.length;
    let totalPaginas = Math.ceil(totalItems / porPagina) || 1;
    if (paginaCajones > totalPaginas) paginaCajones = totalPaginas;

    let inicio = (paginaCajones - 1) * porPagina;
    let fin = inicio + porPagina;
    let datosPagina = cajonesFiltrados.slice(inicio, fin);

    if (datosPagina.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color: var(--text-secondary); padding: 20px;">No se encontraron cajones registrados.</td></tr>`;
    } else {
        datosPagina.forEach(cajon => {
            let esDeshabilitado = cajon.estado === 'Deshabilitado';
            let btnText = esDeshabilitado ? '✔️ Habilitar' : '🚫 Deshabilitar';
            let btnClass = esDeshabilitado ? 'btn-enabled' : 'btn-disabled';

            tbody.innerHTML += `
                <tr>
                    <td><strong>Cajón ${cajon.nombre_cajon}</strong></td>
                    <td>${cajon.estado || 'Disponible'}</td>
                    <td>
                        <button class="btn-status-toggle ${btnClass}" onclick="toggleEstadoCajon('${cajon.nombre_cajon}', '${cajon.estado || 'Disponible'}')">
                            ${btnText}
                        </button>
                    </td>
                </tr>
            `;
        });
    }

    renderPaginacionGenerica('pagCajones', paginaCajones, totalPaginas, inicio, datosPagina.length, totalItems, (nuevaP) => {
        paginaCajones = nuevaP;
        renderTablaCajones();
    });
}

let cajonSeleccionadoParaCambio = null;

function toggleEstadoCajon(nombreCajon, estadoActual) {
    let nuevoEstado = (estadoActual === 'Deshabilitado') ? 'Disponible' : 'Deshabilitado';
    cajonSeleccionadoParaCambio = { nombreCajon, nuevoEstado };

    let modalTitulo = document.querySelector('#modalRazonDep h3');
    let modalBtnConfirmar = document.getElementById('btnConfirmarRazonDep');

    if (nuevoEstado === 'Deshabilitado') {
        modalTitulo.innerText = '⚠️ Deshabilitar Cajón';
        modalTitulo.style.color = '#ef4444';
        document.getElementById('modalRazonTexto').innerText = `Indique la razón obligatoria por la cual desea deshabilitar el cajón ${nombreCajon}:`;
        if (modalBtnConfirmar) {
            modalBtnConfirmar.innerText = 'Deshabilitar';
            modalBtnConfirmar.style.background = '#ef4444';
        }
    } else {
        modalTitulo.innerText = '✅ Habilitar Cajón';
        modalTitulo.style.color = '#10b981';
        document.getElementById('modalRazonTexto').innerText = `Indique la razón obligatoria por la cual desea volver a habilitar el cajón ${nombreCajon}:`;
        if (modalBtnConfirmar) {
            modalBtnConfirmar.innerText = 'Habilitar';
            modalBtnConfirmar.style.background = '#10b981';
        }
    }

    document.getElementById('inputRazonDep').value = '';
    document.getElementById('modalRazonDep').style.display = 'flex';
    
    // Redirigir la acción del botón del modal temporalmente para cajones
    modalBtnConfirmar.onclick = confirmarCambioEstadoCajon;
}

function confirmarCambioEstadoCajon() {
    let razon = document.getElementById('inputRazonDep').value.trim();
    if (!razon) {
        mostrarNotificacion("Debe escribir obligatoriamente una razón para realizar este cambio de estado.", 'error');
        document.getElementById('inputRazonDep').focus();
        return;
    }

    if (!cajonSeleccionadoParaCambio) return;

    let { nombreCajon, nuevoEstado } = cajonSeleccionadoParaCambio;
    cerrarModalRazon();
    
    // Restaurar el evento original del botón para departamentos por si acaso
    document.getElementById('btnConfirmarRazonDep').onclick = confirmarCambioEstadoDep;
    
    actualizarEstadoCajonEnBD(nombreCajon, nuevoEstado, razon);
}

async function actualizarEstadoCajonEnBD(nombreCajon, nuevoEstado, razon) {
    try {
        let response = await fetch('../API/api_configuraciones.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                accion: 'toggle_estado_cajon',
                nombre_cajon: nombreCajon,
                estado: nuevoEstado,
                razon: razon
            })
        });

        let res = await response.json();
        if (res.status === 'success') {
            mostrarNotificacion(res.message, 'success');
            cargarDatosConfig();
        } else {
            mostrarNotificacion("Error: " + res.message, 'error');
        }
    } catch (e) {
        mostrarNotificacion("Error de red al intentar actualizar el estado del cajón.", 'error');
    }
}

function renderPaginacionGenerica(containerId, paginaActual, totalPaginas, inicio, cantidadActual, totalItems, callbackCambio) {
    let container = document.getElementById(containerId);
    if (!container) return;

    let mostrandoHasta = totalItems > 0 ? inicio + cantidadActual : 0;
    let textoInfo = `Mostrando ${totalItems > 0 ? inicio + 1 : 0} a ${mostrandoHasta} de ${totalItems} registros`;

    container.innerHTML = `
        <span>${textoInfo}</span>
        <div class="pagination-buttons">
            <button class="page-btn" ${paginaActual === 1 ? 'disabled' : ''} id="btnAnt_${containerId}">Anterior</button>
            <span style="padding: 6px 10px; font-weight: 600;">Pág. ${paginaActual} de ${totalPaginas || 1}</span>
            <button class="page-btn" ${paginaActual >= totalPaginas ? 'disabled' : ''} id="btnSig_${containerId}">Siguiente</button>
        </div>
    `;

    document.getElementById(`btnAnt_${containerId}`).onclick = () => callbackCambio(paginaActual - 1);
    document.getElementById(`btnSig_${containerId}`).onclick = () => callbackCambio(paginaActual + 1);
}

function cambiarTab(tabName, btnEl) {
    document.querySelectorAll('.config-tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.config-tab-content').forEach(content => content.classList.remove('active'));

    btnEl.classList.add('active');
    document.getElementById(`tab_${tabName}`).classList.add('active');
}

function descargarPlantillaCSV() {
    if (llavesData.length === 0) {
        mostrarNotificacion("No hay registros para exportar.", 'error');
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,numero_departamento,nivel,tipologia,clave_maestra\n";
    llavesData.forEach(row => {
        csvContent += `${row.numero_departamento},${row.nivel},${row.tipologia},${row.clave_maestra || ''}\n`;
    });

    let encodedUri = encodeURI(csvContent);
    let link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `plantilla_claves_maestras_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    mostrarNotificacion("Plantilla descargada correctamente.", 'success');
}

async function subirCSVClaves(input) {
    let file = input.files[0];
    if (!file) return;

    if (!confirm(`¿Está seguro de que desea actualizar masivamente las claves con el archivo "${file.name}"?`)) {
        input.value = '';
        return;
    }

    let formData = new FormData();
    formData.append('archivo_csv', file);

    try {
        let response = await fetch('../API/api_configuraciones.php', {
            method: 'POST',
            body: formData
        });

        let res = await response.json();
        if (res.status === 'success') {
            mostrarNotificacion(res.message, 'success');
            cargarDatosConfig();
        } else {
            mostrarNotificacion("Error: " + res.message, 'error');
        }
    } catch (e) {
        mostrarNotificacion("Error al procesar el archivo CSV.", 'error');
    } finally {
        input.value = '';
    }
}

function solicitarPermisoCambio(numDep) {
    depSeleccionadoParaEditar = numDep;
    document.getElementById('modalMensaje').innerText = `¿Está seguro de que desea modificar la clave maestra para el Departamento ${numDep}? Esta es una acción confidencial.`;
    document.getElementById('modalConfirmacion').style.display = 'flex';
}

function cerrarModalConfirmacion() {
    depSeleccionadoParaEditar = null;
    document.getElementById('modalConfirmacion').style.display = 'none';
}

document.getElementById('btnAceptarCambio').onclick = function() {
    if (!depSeleccionadoParaEditar) return;

    let input = document.getElementById(`inpLlave_${depSeleccionadoParaEditar}`);
    let btnEdit = document.getElementById(`btnEdit_${depSeleccionadoParaEditar}`);
    let btnSave = document.getElementById(`btnSave_${depSeleccionadoParaEditar}`);

    if (input) {
        input.disabled = false;
        input.type = "text";
        input.style.opacity = "1.0";
        input.style.border = "2px solid #6366f1";
        input.focus();
    }

    if (btnEdit) btnEdit.style.display = "none";
    if (btnSave) btnSave.style.display = "inline-block";

    cerrarModalConfirmacion();
};

async function guardarClave(numDep) {
    let input = document.getElementById(`inpLlave_${numDep}`);
    if (!input) return;

    let nuevaClave = input.value.trim();

    if (!/^\d{4}$/.test(nuevaClave)) {
        mostrarNotificacion("La clave maestra debe contener exactamente 4 números.", 'error');
        input.focus();
        return;
    }

    try {
        let response = await fetch('../API/api_configuraciones.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                numero_departamento: numDep,
                clave_maestra: nuevaClave
            })
        });

        let res = await response.json();
        if (res.status === 'success') {
            mostrarNotificacion(res.message, 'success');
            let item = llavesData.find(d => d.numero_departamento == numDep);
            if (item) item.clave_maestra = nuevaClave;
            
            input.disabled = true;
            input.type = "password";
            input.style.opacity = "0.7";
            input.style.border = "1px solid var(--border-color)";
            document.getElementById(`btnEdit_${numDep}`).style.display = "inline-block";
            document.getElementById(`btnSave_${numDep}`).style.display = "none";
        } else {
            mostrarNotificacion("Error: " + res.message, 'error');
        }
    } catch (e) {
        mostrarNotificacion("Error de conexión al intentar guardar la clave.", 'error');
    }
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
    cargarDatosConfig();
};