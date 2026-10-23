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

$inputData = file_get_contents('php://input');
$data = json_decode($inputData, true);

if (!$data || empty($data['registros']) || !is_array($data['registros'])) {
    echo json_encode(["status" => "error", "message" => "Datos de salida no válidos."]);
    exit;
}

$conn->begin_transaction();

try {
    $stmtSelect = $conn->prepare("SELECT COALESCE(c.nombre_residente, r.nombre_completo) as nombre, COALESCE(c.fecha_move_in, r.fecha_move_in) as move_in FROM residentes r LEFT JOIN contrato c ON r.nomenclatura = c.nomenclatura WHERE r.nomenclatura = ?");
    $stmtInsertHist = $conn->prepare("INSERT INTO move_out (nomenclatura, nombre_residente, move_in, move_out, motivo_salida) VALUES (?, ?, ?, ?, ?)");
    
    $stmtDel1 = $conn->prepare("DELETE FROM residentes WHERE nomenclatura = ?");
    $stmtDel2 = $conn->prepare("DELETE FROM contrato WHERE nomenclatura = ?");
    $stmtDel3 = $conn->prepare("DELETE FROM estacionamiento WHERE nomenclatura = ?");

    $fechaHoy = date('Y-m-d');

    foreach ($data['registros'] as $item) {
        $nom = trim($item['nomenclatura']);
        $motivo = trim($item['motivo_salida'] ?? 'Fin de contrato / Salida regular');

        if (!empty($nom)) {
            // A. Buscar información actual
            $stmtSelect->bind_param("s", $nom);
            $stmtSelect->execute();
            $res = $stmtSelect->get_result()->fetch_assoc();

            $nombreRes = $res['nombre'] ?? 'Desconocido';
            $moveInDate = $res['move_in'] ?? $fechaHoy;

            // B. Guardar en bitácora move_out
            $stmtInsertHist->bind_param("sssss", $nom, $nombreRes, $moveInDate, $fechaHoy, $motivo);
            $stmtInsertHist->execute();

            // C. Eliminar de las 3 tablas activas
            $stmtDel1->bind_param("s", $nom); $stmtDel1->execute();
            $stmtDel2->bind_param("s", $nom); $stmtDel2->execute();
            $stmtDel3->bind_param("s", $nom); $stmtDel3->execute();
        }
    }

    $conn->commit();
    echo json_encode(["status" => "success", "message" => "Salida registrada con éxito."]);

} catch (Exception $e) {
    $conn->rollback();
    echo json_encode(["status" => "error", "message" => "Error al procesar salida: " . $e->getMessage()]);
}

$conn->close();
?>