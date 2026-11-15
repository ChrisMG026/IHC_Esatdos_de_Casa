<?php
// config/AuthMiddleware.php
// ============================================================
// CLASE MIDDLEWARE DE AUTENTICACIÓN Y CONTROL DE PERMISOS
// ============================================================

require_once __DIR__ . '/config.php';

class AuthMiddleware {

    public static function iniciar(): void {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
        self::verificarInactividad();
    }

    public static function verificarInactividad(): void {
        if (isset($_SESSION['ultimo_movimiento'])) {
            $inactividad = time() - $_SESSION['ultimo_movimiento'];
            if ($inactividad > SESSION_LIFETIME) {
                session_unset();
                session_destroy();
                http_response_code(401);
                echo json_encode([
                    "status" => "error", 
                    "message" => "Sesión expirada por inactividad."
                ], JSON_UNESCAPED_UNICODE);
                exit;
            }
        }
        $_SESSION['ultimo_movimiento'] = time();
    }

    public static function requerirLogin(): void {
        self::iniciar();
        if (!isset($_SESSION['id_usuario'])) {
            http_response_code(401);
            echo json_encode([
                "status" => "error", 
                "message" => "Debes iniciar sesión para continuar."
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }
    }

    public static function requerirPermiso(string $permiso): void {
        self::requerirLogin();
        $permisos = $_SESSION['permisos'] ?? [];
        if (!in_array($permiso, $permisos)) {
            http_response_code(403);
            echo json_encode([
                "status" => "error", 
                "message" => "Acceso denegado. No cuentas con el permiso requerido: '{$permiso}'."
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }
    }

    public static function liberarBloqueoSesion(): void {
        if (session_status() === PHP_SESSION_ACTIVE) {
            session_write_close();
        }
    }

    public static function getUsuarioActual(): ?array {
        self::iniciar();
        if (!isset($_SESSION['id_usuario'])) {
            return null;
        }
        return [
            "id_usuario" => (int)$_SESSION['id_usuario'],
            "nombre"     => $_SESSION['nombre'] ?? '',
            "id_rol"     => (int)($_SESSION['id_rol'] ?? 0),
            "permisos"   => $_SESSION['permisos'] ?? []
        ];
    }
}

// Iniciar sesión automáticamente
AuthMiddleware::iniciar();

// Funciones globales para retrocompatibilidad
if (!function_exists('requerir_permiso')) {
    function requerir_permiso($permiso_necesario) {
        AuthMiddleware::requerirPermiso($permiso_necesario);
    }
}

if (!function_exists('liberar_bloqueo_sesion')) {
    function liberar_bloqueo_sesion() {
        AuthMiddleware::liberarBloqueoSesion();
    }
}
