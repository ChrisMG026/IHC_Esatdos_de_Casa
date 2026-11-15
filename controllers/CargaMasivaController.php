<?php
// controllers/CargaMasivaController.php
// ============================================================
// CONTROLADOR: CARGA Y DESCARGA MASIVA DE REGISTROS (CSV)
// ============================================================

require_once __DIR__ . '/BaseController.php';
require_once __DIR__ . '/../models/CargaMasiva.php';

class CargaMasivaController extends BaseController {
    private CargaMasiva $cargaModel;

    public function __construct() {
        $this->cargaModel = new CargaMasiva();
    }

    public function handleRequest(): void {
        AuthMiddleware::requerirPermiso('carga_masiva_dev');
        $method = $_SERVER['REQUEST_METHOD'];
        $tipo = $_GET['tipo'] ?? $_POST['tipo'] ?? 'residentes';

        if ($method === 'GET') {
            $this->cargaModel->generarPlantillaCsv($tipo);
            exit;
        } elseif ($method === 'POST') {
            if (!isset($_FILES['archivo_csv']) || $_FILES['archivo_csv']['error'] !== UPLOAD_ERR_OK) {
                $this->errorResponse("No se subió ningún archivo CSV válido.");
            }

            $fileTmpPath = $_FILES['archivo_csv']['tmp_name'];
            $handle = fopen($fileTmpPath, 'r');
            if (!$handle) {
                $this->errorResponse("No se pudo leer el archivo CSV.");
            }

            $res = $this->cargaModel->procesarArchivoCsv($tipo, $handle, $this->getIdUsuario());
            fclose($handle);

            if ($res['success']) {
                $this->successResponse($res['message'], ["procesados" => $res['procesados']]);
            } else {
                $this->errorResponse($res['message']);
            }
        } else {
            $this->errorResponse("Método no permitido.", 405);
        }
    }
}

// Ejecución directa de la petición
$controller = new CargaMasivaController();
$controller->handleRequest();
