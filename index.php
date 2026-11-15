<?php
// index.php
// ============================================================
// ENRUTADOR PRINCIPAL / PUNTO DE ENTRADA AL SISTEMA
// ============================================================

require_once __DIR__ . '/config/AuthMiddleware.php';

// Si el usuario ya cuenta con sesión activa, redirigir al Dashboard; de lo contrario, al Login
if (isset($_SESSION['id_usuario'])) {
    header('Location: views/dashboard.html');
} else {
    header('Location: views/login.html');
}
exit;
