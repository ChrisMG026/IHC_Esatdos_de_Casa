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

$data = json_decode(file_get_contents('php://input'), true);

if (!$data) {
    echo json_encode(["status" => "error", "message" => "Sin datos para procesar."]);
    exit;
}

$conn->begin_transaction();

try {
    $nomAnterior     = $data['nomenclatura_anterior'];
    $nomNueva        = $data['nomenclatura_nueva'];
    $residente       = $data['residente'];
    $motivo          = $data['motivo_cambio'];
    $fechaCambio     = date('Y-m-d');
    $depNuevo        = $data['dep_nuevo'];
    $recamaraNueva   = $data['recamara_nueva'];
    $cambiaContrato  = $data['cambia_contrato'] ?? 'NO';
    $rentaNueva      = $data['renta_nueva'] ?? null;

    // 1. Actualizar residentes
    $stmt1 = $conn->prepare("UPDATE residentes SET nomenclatura = ? WHERE nomenclatura = ?");
    $stmt1->bind_param("ss", $nomNueva, $nomAnterior);
    $stmt1->execute();

    // 2. Actualizar contrato
    if ($cambiaContrato === 'SI' && $rentaNueva !== null) {
        $stmt2 = $conn->prepare("UPDATE contrato SET nomenclatura = ?, numero_departamento = ?, recamara = ?, renta = ? WHERE nomenclatura = ?");
        $stmt2->bind_param("sssds", $nomNueva, $depNuevo, $recamaraNueva, $rentaNueva, $nomAnterior);
    } else {
        $stmt2 = $conn->prepare("UPDATE contrato SET nomenclatura = ?, numero_departamento = ?, recamara = ? WHERE nomenclatura = ?");
        $stmt2->bind_param("ssss", $nomNueva, $depNuevo, $recamaraNueva, $nomAnterior);
    }
    $stmt2->execute();

    // 3. Actualizar estacionamiento si tiene
    $stmt3 = $conn->prepare("UPDATE estacionamiento SET nomenclatura = ? WHERE nomenclatura = ?");
    $stmt3->bind_param("ss", $nomNueva, $nomAnterior);
    $stmt3->execute();

    // 4. Registrar en bitácora cambio_unidad usando nomenclatura_inicial y nomenclatura_nueva
    $stmt4 = $conn->prepare("INSERT INTO cambio_unidad (residente, nomenclatura_inicial, nomenclatura_nueva, motivo_cambio, fecha_cambio) VALUES (?, ?, ?, ?, ?)");
    $stmt4->bind_param("sssss", $residente, $nomAnterior, $nomNueva, $motivo, $fechaCambio);
    $stmt4->execute();

    $conn->commit();
    echo json_encode(["status" => "success", "message" => "Cambio de unidad procesado exitosamente."]);

} catch (Exception $e) {
    $conn->rollback();
    echo json_encode(["status" => "error", "message" => "Error en cambio de unidad: " . $e->getMessage()]);
}

$conn->close();
?>