<?php
// controllers/EstacionamientoController.php
// ============================================================
// CONTROLADOR: GESTIÓN DE CAJONES DE ESTACIONAMIENTO
// ============================================================

require_once __DIR__ . '/BaseController.php';
require_once __DIR__ . '/../models/Estacionamiento.php';

class EstacionamientoController extends BaseController {
    private Estacionamiento $estacionamientoModel;

    public function __construct() {
        $this->estacionamientoModel = new Estacionamiento();
    }

    public function handleRequest(): void {
        $method = $_SERVER['REQUEST_METHOD'];

        if ($method === 'GET') {
            AuthMiddleware::liberarBloqueoSesion();
            $cajones = $this->estacionamientoModel->obtenerTodos();
            http_response_code(200);
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode($cajones, JSON_UNESCAPED_UNICODE);
            exit;
        } elseif ($method === 'POST') {
            AuthMiddleware::requerirPermiso('editar_admin_parking');
            $data = $this->getJsonInput();
            $action = $data['action'] ?? '';

            if ($action === 'actualizar_admin') {
                $res = $this->estacionamientoModel->actualizarAdmin($data, $this->getIdUsuario());
                if ($res['success']) {
                    $this->successResponse($res['message']);
                } else {
                    $this->errorResponse($res['message']);
                }
            } else {
                $this->errorResponse("Acción no reconocida en Estacionamiento.");
            }
        } else {
            $this->errorResponse("Método no permitido.", 405);
        }
    }
}

// Ejecución directa de la petición
$controller = new EstacionamientoController();
$controller->handleRequest();
