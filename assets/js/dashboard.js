// Tipografía de las gráficas alineada con el nuevo diseño
if (window.Chart) { Chart.defaults.font.family = "'Plus Jakarta Sans', 'Segoe UI', sans-serif"; }

let datosDashboard = null;

// Devuelve un token CSS del tema activo, con valor de respaldo.
function tokenCSS(nombre, fallback) {
    let valor = getComputedStyle(document.body).getPropertyValue(nombre).trim();
    return valor || fallback;
}

// Colores de texto y líneas de las gráficas según el tema activo (claro u oscuro)
function ajustarColoresGraficas() {
    let colorTexto = tokenCSS('--text-secondary', '#94a3b8');
    let colorBorde = tokenCSS('--border-color', 'rgba(148,163,184,0.2)');
    Chart.defaults.color = colorTexto;
    Chart.defaults.borderColor = colorBorde;
    if (Chart.defaults.plugins && Chart.defaults.plugins.legend && Chart.defaults.plugins.legend.labels) {
        Chart.defaults.plugins.legend.labels.color = colorTexto;
    }
    if (Chart.defaults.plugins && Chart.defaults.plugins.tooltip) {
        Chart.defaults.plugins.tooltip.backgroundColor = tokenCSS('--bg-card', '#111827');
        Chart.defaults.plugins.tooltip.titleColor = colorTexto;
        Chart.defaults.plugins.tooltip.bodyColor = colorTexto;
        Chart.defaults.plugins.tooltip.borderColor = colorBorde;
        Chart.defaults.plugins.tooltip.borderWidth = 1;
    }
}

function pintarDashboard(res) {
    // Primero lo esencial (cifras y movimientos); las gráficas dependen de la librería Chart.js
    renderKPIs(res.kpis);
    renderUltimosMovimientos(res.ultimos_movimientos);
    if (!window.Chart) return;
    ajustarColoresGraficas();
    renderChartNiveles(res.niveles);
    renderChartContratos(res.kpis);
    renderChartGeneroGeneral(res.genero_general);
    renderChartGeneroNivel(res.genero_nivel);
}

let chartNivelesInstancia = null;
let chartContratosInstancia = null;
let chartGeneroGeneralInstancia = null;
let chartGeneroNivelInstancia = null;

async function cargarDashboard() {
    try {
        let response = await fetch('../controllers/DashboardController.php');
        let res = await response.json();

        if (res.status === 'success') {
            datosDashboard = res;
            pintarDashboard(res);
        }
    } catch (e) {
        console.error("Error al cargar dashboard:", e);
        window.UIEstados.mostrarErrorGlobal('No se pudo cargar el panel.');
    }
}

function renderKPIs(kpis) {
    document.getElementById('kpiOcupacion').innerText = `${kpis.porcentaje_ocupacion}%`;
    document.getElementById('kpiOcupacionSub').innerText = `${kpis.ocupados} de ${kpis.total_espacios} habitados`;

    document.getElementById('kpiIngresos').innerText = kpis.ingreso_total.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

    document.getElementById('kpiPorVencer').innerText = kpis.por_vencer;
    document.getElementById('kpiVencidosSub').innerText = kpis.vencidos === 1 ? '1 contrato vencido' : `${kpis.vencidos} contratos vencidos`;

    let pctEstacionamiento = kpis.total_cajones > 0 ? Math.round((kpis.cajones_ocupados / kpis.total_cajones) * 100) : 0;
    document.getElementById('kpiEstacionamiento').innerText = `${pctEstacionamiento}%`;
    document.getElementById('kpiCajonesSub').innerText = `${kpis.cajones_ocupados} de ${kpis.total_cajones} cajones`;
    document.getElementById('meterOcupacion')?.style.setProperty('--pct', kpis.porcentaje_ocupacion + '%');
    document.getElementById('meterEstacionamiento')?.style.setProperty('--pct', pctEstacionamiento + '%');
    document.getElementById('kpiPorVencer').closest('.stat-card')?.classList.toggle('is-alert', kpis.por_vencer > 0 || kpis.vencidos > 0);
}

function renderChartNiveles(niveles) {
    let ctx = document.getElementById('chartNiveles').getContext('2d');
    
    let labels = niveles.map(n => n.nivel);
    let ocupados = niveles.map(n => n.ocupados);
    let totales = niveles.map(n => n.total);

    if (chartNivelesInstancia) chartNivelesInstancia.destroy();

    chartNivelesInstancia = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Habitados',
                    data: ocupados,
                    backgroundColor: tokenCSS('--accent-color', '#1d4ed8'),
                    borderRadius: 6
                },
                {
                    label: 'Total de espacios',
                    data: totales,
                    backgroundColor: tokenCSS('--border-color', 'rgba(148,163,184,0.38)'),
                    borderRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { labels: { color: Chart.defaults.color } } },
            scales: {
                x: { ticks: { color: Chart.defaults.color } },
                y: { ticks: { color: Chart.defaults.color }, beginAtZero: true }
            }
        }
    });
}

