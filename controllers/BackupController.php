<?php
// controllers/BackupController.php
// ============================================================
// CONTROLADOR: GENERACIÓN Y DESCARGA DE RESPALDO SQL
// ============================================================

require_once __DIR__ . '/BaseController.php';
require_once __DIR__ . '/../models/Bitacora.php';

class BackupController extends BaseController {
    private Bitacora $bitacoraModel;

    public function __construct() {
        $this->bitacoraModel = new Bitacora();
    }

    public function handleRequest(): void {
        AuthMiddleware::requerirPermiso('backup_sql');

        header('Content-Type: application/sql; charset=utf-8');
        header('Content-Disposition: attachment; filename="respaldo_utower_' . date('Y-m-d_H-i-s') . '.sql"');

        $sqlContent = $this->bitacoraModel->generarRespaldoSql();
        $this->bitacoraModel->registrar($this->getIdUsuario(), "Respaldo SQL", "Descarga de base de datos completa.");

        echo $sqlContent;
        exit;
    }
}

// Ejecución directa de la petición
$controller = new BackupController();
$controller->handleRequest();
