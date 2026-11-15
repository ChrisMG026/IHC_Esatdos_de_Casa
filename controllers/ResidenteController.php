<?php
// controllers/ResidenteController.php
// ============================================================
// CONTROLADOR: GESTIÓN DE RESIDENTES, UNIDADES Y MOVIMIENTOS
// ============================================================

require_once __DIR__ . '/BaseController.php';
require_once __DIR__ . '/../models/Residente.php';

class ResidenteController extends BaseController {
    private Residente $residenteModel;

    public function __construct() {
        $this->residenteModel = new Residente();
    }

    public function handleRequest(): void {
        $method = $_SERVER['REQUEST_METHOD'];

        if ($method === 'GET') {
            AuthMiddleware::liberarBloqueoSesion();
            if (isset($_GET['catalogo']) && $_GET['catalogo'] === 'deshabilitados') {
                $catalogo = $this->residenteModel->obtenerCatalogoDeshabilitados();
                $this->jsonResponse(array_merge(["status" => "success"], $catalogo));
            } else {
                $residentes = $this->residenteModel->obtenerTodos();
                // Devolvemos el array directamente para total retrocompatibilidad con script.js
                http_response_code(200);
                header('Content-Type: application/json; charset=utf-8');
                echo json_encode($residentes, JSON_UNESCAPED_UNICODE);
                exit;
            }
        } elseif ($method === 'POST') {
            $data = $this->getJsonInput();
            $action = $_GET['action'] ?? ($data['action'] ?? '');

            if ($action === 'cambiar_unidad') {
                AuthMiddleware::requerirPermiso('editar_residentes');
                $res = $this->residenteModel->cambiarUnidad($data, $this->getIdUsuario());
                if ($res['success']) {
                    $this->successResponse($res['message']);
                } else {
                    $this->errorResponse($res['message']);
                }
            } elseif ($action === 'move_out') {
                AuthMiddleware::requerirPermiso('borrar_residentes');
                $registros = $data['registros'] ?? [];
                if (empty($registros)) {
                    $this->errorResponse("No se enviaron registros válidos para salida.");
                }
                $res = $this->residenteModel->moveOut($registros, $this->getIdUsuario());
                if ($res['success']) {
                    $this->successResponse($res['message']);
                } else {
                    $this->errorResponse($res['message']);
                }
            } else {
                AuthMiddleware::requerirPermiso('editar_residentes');
                $res = $this->residenteModel->guardar($data, $this->getIdUsuario());
                if ($res['success']) {
                    $this->successResponse($res['message']);
                } else {
                    $this->errorResponse($res['message']);
                }
            }
        } else {
            $this->errorResponse("Método HTTP no permitido.", 405);
        }
    }
}

// Ejecución directa de la petición
$controller = new ResidenteController();
$controller->handleRequest();
