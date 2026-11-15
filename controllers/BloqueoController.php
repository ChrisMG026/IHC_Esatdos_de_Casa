<?php
// controllers/BloqueoController.php
// ============================================================
// CONTROLADOR: CONTROL DE CONCURRENCIA Y BLOQUEO DE EXPEDIENTES
// ============================================================

require_once __DIR__ . '/BaseController.php';
require_once __DIR__ . '/../models/Bloqueo.php';

class BloqueoController extends BaseController {
    private Bloqueo $bloqueoModel;

    public function __construct() {
        $this->bloqueoModel = new Bloqueo();
    }

    public function handleRequest(): void {
        AuthMiddleware::requerirLogin();
        $idUsuario = $this->getIdUsuario();
        $nombreUsuario = $this->getNombreUsuario();

        $metodo = $_SERVER['REQUEST_METHOD'];
        $action = $_GET['action'] ?? '';

        $input = [];
        if ($metodo === 'POST') {
            $input = $this->getJsonInput();
            if (isset($input['action'])) {
                $action = $input['action'];
            }
        }

        // 1. Listar todos los bloqueos
        if ($action === 'listar' || ($metodo === 'GET' && empty($_GET['nomenclatura']))) {
            AuthMiddleware::liberarBloqueoSesion();
            $bloqueos = $this->bloqueoModel->listarActivos($idUsuario);
            $this->jsonResponse(["status" => "success", "bloqueos" => $bloqueos]);
        }

        // 2. Verificar estado de un expediente
        if ($action === 'verificar') {
            AuthMiddleware::liberarBloqueoSesion();
            $nomenclatura = trim($_GET['nomenclatura'] ?? ($input['nomenclatura'] ?? ''));
            if (empty($nomenclatura)) {
                $this->errorResponse("Nomenclatura no proporcionada.");
            }
            $estado = $this->bloqueoModel->verificar($nomenclatura, $idUsuario);
            $this->jsonResponse(array_merge(["status" => "success"], $estado));
        }

        // 3. Adquirir o renovar bloqueo
        if ($action === 'bloquear') {
            $nomenclatura = trim($input['nomenclatura'] ?? ($_POST['nomenclatura'] ?? ''));
            if (empty($nomenclatura)) {
                $this->errorResponse("Nomenclatura requerida para bloquear.");
            }
            $res = $this->bloqueoModel->adquirir($nomenclatura, $idUsuario, $nombreUsuario);
            // Si está bloqueado por otro, status = locked; si no, status = success
            $this->jsonResponse($res);
        }

        // 4. Latido / Heartbeat
        if ($action === 'heartbeat' || $action === 'latido') {
            AuthMiddleware::liberarBloqueoSesion();
            $nomenclatura = trim($input['nomenclatura'] ?? ($_POST['nomenclatura'] ?? ''));
            if (!empty($nomenclatura)) {
                $this->bloqueoModel->renovarLatido($nomenclatura, $idUsuario, $nombreUsuario);
            }
            $this->jsonResponse(["status" => "success"]);
        }

        // 5. Liberar / Desbloquear expediente
        if ($action === 'desbloquear' || $action === 'liberar') {
            AuthMiddleware::liberarBloqueoSesion();
            $nomenclatura = trim($input['nomenclatura'] ?? ($_POST['nomenclatura'] ?? ''));
            if (empty($nomenclatura)) {
                $this->bloqueoModel->liberarTodosDeUsuario($idUsuario);
            } else {
                $this->bloqueoModel->liberar($nomenclatura, $idUsuario);
            }
            $this->jsonResponse(["status" => "success", "message" => "Expediente liberado con éxito."]);
        }

        $this->errorResponse("Acción de bloqueo no reconocida.");
    }
}

// Ejecución directa de la petición
$controller = new BloqueoController();
$controller->handleRequest();
