<?php
header('Content-Type: application/json; charset=utf-8');

$host = "localhost";
$user = "root";
$pass = "";
$db   = "estado_de_casa_utower";

$conn = new mysqli($host, $user, $pass, $db);
if ($conn->connect_error) {
    echo json_encode(["status" => "error", "message" => "Error de conexión: " . $conn->connect_error]);
    exit;
}
$conn->set_charset("utf8mb4");

$method = $_SERVER['REQUEST_METHOD'];
$tipo = $_GET['tipo'] ?? $_POST['tipo'] ?? 'residentes';

// Función auxiliar para normalizar fechas de Excel/CSV a formato AAAA-MM-DD de MySQL
function formatearFechaMySQL($fechaStr) {
    $fechaStr = trim($fechaStr);
    if (empty($fechaStr) || $fechaStr === '0000-00-00' || strtolower($fechaStr) === 'n/a') {
        return date('Y-m-d');
    }

    // Si viene en formato DD/MM/YYYY o DD-MM-YYYY (común en Excel en español)
    if (preg_match('/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/', $fechaStr, $m)) {
        return sprintf('%04d-%02d-%02d', $m[3], $m[2], $m[1]);
    }

    // Si ya viene en formato AAAA-MM-DD o AAAA/MM/DD
    if (preg_match('/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/', $fechaStr, $m)) {
        return sprintf('%04d-%02d-%02d', $m[1], $m[2], $m[3]);
    }

    // Si es un número serial de Excel, intentar convertirlo
    if (is_numeric($fechaStr) && intval($fechaStr) > 30000) {
        $unixDate = ($fechaStr - 25569) * 86400;
        return gmdate('Y-m-d', $unixDate);
    }

    return date('Y-m-d'); // Valor por defecto si no reconoce el formato
}

// ==================== 1. DESCARGAR PLANTILLA CSV ====================
if ($method === 'GET') {
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="Plantilla_Masiva_' . ucfirst($tipo) . '_' . date('Y-m-d') . '.csv"');
    
    $output = fopen('php://output', 'w');
    fputs($output, chr(0xEF) . chr(0xBB) . chr(0xBF)); // BOM para UTF-8 en Excel

    if ($tipo === 'residentes') {
        fputcsv($output, ['Nomenclatura', 'Nombre Completo', 'Genero', 'Fecha Move In']);
        $sql = "SELECT d.nomenclatura, COALESCE(r.nombre_completo, '') AS nombre_completo, COALESCE(r.genero, 'Masculino') AS genero, COALESCE(r.fecha_move_in, CURDATE()) AS fecha_move_in
                FROM departamentos d
                LEFT JOIN residentes r ON d.nomenclatura = r.nomenclatura
                ORDER BY d.nomenclatura ASC";
    } else {
        fputcsv($output, ['Nomenclatura', 'Numero Departamento', 'Recamara', 'Nombre Residente', 'Celular', 'Correo', 'Renta', 'Tiene Carro', 'Fecha Move In', 'Fecha Move Out']);
        $sql = "SELECT d.nomenclatura, d.numero_dep, d.recamara, COALESCE(c.nombre_residente, '') AS nombre_residente, COALESCE(c.celular, '') AS celular, COALESCE(c.correo, '') AS correo, COALESCE(c.renta, 10200) AS renta, COALESCE(c.tiene_carro, 'No') AS tiene_carro, COALESCE(c.fecha_move_in, CURDATE()) AS fecha_move_in, COALESCE(c.fecha_move_out, DATE_ADD(CURDATE(), INTERVAL 1 YEAR)) AS fecha_move_out
                FROM departamentos d
                LEFT JOIN contrato c ON d.nomenclatura = c.nomenclatura
                ORDER BY d.nomenclatura ASC";
    }

    $res = $conn->query($sql);
    if ($res) {
        while ($row = $res->fetch_assoc()) {
            fputcsv($output, array_values($row));
        }
    }

    fclose($output);
    $conn->close();
    exit;
}

// ==================== 2. PROCESAR CARGA MASIVA (POST) ====================
if ($method === 'POST') {
    if (!isset($_FILES['archivo_csv']) || $_FILES['archivo_csv']['error'] !== UPLOAD_ERR_OK) {
        echo json_encode(["status" => "error", "message" => "No se subió ningún archivo CSV válido."]);
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
        $conn->query("SET FOREIGN_KEY_CHECKS = 0");

        if ($tipo === 'residentes') {
            $conn->query("TRUNCATE TABLE residentes");
            $stmt = $conn->prepare("INSERT INTO residentes (nomenclatura, nombre_completo, genero, fecha_move_in) VALUES (?, ?, ?, ?)");
            
            $procesados = 0;
            while (($data = fgetcsv($handle, 1000, ",")) !== FALSE) {
                $nom = trim($data[0] ?? '');
                $nombre = trim($data[1] ?? '');
                $genero = trim($data[2] ?? 'Masculino');
                $moveIn = formatearFechaMySQL($data[3] ?? '');

                if (empty($nom)) continue;

                if (!empty($nombre)) {
                    $stmt->bind_param("ssss", $nom, $nombre, $genero, $moveIn);
                    $stmt->execute();
                    $procesados++;
                }
            }
            $stmt->close();
            $msg = "Carga masiva de Residentes completada. Se actualizaron $procesados registros.";

        } else {
            $conn->query("TRUNCATE TABLE contrato");
            $stmt = $conn->prepare("INSERT INTO contrato (nomenclatura, numero_departamento, recamara, nombre_residente, celular, correo, renta, tiene_carro, fecha_move_in, fecha_move_out) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
            
            $procesados = 0;
            while (($data = fgetcsv($handle, 1000, ",")) !== FALSE) {
                $nom = trim($data[0] ?? '');
                $dep = trim($data[1] ?? '101');
                $rec = trim($data[2] ?? 'A1');
                $nombre = trim($data[3] ?? '');
                $cel = trim($data[4] ?? '');
                $correo = trim($data[5] ?? '');
                $renta = floatval($data[6] ?? 0);
                $carro = trim($data[7] ?? 'No');
                $moveIn = formatearFechaMySQL($data[8] ?? '');
                $moveOut = formatearFechaMySQL($data[9] ?? '');

                if (empty($nom)) continue;

                if (!empty($nombre)) {
                    $stmt->bind_param("sssssssdss", $nom, $dep, $rec, $nombre, $cel, $correo, $renta, $carro, $moveIn, $moveOut);
                    $stmt->execute();
                    $procesados++;
                }
            }
            $stmt->close();
            $msg = "Carga masiva de Contratos completada. Se actualizaron $procesados registros.";
        }

        $conn->query("SET FOREIGN_KEY_CHECKS = 1");
        $conn->commit();
        echo json_encode(["status" => "success", "message" => $msg]);

    } catch (Exception $e) {
        $conn->rollback();
        echo json_encode(["status" => "error", "message" => "Error en procesamiento masivo: " . $e->getMessage()]);
    }

    $conn->close();
    exit;
}
?>