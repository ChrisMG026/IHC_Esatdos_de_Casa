<?php
// controllers/ContratoController.php
// ============================================================
// CONTROLADOR: GESTIÓN DE CONTRATOS, RENOVACIONES Y AUTOS
// ============================================================

require_once __DIR__ . '/BaseController.php';
require_once __DIR__ . '/../models/Contrato.php';

class ContratoController extends BaseController {
    private Contrato $contratoModel;

    public function __construct() {
        $this->contratoModel = new Contrato();
    }

    public function handleRequest(): void {
        $method = $_SERVER['REQUEST_METHOD'];

        if ($method === 'GET') {
            AuthMiddleware::liberarBloqueoSesion();
            $action = $_GET['action'] ?? '';

            if ($action === 'obtener_auto') {
                $nomenclatura = trim($_GET['nomenclatura'] ?? '');
                $auto = $this->contratoModel->obtenerAuto($nomenclatura);
                $this->jsonResponse(["status" => "success", "data" => $auto]);
            } elseif ($action === 'historico') {
                $nomenclatura = trim($_GET['nomenclatura'] ?? '');
                $residente    = trim($_GET['residente'] ?? '');
                $historico = $this->contratoModel->obtenerHistorico($nomenclatura, $residente);
                $this->jsonResponse(array_merge(["status" => "success"], $historico));
            } else {
                $contratos = $this->contratoModel->listar();
                http_response_code(200);
                header('Content-Type: application/json; charset=utf-8');
                echo json_encode($contratos, JSON_UNESCAPED_UNICODE);
                exit;
            }
        } elseif ($method === 'POST') {
            AuthMiddleware::requerirPermiso('editar_residentes');
            $data = $this->getJsonInput();
            $action = $data['action'] ?? '';

            if ($action === 'renovar') {
                $res = $this->contratoModel->renovar($data, $this->getIdUsuario());
                if ($res['success']) {
                    $this->successResponse($res['message']);
                } else {
                    $this->errorResponse($res['message']);
                }
            } elseif ($action === 'guardar_auto') {
                $res = $this->contratoModel->guardarAuto($data, $this->getIdUsuario());
                if ($res['success']) {
                    $this->successResponse($res['message']);
                } else {
                    $this->errorResponse($res['message']);
                }
            } else {
                $this->errorResponse("Acción no reconocida en Contratos.");
            }
        } else {
            $this->errorResponse("Método no permitido.", 405);
        }
    }
}

// Ejecución directa de la petición
$controller = new ContratoController();
$controller->handleRequest();
