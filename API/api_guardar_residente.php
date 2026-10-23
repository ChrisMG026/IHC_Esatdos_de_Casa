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

if (!$data) {
    echo json_encode(["status" => "error", "message" => "No se recibieron datos válidos."]);
    exit;
}

$conn->begin_transaction();

try {
    $nombreCompleto = $data['nombre_completo'] ?? '';
    $genero         = $data['genero'] ?? '';
    $telefono       = $data['telefono'] ?? '';
    $correo         = $data['correo'] ?? '';
    $tieneCarro     = $data['tiene_carro'] ?? 'No';
    $deseaRegistrar = $data['desea_registrar_auto'] ?? 'NO';
    
    $dep            = $data['dep'] ?? '';
    $recamara       = $data['recamara'] ?? '';
    $cama           = $data['cama'] ?? '';
    $nomenclatura   = $data['nomenclatura'] ?? '';
    $tipologia      = $data['tipologia'] ?? '';
    $renta          = $data['renta'] ?? 0;
    $fechaMoveIn    = $data['fecha_move_in'] ?? date('Y-m-d');
    $fechaMoveOut   = $data['fecha_move_out'] ?? date('Y-m-d');

    // 1. INSERTAR EN residentes
    $stmt1 = $conn->prepare("INSERT INTO residentes (nombre_completo, genero, fecha_move_in, nomenclatura) VALUES (?, ?, ?, ?)");
    $stmt1->bind_param("ssss", $nombreCompleto, $genero, $fechaMoveIn, $nomenclatura);
    $stmt1->execute();
    $stmt1->close();

    // 2. INSERTAR EN contrato
    $stmt2 = $conn->prepare("INSERT INTO contrato (numero_departamento, recamara, nomenclatura, nombre_residente, celular, correo, renta, tiene_carro, fecha_move_in, fecha_move_out) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt2->bind_param("ssssssdsss", $dep, $recamara, $nomenclatura, $nombreCompleto, $telefono, $correo, $renta, $tieneCarro, $fechaMoveIn, $fechaMoveOut);
    $stmt2->execute();
    $stmt2->close();

    // 3. INSERTAR EN estacionamiento (SI APLICA)
    if ($deseaRegistrar === 'SI' && !empty($data['cajon'])) {
        $cajonRaw = $data['cajon']; 
        preg_match('/\d+/', $cajonRaw, $matches);
        $numeroCajon = isset($matches[0]) ? (int)$matches[0] : 0;

        $stmt3 = $conn->prepare("INSERT INTO estacionamiento (cajon, numero_tag, nombre_completo, nomenclatura, modelo_auto, color_auto, placas) VALUES (?, ?, ?, ?, ?, ?, ?)");
        $stmt3->bind_param("issssss", $numeroCajon, $data['numero_tag'], $nombreCompleto, $nomenclatura, $data['modelo_auto'], $data['color_auto'], $data['placas']);
        $stmt3->execute();
        $stmt3->close();
    }

    // 4. REGISTRO EN BITÁCORA HISTÓRICA: move_in
    $stmt4 = $conn->prepare("INSERT INTO move_in (numero_departamento, tipologia, recamara, cama, nomenclatura, nombre_residente, move_in) VALUES (?, ?, ?, ?, ?, ?, ?)");
    $stmt4->bind_param("sssssss", $dep, $tipologia, $recamara, $cama, $nomenclatura, $nombreCompleto, $fechaMoveIn);
    $stmt4->execute();
    $stmt4->close();

    $conn->commit();
    echo json_encode(["status" => "success", "message" => "Residente registrado correctamente."]);

} catch (Exception $e) {
    $conn->rollback();
    echo json_encode(["status" => "error", "message" => "Error SQL: " . $e->getMessage()]);
}

$conn->close();
?>