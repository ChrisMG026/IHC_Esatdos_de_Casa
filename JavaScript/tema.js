// Tema claro/oscuro para pantallas sin sidebar (login y recuperar contraseña)
(function () {
    function actualizarBoton(oscuro) {
        var i = document.getElementById('themeIcon');
        var t = document.getElementById('themeText');
        if (i) i.innerText = oscuro ? '☀️' : '🌙';
        if (t) t.innerText = oscuro ? 'Modo Claro' : 'Modo Oscuro';
    }

    document.addEventListener('DOMContentLoaded', function () {
        document.documentElement.classList.remove('dark-mode-preload');
        var oscuro = localStorage.getItem('theme') === 'dark';
        document.body.classList.toggle('dark-mode', oscuro);
        actualizarBoton(oscuro);
    });

    window.toggleDarkMode = function () {
        var oscuro = document.body.classList.toggle('dark-mode');
        localStorage.setItem('theme', oscuro ? 'dark' : 'light');
        actualizarBoton(oscuro);
    };

    window.mostrarOcultarPassword = function (idInput, btn) {
        var inp = document.getElementById(idInput);
        if (!inp) return;
        var visible = inp.type === 'text';
        inp.type = visible ? 'password' : 'text';
        btn.innerText = visible ? '👁️' : '🙈';
        btn.setAttribute('aria-label', visible ? 'Mostrar contraseña' : 'Ocultar contraseña');
    };
})();
