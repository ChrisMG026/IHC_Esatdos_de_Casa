<?php
// Iniciar sesión si no está iniciada
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Control de inactividad (1 HORA = 3600 segundos)
if (isset($_SESSION['ultimo_movimiento'])) {
    $inactividad = time() - $_SESSION['ultimo_movimiento'];
    if ($inactividad > 3600) {
        session_unset();
        session_destroy();
        http_response_code(401);
        echo json_encode(["status" => "error", "message" => "Sesión expirada por inactividad."]);
        exit;
    }
}
$_SESSION['ultimo_movimiento'] = time(); // Actualiza el reloj

// Función para requerir un permiso específico
function requerir_permiso($permiso_necesario) {
    if (!isset($_SESSION['id_usuario'])) {
        http_response_code(401);
        echo json_encode(["status" => "error", "message" => "Debes iniciar sesión."]);
        exit;
    }
    
    if (!in_array($permiso_necesario, $_SESSION['permisos'])) {
        http_response_code(403);
        echo json_encode(["status" => "error", "message" => "Acceso denegado. No tienes permisos de Administrador."]);
        exit;
    }
}
?>