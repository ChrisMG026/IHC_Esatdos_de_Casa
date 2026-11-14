<?php
require_once 'config.php';
require_once 'auth_middleware.php'; // Solo iniciamos sesión, sin bloquear aún

header('Content-Type: application/json; charset=utf-8');

$conn = conectarDB();
$method = $_SERVER['REQUEST_METHOD'];

// ==================== PETICIÓN GET (CARGAR DATOS) ====================
if ($method === 'GET') {
    // Permitimos la lectura si tienen permiso de ver configuraciones o editar claves
    if (!in_array('ver_configuraciones', $_SESSION['permisos']) && !in_array('editar_claves', $_SESSION['permisos'])) {
        http_response_code(403);
        echo json_encode(["status" => "error", "message" => "No tienes permiso para ver las configuraciones."]);
        exit;
    }

    // 1. Obtener Llaves Maestras
    $sqlLlaves = "SELECT numero_departamento, nivel, tipologia, clave_maestra FROM llaves_maestras ORDER BY CAST(numero_departamento AS UNSIGNED) ASC";
    $resLlaves = $conn->query($sqlLlaves);
    $llaves = [];
    if ($resLlaves) {
        while ($row = $resLlaves->fetch_assoc()) { $llaves[] = $row; }
    }

    // 2. Obtener Departamentos
    $sqlDeps = "SELECT nivel, numero_dep, tipologia, recamara, cama, nomenclatura, estado FROM departamentos ORDER BY FIELD(nivel, 'PB', 'N1', 'N2', 'N3', 'N4', 'N5', 'N6', 'N7', 'N8', 'N9', 'N10'), CAST(numero_dep AS UNSIGNED) ASC";
    $resDeps = $conn->query($sqlDeps);
    $departamentos = [];
    if ($resDeps) {
        while ($row = $resDeps->fetch_assoc()) { $departamentos[] = $row; }
    }

    // 3. Obtener Cajones
    $sqlCajones = "SELECT nombre_cajon, estado FROM cajones_estacionamiento ORDER BY CAST(REGEXP_REPLACE(nombre_cajon, '[^0-9]', '') AS UNSIGNED) ASC";
    $resCajones = $conn->query($sqlCajones);
    $cajones = [];
    if ($resCajones) {
        while ($row = $resCajones->fetch_assoc()) { $cajones[] = $row; }
    }

    echo json_encode(["status" => "success", "llaves" => $llaves, "departamentos" => $departamentos, "cajones" => $cajones], JSON_UNESCAPED_UNICODE);
    exit;
}

