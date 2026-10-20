<?php
header('Content-Type: application/json; charset=utf-8');

// Configuración de conexión a MySQL
$host = "localhost";
$user = "root";
$pass = "";
$db   = "estado_de_casa_utower"; // Cambia este nombre por el nombre exacto de tu BD si difiere

$conn = new mysqli($host,$user, $pass,$db);
if ($conn->connect_error) {
    echo json_encode(["status" => "error", "message" => "Error de conexión: " . $conn->connect_error]);
    exit;
}

$conn->set_charset("utf8mb4");

// Leer el cuerpo de la petición JSON enviada desde JavaScript
$inputData = file_get_contents('php://input');
$data = json_decode($inputData, true);

if (!$data) {
    echo json_encode(["status" => "error", "message" => "Datos de entrada no válidos."]);
    exit;
}

// Iniciar Transacción SQL para asegurar integridad multitabla
$conn->begin_transaction();

try {
    // Variables extraídas
    $nombreCompleto  =$data['nombre_completo'] ?? '';
    $genero          =$data['genero'] ?? '';
    $telefono        =$data['telefono'] ?? '';
    $correo          =$data['correo'] ?? '';
    $tieneCarro      =$data['tiene_carro'] ?? 'No';
    $deseaRegistrar  =$data['desea_registrar_auto'] ?? 'NO';
    
    $dep             =$data['dep'] ?? '';
    $recamara        =$data['recamara'] ?? 'A1';
    $nomenclatura    =$data['nomenclatura'] ?? '';
    $renta           =$data['renta'] ?? 0;
    $fechaMoveIn     =$data['fecha_move_in'] ?? date('Y-m-d');
    $fechaMoveOut    =$data['fecha_move_out'] ?? date('Y-m-d');

    // 1. INSERTAR EN TABLA `residentes` (omitiendo telefono y correo)
    $stmt1 =$conn->prepare("INSERT INTO residentes (nombre_completo, genero, fecha_move_in, nomenclatura) VALUES (?, ?, ?, ?)");
    $stmt1->bind_param("ssss", $nombreCompleto,$genero, $fechaMoveIn,$nomenclatura);
    $stmt1->execute();$stmt1->close();

    // 2. INSERTAR EN TABLA `contrato` (aquí sí van telefono y correo)
    $stmt2 =$conn->prepare("INSERT INTO contrato (numero_departamento, recamara, nomenclatura, nombre_residente, celular, correo, renta, tiene_carro, fecha_move_in, fecha_move_out) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt2->bind_param("ssssssdsss", $dep,$recamara, $nomenclatura,$nombreCompleto, $telefono,$correo, $renta,$tieneCarro, $fechaMoveIn,$fechaMoveOut);
    $stmt2->execute();$stmt2->close();

    // 3. INSERTAR EN TABLA `estacionamiento` (Solo si aplica)
    if ($deseaRegistrar === 'SI' && !empty($data['cajon'])) {
        $cajonRaw   =$data['cajon']; 
        // Extraer número de cajón limpia (ej. "Cajón 12" -> "12")
        preg_match('/\d+/', $cajonRaw, $matches);$numeroCajon = isset($matches[0]) ? (int)$matches[0] : 0;

        $numeroTag  =$data['numero_tag'] ?? '';
        $modeloAuto =$data['modelo_auto'] ?? '';
        $colorAuto  =$data['color_auto'] ?? '';
        $placas     =$data['placas'] ?? '';

        $stmt3 =$conn->prepare("INSERT INTO estacionamiento (cajon, numero_tag, nombre_completo, nomenclatura, modelo_auto, color_auto, placas) VALUES (?, ?, ?, ?, ?, ?, ?)");
        $stmt3->bind_param("issssss", $numeroCajon, $numeroTag,$nombreCompleto, $nomenclatura,$modeloAuto, $colorAuto,$placas);
        $stmt3->execute();$stmt3->close();
    }

    // Confirmar la transacción
    $conn->commit();
    echo json_encode(["status" => "success", "message" => "Residente registrado exitosamente en la base de datos."]);

} catch (Exception $e) {
    // Deshacer cambios si ocurre un error en cualquiera de los inserts
    $conn->rollback();
    echo json_encode(["status" => "error", "message" => "Error al guardar: " . $e->getMessage()]);
}

$conn->close();
?>