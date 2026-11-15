<?php
// controllers/UsuarioController.php
// ============================================================
// CONTROLADOR: ADMINISTRACIÓN DE USUARIOS, ROLES Y LOGS
// ============================================================

require_once __DIR__ . '/BaseController.php';
require_once __DIR__ . '/../models/Usuario.php';
require_once __DIR__ . '/../models/Bitacora.php';

class UsuarioController extends BaseController {
    private Usuario $usuarioModel;
    private Bitacora $bitacoraModel;

    public function __construct() {
        $this->usuarioModel = new Usuario();
        $this->bitacoraModel = new Bitacora();
    }

    public function handleRequest(): void {
        AuthMiddleware::requerirPermiso('gestionar_usuarios');
        $method = $_SERVER['REQUEST_METHOD'];

        if ($method === 'GET') {
            $action = $_GET['action'] ?? '';
            if ($action === 'logs') {
                $logs = $this->bitacoraModel->obtenerUltimos(200);
                $this->jsonResponse(["status" => "success", "logs" => $logs]);
            } else {
                $usuarios  = $this->usuarioModel->listar();
                $roles     = $this->usuarioModel->obtenerRoles();
                $permisos  = $this->usuarioModel->obtenerPermisos();

                $this->jsonResponse([
                    "status"   => "success",
                    "usuarios" => $usuarios,
                    "roles"    => $roles,
                    "permisos" => $permisos
                ]);
            }
        } elseif ($method === 'POST') {
            $data = $this->getJsonInput();
            $accion = $data['accion'] ?? '';

            if ($accion === 'crear_usuario') {
                $res = $this->usuarioModel->crear($data);
                if ($res['success']) {
                    $this->bitacoraModel->registrar($this->getIdUsuario(), "Crear Usuario", "Usuario: " . ($data['username'] ?? ''));
                    $this->successResponse($res['message']);
                } else {
                    $this->errorResponse($res['message']);
                }
            } elseif ($accion === 'editar_usuario') {
                $res = $this->usuarioModel->actualizar($data);
                if ($res['success']) {
                    $this->bitacoraModel->registrar($this->getIdUsuario(), "Editar Usuario", "ID: " . ($data['id_usuario'] ?? ''));
                    $this->successResponse($res['message']);
                } else {
                    $this->errorResponse($res['message']);
                }
            } elseif ($accion === 'eliminar_usuario') {
                $id = intval($data['id_usuario'] ?? 0);
                $res = $this->usuarioModel->eliminar($id);
                if ($res['success']) {
                    $this->bitacoraModel->registrar($this->getIdUsuario(), "Eliminar Usuario", "ID Usuario: {$id}");
                    $this->successResponse($res['message']);
                } else {
                    $this->errorResponse($res['message']);
                }
            } elseif ($accion === 'crear_rol' || $accion === 'editar_rol') {
                $idRol = intval($data['id_rol'] ?? 0);
                $nombre = trim($data['nombre'] ?? '');
                $desc = trim($data['descripcion'] ?? '');
                $permisos = $data['permisos'] ?? [];

                $res = $this->usuarioModel->guardarRol($idRol, $nombre, $desc, $permisos);
                if ($res['success']) {
                    $this->bitacoraModel->registrar($this->getIdUsuario(), "Guardar Rol", "Rol: {$nombre}");
                    $this->successResponse($res['message']);
                } else {
                    $this->errorResponse($res['message']);
                }
            } else {
                $this->errorResponse("Acción no reconocida en Administración de Usuarios.");
            }
        } else {
            $this->errorResponse("Método no permitido.", 405);
        }
    }
}

// Ejecución directa de la petición
$controller = new UsuarioController();
$controller->handleRequest();
