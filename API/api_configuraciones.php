<?php

require_once 'auth_middleware.php';
requerir_permiso('editar_claves');

header('Content-Type: application/json; charset=utf-8');

require_once 'config.php';
$conn = conectarDB();

$method = $_SERVER['REQUEST_METHOD'];

// ==================== PETICIÓN GET (CARGAR DATOS) ====================
if ($method === 'GET') {
    // 1. Obtener Llaves Maestras
    $sqlLlaves = "SELECT numero_departamento, nivel, tipologia, clave_maestra FROM llaves_maestras ORDER BY CAST(numero_departamento AS UNSIGNED) ASC";
    $resLlaves = $conn->query($sqlLlaves);
    $llaves = [];
    if ($resLlaves) {
        while ($row = $resLlaves->fetch_assoc()) {
            $llaves[] = $row;
        }
    }

    // 2. Obtener Departamentos
    $sqlDeps = "SELECT nivel, numero_dep, tipologia, recamara, cama, nomenclatura, estado 
                FROM departamentos 
                ORDER BY 
                    FIELD(nivel, 'PB', 'N1', 'N2', 'N3', 'N4', 'N5', 'N6', 'N7', 'N8', 'N9', 'N10', 'N11', 'N12', 'N13', 'N14', 'N15'), 
                    CAST(numero_dep AS UNSIGNED) ASC, 
                    recamara ASC, 
                    cama ASC";
    $resDeps = $conn->query($sqlDeps);
    $departamentos = [];
    if ($resDeps) {
        while ($row = $resDeps->fetch_assoc()) {
            $departamentos[] = $row;
        }
    }

    // 3. Obtener Cajones de Estacionamiento
    $sqlCajones = "SELECT nombre_cajon, estado 
                   FROM cajones_estacionamiento 
                   ORDER BY 
                       CASE WHEN nombre_cajon REGEXP '^[0-9]+$' THEN 0 ELSE 1 END,
                       CAST(nombre_cajon AS UNSIGNED) ASC, 
                       nombre_cajon ASC";
    $resCajones = $conn->query($sqlCajones);
    $cajones = [];
    if ($resCajones) {
        while ($row = $resCajones->fetch_assoc()) {
            $cajones[] = $row;
        }
    }

    echo json_encode([
        "status" => "success",
        "llaves" => $llaves,
        "departamentos" => $departamentos,
        "cajones" => $cajones
    ], JSON_UNESCAPED_UNICODE);
    
    $conn->close();
    exit;
}

