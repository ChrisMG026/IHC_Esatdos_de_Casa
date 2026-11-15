<?php
// controllers/AuthController.php
// ============================================================
// CONTROLADOR: AUTENTICACIÓN, SESIÓN Y RECUPERACIÓN
// ============================================================

require_once __DIR__ . '/BaseController.php';
require_once __DIR__ . '/../models/Usuario.php';

class AuthController extends BaseController {
    private Usuario $usuarioModel;

    public function __construct() {
        $this->usuarioModel = new Usuario();
    }

    public function handleRequest(): void {
        $method = $_SERVER['REQUEST_METHOD'];
        $action = $_GET['action'] ?? '';

        if ($method === 'POST') {
            $data = $this->getJsonInput();
            if (isset($data['action'])) {
                $action = $data['action'];
            } elseif (isset($data['accion'])) {
                $accion = $data['accion'];
                if ($accion === 'buscar') $action = 'buscar_pregunta';
                if ($accion === 'cambiar') $action = 'cambiar_password';
            }

            if ($action === 'logout') {
                $this->logout();
            } elseif ($action === 'buscar_pregunta') {
                $this->buscarPregunta($data);
            } elseif ($action === 'cambiar_password') {
                $this->cambiarPassword($data);
            } else {
                $this->login($data);
            }
        } elseif ($method === 'GET') {
            if ($action === 'logout') {
                $this->logout();
            } else {
                $this->verificarSesion();
            }
        } else {
            $this->errorResponse("Método HTTP no soportado.", 405);
        }
    }

    private function login(array $data): void {
        $username = trim($data['username'] ?? '');
        $password = trim($data['password'] ?? '');

        if (empty($username) || empty($password)) {
            $this->errorResponse("Por favor ingresa usuario y contraseña.");
        }

        $res = $this->usuarioModel->autenticar($username, $password);
        if ($res['success']) {
            $_SESSION['id_usuario'] = $res['usuario']['id_usuario'];
            $_SESSION['nombre'] = $res['usuario']['nombre_completo'];
            $_SESSION['id_rol'] = $res['usuario']['id_rol'];
            $_SESSION['permisos'] = $res['usuario']['permisos'];
            $_SESSION['ultimo_movimiento'] = time();

            $this->successResponse("Autenticación exitosa.");
        } else {
            $this->errorResponse($res['message'], 401);
        }
    }

    private function logout(): void {
        session_unset();
        session_destroy();
        $this->successResponse("Sesión cerrada correctamente.");
    }

    private function verificarSesion(): void {
        if (isset($_SESSION['id_usuario'])) {
            $this->jsonResponse([
                "logueado"   => true,
                "id_usuario" => (int)$_SESSION['id_usuario'],
                "nombre"     => $_SESSION['nombre'],
                "permisos"   => $_SESSION['permisos']
            ]);
        } else {
            $this->jsonResponse(["logueado" => false]);
        }
    }

    private function buscarPregunta(array $data): void {
        $username = trim($data['username'] ?? '');
        if (empty($username)) {
            $this->errorResponse("El usuario es obligatorio.");
        }
        $res = $this->usuarioModel->buscarPreguntaSeguridad($username);
        if ($res['success']) {
            $this->jsonResponse(["status" => "success", "pregunta" => $res['pregunta']]);
        } else {
            $this->errorResponse($res['message'], 404);
        }
    }

    private function cambiarPassword(array $data): void {
        $username   = trim($data['username'] ?? '');
        $respuesta  = trim($data['respuesta'] ?? '');
        $nuevaPass  = $data['nueva_password'] ?? '';

        $res = $this->usuarioModel->cambiarPasswordSeguridad($username, $respuesta, $nuevaPass);
        if ($res['success']) {
            $this->successResponse($res['message']);
        } else {
            $this->errorResponse($res['message']);
        }
    }
}

// Ejecución directa de la petición
$controller = new AuthController();
$controller->handleRequest();