// ==================== PETICIÓN POST (ACCIONES) ====================
if ($method === 'POST') {
    
    // NUEVO: PROCESAR CARGA MASIVA DE CLAVES (CSV)
    if (isset($_POST['accion']) && $_POST['accion'] === 'subir_csv_claves') {
        requerir_permiso('editar_claves'); // BLOQUEO AQUÍ
        
        if (!isset($_FILES['archivo_csv']) || $_FILES['archivo_csv']['error'] !== UPLOAD_ERR_OK) {
            echo json_encode(["status" => "error", "message" => "No se recibió ningún archivo válido."]);
            exit;
        }
        $handle = fopen($_FILES['archivo_csv']['tmp_name'], 'r');
        if (!$handle) {
            echo json_encode(["status" => "error", "message" => "No se pudo leer el archivo CSV."]);
            exit;
        }
        fgetcsv($handle, 1000, ","); // Omitir cabecera
        
        $conn->begin_transaction();
        try {
            $stmt = $conn->prepare("UPDATE llaves_maestras SET clave_maestra = ? WHERE numero_departamento = ?");
            $procesados = 0;
            while (($data = fgetcsv($handle, 1000, ",")) !== FALSE) {
                $numDep = trim($data[0] ?? '');
                $clave  = trim($data[3] ?? '');
                if (!empty($numDep) && !empty($clave)) {
                    $stmt->bind_param("ss", $clave, $numDep);
                    $stmt->execute();
                    $procesados++;
                }
            }
            $conn->commit();
            echo json_encode(["status" => "success", "message" => "Carga masiva completada. Se actualizaron $procesados claves."]);
        } catch (Exception $e) {
            $conn->rollback();
            echo json_encode(["status" => "error", "message" => "Error en la BD: " . $e->getMessage()]);
        }
        fclose($handle);
        exit;
    }

    $inputJSON = file_get_contents('php://input');
    $data = json_decode($inputJSON, true);
    $accion = $data['accion'] ?? '';

    // A. Deshabilitar Departamento
    if ($accion === 'toggle_estado_dep') {
        requerir_permiso('editar_admin_parking'); // BLOQUEO AQUÍ
        $nomenclatura = $data['nomenclatura'] ?? '';
        $nuevoEstado  = $data['estado'] ?? '';
        $razon        = trim($data['razon'] ?? '');

        if (empty($nomenclatura) || empty($razon)) {
            echo json_encode(["status" => "error", "message" => "Faltan datos."]);
            exit;
        }
        $stmt = $conn->prepare("UPDATE departamentos SET estado = ? WHERE nomenclatura = ?");
        $stmt->bind_param("ss", $nuevoEstado, $nomenclatura);
        if ($stmt->execute()) {
            $stmtIns = $conn->prepare("INSERT INTO departamentos_deshabilitados (nomenclatura, numero_dep, razon) VALUES (?, ?, ?)");
            $numDep = explode('-', $nomenclatura)[0];
            $razonRegistro = "[$nuevoEstado] " . $razon;
            $stmtIns->bind_param("sss", $nomenclatura, $numDep, $razonRegistro);
            $stmtIns->execute();
            echo json_encode(["status" => "success", "message" => "Departamento actualizado."]);
        } else {
            echo json_encode(["status" => "error", "message" => "Error al actualizar."]);
        }
        exit;
    }

    // B. Deshabilitar Cajón
    if ($accion === 'toggle_estado_cajon') {
        requerir_permiso('editar_admin_parking'); // BLOQUEO AQUÍ
        $nombreCajon = $data['nombre_cajon'] ?? '';
        $nuevoEstado = $data['estado'] ?? '';
        $razon       = trim($data['razon'] ?? '');

        if (empty($nombreCajon) || empty($razon)) {
            echo json_encode(["status" => "error", "message" => "Faltan datos."]);
            exit;
        }
        $stmt = $conn->prepare("UPDATE cajones_estacionamiento SET estado = ? WHERE nombre_cajon = ?");
        $stmt->bind_param("ss", $nuevoEstado, $nombreCajon);
        if ($stmt->execute()) {
            $stmtIns = $conn->prepare("INSERT INTO cajones_deshabilitados (nombre_cajon, razon) VALUES (?, ?)");
            $razonRegistro = "[$nuevoEstado] " . $razon;
            $stmtIns->bind_param("ss", $nombreCajon, $razonRegistro);
            $stmtIns->execute();
            echo json_encode(["status" => "success", "message" => "Cajón actualizado."]);
        } else {
            echo json_encode(["status" => "error", "message" => "Error al actualizar."]);
        }
        exit;
    }

    // C. Guardar Clave Individual
    if (isset($data['numero_departamento']) && isset($data['clave_maestra'])) {
        requerir_permiso('editar_claves'); // BLOQUEO AQUÍ
        $numDep = $data['numero_departamento'];
        $clave  = $data['clave_maestra'];
        $stmt = $conn->prepare("UPDATE llaves_maestras SET clave_maestra = ? WHERE numero_departamento = ?");
        $stmt->bind_param("ss", $clave, $numDep);
        if ($stmt->execute()) {
            echo json_encode(["status" => "success", "message" => "Clave actualizada."]);
        } else {
            echo json_encode(["status" => "error", "message" => "Error al actualizar."]);
        }
        exit;
    }

    echo json_encode(["status" => "error", "message" => "Acción no reconocida."]);
}
?>