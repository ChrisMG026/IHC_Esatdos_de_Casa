<?php
// controllers/ReporteController.php
// ============================================================
// CONTROLADOR: REPORTES HISTÓRICOS Y AUDITORÍA DE MOVIMIENTOS
// ============================================================

require_once __DIR__ . '/BaseController.php';
require_once __DIR__ . '/../models/Reporte.php';

class ReporteController extends BaseController {
    private Reporte $reporteModel;

    public function __construct() {
        $this->reporteModel = new Reporte();
    }

    public function handleRequest(): void {
        AuthMiddleware::liberarBloqueoSesion();
        $reportes = $this->reporteModel->obtenerDatosReportes();
        $this->jsonResponse(array_merge(["status" => "success"], $reportes));
    }
}

// Ejecución directa de la petición
$controller = new ReporteController();
$controller->handleRequest();