function renderChartContratos(kpis) {
    let ctx = document.getElementById('chartContratos').getContext('2d');

    let vigentes = kpis.ocupados - kpis.por_vencer - kpis.vencidos;
    if (vigentes < 0) vigentes = 0;

    if (chartContratosInstancia) chartContratosInstancia.destroy();

    chartContratosInstancia = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Vigentes', 'Por vencer (30 días)', 'Vencidos'],
            datasets: [{
                data: [vigentes, kpis.por_vencer, kpis.vencidos],
                backgroundColor: [tokenCSS('--success', '#047857'), tokenCSS('--warning', '#b45309'), tokenCSS('--danger', '#b91c1c')],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom', labels: { color: Chart.defaults.color } } }
        }
    });
}

function renderChartGeneroGeneral(genero) {
    let ctx = document.getElementById('chartGeneroGeneral').getContext('2d');

    if (chartGeneroGeneralInstancia) chartGeneroGeneralInstancia.destroy();

    chartGeneroGeneralInstancia = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: ['Hombres ♂', 'Mujeres ♀'],
            datasets: [{
                data: [genero.hombres, genero.mujeres],
                backgroundColor: [tokenCSS('--info', '#0369a1'), tokenCSS('--purple', '#6d28d9')],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { 
                legend: { position: 'bottom', labels: { color: Chart.defaults.color } } 
            }
        }
    });
}

function renderChartGeneroNivel(generoNivel) {
    let ctx = document.getElementById('chartGeneroNivel').getContext('2d');

    let labels = generoNivel.map(g => g.nivel);
    let hombres = generoNivel.map(g => g.hombres);
    let mujeres = generoNivel.map(g => g.mujeres);

    if (chartGeneroNivelInstancia) chartGeneroNivelInstancia.destroy();

    chartGeneroNivelInstancia = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Hombres ♂',
                    data: hombres,
                    backgroundColor: tokenCSS('--info', '#0369a1'),
                    borderRadius: 6
                },
                {
                    label: 'Mujeres ♀',
                    data: mujeres,
                    backgroundColor: tokenCSS('--purple', '#6d28d9'),
                    borderRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { labels: { color: Chart.defaults.color } } },
            scales: {
                x: { ticks: { color: Chart.defaults.color } },
                y: { ticks: { color: Chart.defaults.color }, beginAtZero: true }
            }
        }
    });
}

function renderUltimosMovimientos(movimientos) {
    let tbody = document.getElementById('tbodyUltimosMovimientos');
    tbody.innerHTML = '';

    if (!movimientos || movimientos.length === 0) {
        tbody.innerHTML = UIEstados.filaVacia(4, 'Sin movimientos', 'Los move-in y move-out aparecerán aquí.', 'clock');
        return;
    }

    movimientos.forEach(m => {
        let badge = m.tipo === 'Move-In' 
            ? `<span class="badge-status status-green"><span class="ui-ico ui-ico-download"></span> Move-In</span>` 
            : `<span class="badge-status status-red"><span class="ui-ico ui-ico-upload"></span> Move-Out</span>`;

        tbody.innerHTML += `
            <tr>
                <td>${badge}</td>
                <td><strong>${m.residente}</strong></td>
                <td><span class="unit-tag">${m.nomenclatura}</span></td>
                <td>${m.fecha}</td>
            </tr>
        `;
    });
}

function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    let esOscuro = document.body.classList.contains('dark-mode');
    localStorage.setItem('theme', esOscuro ? 'dark' : 'light');
    document.getElementById('themeIcon').textContent = '';
    document.getElementById('themeText').innerText = esOscuro ? 'Modo Claro' : 'Modo Oscuro';
    if (datosDashboard) pintarDashboard(datosDashboard);
}

window.onload = function() {
    // Quitar la clase de preload del HTML
    document.documentElement.classList.remove('dark-mode-preload');

    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-mode');
        if(document.getElementById('themeIcon')) document.getElementById('themeIcon').textContent = '';
        if(document.getElementById('themeText')) document.getElementById('themeText').innerText = 'Modo Claro';
    }
    cargarDashboard();
};
