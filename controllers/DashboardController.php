<?php
// controllers/DashboardController.php
// ============================================================
// CONTROLADOR: MÉTRICAS GENERALES Y KPIS DE DASHBOARD
// ============================================================

require_once __DIR__ . '/BaseController.php';
require_once __DIR__ . '/../models/Reporte.php';

class DashboardController extends BaseController {
    private Reporte $reporteModel;

    public function __construct() {
        $this->reporteModel = new Reporte();
    }

    public function handleRequest(): void {
        AuthMiddleware::liberarBloqueoSesion();
        $metricas = $this->reporteModel->obtenerKpisDashboard();
        $this->jsonResponse(array_merge(["status" => "success"], $metricas));
    }
}

// Ejecución directa de la petición
$controller = new DashboardController();
$controller->handleRequest();
