<?php
header('Content-Type: application/json; charset=utf-8');

$host = "localhost";
$user = "root";
$pass = "";
$db   = "estado_de_casa_utower";

$conn = new mysqli($host, $user, $pass, $db);
if ($conn->connect_error) {
    echo json_encode(["status" => "error", "message" => "Error de conexión a BD: " . $conn->connect_error]);
    exit;
}

$conn->set_charset("utf8mb4");

// Leer arreglo de nomenclaturas enviadas desde JavaScript
$inputData = file_get_contents('php://input');
$data = json_decode($inputData, true);

if (!$data || empty($data['nomenclaturas']) || !is_array($data['nomenclaturas'])) {
    echo json_encode(["status" => "error", "message" => "No se recibieron nomenclaturas válidas."]);
    exit;
}

$nomenclaturas = $data['nomenclaturas'];

// Iniciar Transacción SQL
$conn->begin_transaction();

try {
    // Preparar sentencias DELETE para cada una de las tablas
    $stmt1 = $conn->prepare("DELETE FROM residentes WHERE nomenclatura = ?");
    $stmt2 = $conn->prepare("DELETE FROM contrato WHERE nomenclatura = ?");
    $stmt3 = $conn->prepare("DELETE FROM estacionamiento WHERE nomenclatura = ?");

    foreach ($nomenclaturas as $nom) {
        $nomClean = trim($nom);
        if (!empty($nomClean)) {
            // Eliminar de residentes
            $stmt1->bind_param("s", $nomClean);
            $stmt1->execute();

            // Eliminar de contrato
            $stmt2->bind_param("s", $nomClean);
            $stmt2->execute();

            // Eliminar de estacionamiento
            $stmt3->bind_param("s", $nomClean);
            $stmt3->execute();
        }
    }

    $stmt1->close();
    $stmt2->close();
    $stmt3->close();

    // Confirmar cambios
    $conn->commit();
    echo json_encode(["status" => "success", "message" => "Move-out procesado exitosamente en la base de datos."]);

} catch (Exception $e) {
    // Revertir en caso de error
    $conn->rollback();
    echo json_encode(["status" => "error", "message" => "Error al procesar Move-out: " . $e->getMessage()]);
}

$conn->close();
?>