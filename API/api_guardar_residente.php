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
    $nombreCompleto = trim($data['nombre_completo'] ?? '');
    $genero         = trim($data['genero'] ?? '');
    $telefono       = trim($data['telefono'] ?? '');
    $correo         = trim($data['correo'] ?? '');
    $tieneCarro     = $data['tiene_carro'] ?? 'No';
    $deseaRegistrar = $data['desea_registrar_auto'] ?? 'NO';
    
    $dep            = trim($data['dep'] ?? '');
    $recamara       = trim($data['recamara'] ?? '');
    $cama           = trim($data['cama'] ?? '');
    $nomenclatura   = trim($data['nomenclatura'] ?? '');
    $tipologia      = trim($data['tipologia'] ?? 'twin');
    $renta          = floatval($data['renta'] ?? 0);
    $fechaMoveIn    = $data['fecha_move_in'] ?? date('Y-m-d');
    $fechaMoveOut   = $data['fecha_move_out'] ?? date('Y-m-d');
    $esEdicion      = $data['es_edicion'] ?? false;

    // Si la nomenclatura llegó vacía pero es edición, la recuperamos mediante el nombre actual
    if (empty($nomenclatura) && !empty($nombreCompleto)) {
        $stmtBusq = $conn->prepare("SELECT nomenclatura FROM residentes WHERE nombre_completo = ? LIMIT 1");
        $stmtBusq->bind_param("s", $nombreCompleto);
        $stmtBusq->execute();
        $resBusq = $stmtBusq->get_result()->fetch_assoc();
        if ($resBusq) {
            $nomenclatura = $resBusq['nomenclatura'];
        }
        $stmtBusq->close();
    }

    if (empty($nomenclatura)) {
        throw new Exception("La nomenclatura no puede estar vacía.");
    }

    // Comprobar si ya existe un registro para esta nomenclatura
    $chk = $conn->prepare("SELECT id_residente FROM residentes WHERE nomenclatura = ?");
    $chk->bind_param("s", $nomenclatura);
    $chk->execute();
    $existeResidente = $chk->get_result()->num_rows > 0;
    $chk->close();

    if ($esEdicion || $existeResidente) {
        // ACTUALIZAR REGISTROS EXISTENTES
        $stmt1 = $conn->prepare("UPDATE residentes SET nombre_completo = ?, genero = ? WHERE nomenclatura = ?");
        $stmt1->bind_param("sss", $nombreCompleto, $genero, $nomenclatura);
        $stmt1->execute();
        $stmt1->close();

        // Verificar si existe el contrato antes de actualizar o insertar
        $chkC = $conn->prepare("SELECT id_contrato FROM contrato WHERE nomenclatura = ?");
        $chkC->bind_param("s", $nomenclatura);
        $chkC->execute();
        $existeContrato = $chkC->get_result()->num_rows > 0;
        $chkC->close();

        if ($existeContrato) {
            $stmt2 = $conn->prepare("UPDATE contrato SET numero_departamento = ?, recamara = ?, nombre_residente = ?, celular = ?, correo = ?, renta = ?, tiene_carro = ? WHERE nomenclatura = ?");
            $stmt2->bind_param("sssssdss", $dep, $recamara, $nombreCompleto, $telefono, $correo, $renta, $tieneCarro, $nomenclatura);
            $stmt2->execute();
            $stmt2->close();
        } else {
            $stmt2 = $conn->prepare("INSERT INTO contrato (numero_departamento, recamara, nomenclatura, nombre_residente, celular, correo, renta, tiene_carro, fecha_move_in, fecha_move_out) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
            $stmt2->bind_param("ssssssdsss", $dep, $recamara, $nomenclatura, $nombreCompleto, $telefono, $correo, $renta, $tieneCarro, $fechaMoveIn, $fechaMoveOut);
            $stmt2->execute();
            $stmt2->close();
        }

        $msg = "Expediente actualizado correctamente.";
    } else {
        // INSERTAR NUEVO RESIDENTE Y CONTRATO
        $stmt1 = $conn->prepare("INSERT INTO residentes (nombre_completo, genero, fecha_move_in, nomenclatura) VALUES (?, ?, ?, ?)");
        $stmt1->bind_param("ssss", $nombreCompleto, $genero, $fechaMoveIn, $nomenclatura);
        $stmt1->execute();
        $stmt1->close();

        $stmt2 = $conn->prepare("INSERT INTO contrato (numero_departamento, recamara, nomenclatura, nombre_residente, celular, correo, renta, tiene_carro, fecha_move_in, fecha_move_out) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt2->bind_param("ssssssdsss", $dep, $recamara, $nomenclatura, $nombreCompleto, $telefono, $correo, $renta, $tieneCarro, $fechaMoveIn, $fechaMoveOut);
        $stmt2->execute();
        $stmt2->close();

        if ($deseaRegistrar === 'SI' && !empty($data['cajon'])) {
            $cajonRaw = $data['cajon']; 
            preg_match('/\d+/', $cajonRaw, $matches);
            $numeroCajon = isset($matches[0]) ? (int)$matches[0] : 0;

            $stmt3 = $conn->prepare("INSERT INTO estacionamiento (cajon, numero_tag, nombre_completo, nomenclatura, modelo_auto, color_auto, placas) VALUES (?, ?, ?, ?, ?, ?, ?)");
            $stmt3->bind_param("issssss", $numeroCajon, $data['numero_tag'], $nombreCompleto, $nomenclatura, $data['modelo_auto'], $data['color_auto'], $data['placas']);
            $stmt3->execute();
            $stmt3->close();
        }

        $stmt4 = $conn->prepare("INSERT INTO move_in (numero_departamento, tipologia, recamara, cama, nomenclatura, nombre_residente, move_in) VALUES (?, ?, ?, ?, ?, ?, ?)");
        $stmt4->bind_param("sssssss", $dep, $tipologia, $recamara, $cama, $nomenclatura, $nombreCompleto, $fechaMoveIn);
        $stmt4->execute();
        $stmt4->close();

        $msg = "Residente registrado correctamente.";
    }

    $conn->commit();
    echo json_encode(["status" => "success", "message" => $msg]);

} catch (Exception $e) {
    $conn->rollback();
    echo json_encode(["status" => "error", "message" => "Error SQL: " . $e->getMessage()]);
}

$conn->close();
?>