// ==================== PETICIÓN POST (ACCIONES) ====================
if ($method === 'POST') {
    // ====================================================
    // NUEVO: PROCESAR CARGA MASIVA DE CLAVES (CSV)
    // ====================================================
    if (isset($_POST['accion']) && $_POST['accion'] === 'subir_csv_claves') {
        requerir_permiso('editar_claves'); // Doble check de seguridad
        
        if (!isset($_FILES['archivo_csv']) || $_FILES['archivo_csv']['error'] !== UPLOAD_ERR_OK) {
            echo json_encode(["status" => "error", "message" => "No se recibió ningún archivo válido."]);
            exit;
        }

        $fileTmpPath = $_FILES['archivo_csv']['tmp_name'];
        $handle = fopen($fileTmpPath, 'r');

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
                $numDep = trim($data[0] ?? ''); // Primera columna: numero_departamento
                $clave  = trim($data[3] ?? ''); // Cuarta columna: clave_maestra

                if (!empty($numDep) && !empty($clave)) {
                    $stmt->bind_param("ss", $clave, $numDep);
                    $stmt->execute();
                    $procesados++;
                }
            }
            $stmt->close();
            $conn->commit();

            echo json_encode(["status" => "success", "message" => "Carga masiva completada. Se actualizaron $procesados claves."]);
        } catch (Exception $e) {
            $conn->rollback();
            echo json_encode(["status" => "error", "message" => "Error en la BD: " . $e->getMessage()]);
        }
        
        fclose($handle);
        $conn->close();
        exit;
    }

    $inputJSON = file_get_contents('php://input');
    $data = json_decode($inputJSON, true);

    $accion = $data['accion'] ?? '';

    // A. Habilitar / Deshabilitar Departamento
    if ($accion === 'toggle_estado_dep') {
        $nomenclatura = $data['nomenclatura'] ?? '';
        $nuevoEstado  = $data['estado'] ?? '';
        $razon        = trim($data['razon'] ?? '');

        if (empty($nomenclatura) || empty($razon)) {
            echo json_encode(["status" => "error", "message" => "Faltan datos obligatorios (nomenclatura o razón)."]);
            exit;
        }

        $stmt = $conn->prepare("UPDATE departamentos SET estado = ? WHERE nomenclatura = ?");
        $stmt->bind_param("ss", $nuevoEstado, $nomenclatura);
        if ($stmt->execute()) {
            $stmt->close();

            $stmtIns = $conn->prepare("INSERT INTO departamentos_deshabilitados (nomenclatura, numero_dep, razon) VALUES (?, ?, ?)");
            $numDep = explode('-', $nomenclatura)[0];
            $razonRegistro = "[$nuevoEstado] " . $razon;
            $stmtIns->bind_param("sss", $nomenclatura, $numDep, $razonRegistro);
            $stmtIns->execute();
            $stmtIns->close();

            echo json_encode(["status" => "success", "message" => "El departamento se actualizó a '$nuevoEstado' correctamente."]);
        } else {
            echo json_encode(["status" => "error", "message" => "Error al actualizar el departamento en la base de datos."]);
        }
        $conn->close();
        exit;
    }

    // B. Habilitar / Deshabilitar Cajón de Estacionamiento
    if ($accion === 'toggle_estado_cajon') {
        $nombreCajon = $data['nombre_cajon'] ?? '';
        $nuevoEstado = $data['estado'] ?? '';
        $razon       = trim($data['razon'] ?? '');

        if (empty($nombreCajon) || empty($razon)) {
            echo json_encode(["status" => "error", "message" => "Faltan datos obligatorios (cajón o razón)."]);
            exit;
        }

        $stmt = $conn->prepare("UPDATE cajones_estacionamiento SET estado = ? WHERE nombre_cajon = ?");
        $stmt->bind_param("ss", $nuevoEstado, $nombreCajon);
        if ($stmt->execute()) {
            $stmt->close();

            $stmtIns = $conn->prepare("INSERT INTO cajones_deshabilitados (nombre_cajon, razon) VALUES (?, ?)");
            $razonRegistro = "[$nuevoEstado] " . $razon;
            $stmtIns->bind_param("ss", $nombreCajon, $razonRegistro);
            $stmtIns->execute();
            $stmtIns->close();

            echo json_encode(["status" => "success", "message" => "El cajón se actualizó a '$nuevoEstado' correctamente."]);
        } else {
            echo json_encode(["status" => "error", "message" => "Error al actualizar el cajón en la base de datos."]);
        }
        $conn->close();
        exit;
    }

    // C. Guardar Clave Maestra Individual
    if (isset($data['numero_departamento']) && isset($data['clave_maestra'])) {
        $numDep = $data['numero_departamento'];
        $clave  = $data['clave_maestra'];

        $stmt = $conn->prepare("UPDATE llaves_maestras SET clave_maestra = ? WHERE numero_departamento = ?");
        $stmt->bind_param("ss", $clave, $numDep);
        if ($stmt->execute()) {
            echo json_encode(["status" => "success", "message" => "Clave maestra actualizada correctamente."]);
        } else {
            echo json_encode(["status" => "error", "message" => "Error al actualizar la clave maestra."]);
        }
        $stmt->close();
        $conn->close();
        exit;
    }

    echo json_encode(["status" => "error", "message" => "Acción no reconocida."]);
    $conn->close();
}
?>