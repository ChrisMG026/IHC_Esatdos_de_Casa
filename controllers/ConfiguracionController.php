<?php
// controllers/ConfiguracionController.php
// ============================================================
// CONTROLADOR: CONFIGURACIONES DEL SISTEMA Y CATÁLOGOS
// ============================================================

require_once __DIR__ . '/BaseController.php';
require_once __DIR__ . '/../models/Configuracion.php';

class ConfiguracionController extends BaseController {
    private Configuracion $configModel;

    public function __construct() {
        $this->configModel = new Configuracion();
    }

    public function handleRequest(): void {
        $method = $_SERVER['REQUEST_METHOD'];

        if ($method === 'GET') {
            $permisos = $_SESSION['permisos'] ?? [];
            if (!in_array('ver_configuraciones', $permisos) && !in_array('editar_claves', $permisos)) {
                $this->errorResponse("No tienes permiso para ver las configuraciones.", 403);
            }

            $datos = $this->configModel->obtenerTodo();
            $this->jsonResponse(array_merge(["status" => "success"], $datos));
        } elseif ($method === 'POST') {
            // Carga masiva de CSV de llaves maestras
            if (isset($_POST['accion']) && $_POST['accion'] === 'subir_csv_claves') {
                AuthMiddleware::requerirPermiso('editar_claves');
                if (!isset($_FILES['archivo_csv']) || $_FILES['archivo_csv']['error'] !== UPLOAD_ERR_OK) {
                    $this->errorResponse("No se recibió ningún archivo CSV válido.");
                }
                $handle = fopen($_FILES['archivo_csv']['tmp_name'], 'r');
                if (!$handle) {
                    $this->errorResponse("No se pudo leer el archivo CSV.");
                }
                $res = $this->configModel->procesarCsvClaves($handle, $this->getIdUsuario());
                fclose($handle);

                if ($res['success']) {
                    $this->successResponse($res['message'], ["procesados" => $res['procesados']]);
                } else {
                    $this->errorResponse($res['message']);
                }
            }

            $data = $this->getJsonInput();
            $accion = $data['accion'] ?? '';

            if ($accion === 'toggle_estado_dep') {
                AuthMiddleware::requerirPermiso('editar_admin_parking');
                $nom = $data['nomenclatura'] ?? '';
                $est = $data['estado'] ?? '';
                $raz = $data['razon'] ?? '';
                $res = $this->configModel->toggleEstadoDepartamento($nom, $est, $raz, $this->getIdUsuario());
                if ($res['success']) {
                    $this->successResponse($res['message']);
                } else {
                    $this->errorResponse($res['message']);
                }
            } elseif ($accion === 'toggle_estado_cajon') {
                AuthMiddleware::requerirPermiso('editar_admin_parking');
                $cajon = $data['nombre_cajon'] ?? '';
                $est   = $data['estado'] ?? '';
                $raz   = $data['razon'] ?? '';
                $res = $this->configModel->toggleEstadoCajon($cajon, $est, $raz, $this->getIdUsuario());
                if ($res['success']) {
                    $this->successResponse($res['message']);
                } else {
                    $this->errorResponse($res['message']);
                }
            } elseif (isset($data['numero_departamento']) && isset($data['clave_maestra'])) {
                AuthMiddleware::requerirPermiso('editar_claves');
                $dep   = strval($data['numero_departamento']);
                $clave = strval($data['clave_maestra']);
                $res = $this->configModel->guardarClaveMaestra($dep, $clave, $this->getIdUsuario());
                if ($res['success']) {
                    $this->successResponse($res['message']);
                } else {
                    $this->errorResponse($res['message']);
                }
            } else {
                $this->errorResponse("Acción no reconocida en Configuraciones.");
            }
        } else {
            $this->errorResponse("Método no permitido.", 405);
        }
    }
}

// Ejecución directa de la petición
$controller = new ConfiguracionController();
$controller->handleRequest();
