async function ejecutarLogin(e) {
    e.preventDefault(); // Evita que la página se recargue

    let btn = document.getElementById('btnEntrar');
    let user = document.getElementById('inpUsername').value.trim();
    let pass = document.getElementById('inpPassword').value;

    btn.innerText = "Verificando...";
    btn.disabled = true;

    try {
        let response = await fetch('../API/api_login.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: user, password: pass })
        });
        
        let res = await response.json();

        if (res.status === 'success') {
            // Redirigir al dashboard
            window.location.href = 'dashboard.html';
        } else {
            mostrarNotificacion(res.message, 'error');
            btn.innerText = "Iniciar Sesión";
            btn.disabled = false;
        }
    } catch (error) {
        mostrarNotificacion("Error de conexión con el servidor.", 'error');
        btn.innerText = "Iniciar Sesión";
        btn.disabled = false;
    }
}

// Función de notificación (reutilizada de tus otros scripts)
function mostrarNotificacion(mensaje, tipo = 'success') {
    let container = document.getElementById('toastContainer');
    if (!container) return;
    let toast = document.createElement('div');
    toast.className = `app-toast ${tipo === 'success' ? 'toast-success' : 'toast-error'}`;
    let icono = tipo === 'success' ? '✅' : '❌';
    toast.innerHTML = `<span style="font-size: 1.2rem;">${icono}</span> <span style="flex: 1;">${mensaje}</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.remove(); }, 5000);
}