<?php
require_once 'config.php';
require_once 'auth_middleware.php';
requerir_permiso('editar_residentes');

header('Content-Type: application/json; charset=utf-8');

$conn = conectarDB();
$inputData = file_get_contents('php://input');
$data = json_decode($inputData, true);

if (!$data) {
    echo json_encode(["status" => "error", "message" => "No se recibieron datos válidos."]);
    exit;
}

$conn->begin_transaction();

try {
    // 1. RECOLECCIÓN Y LIMPIEZA DE DATOS
    $nombreCompleto = trim($data['nombre_completo'] ?? '');
    $genero         = trim($data['genero'] ?? '');
    $correo         = trim($data['correo'] ?? '');
    $tieneCarro     = $data['tiene_carro'] ?? 'No';
    $deseaRegistrar = $data['desea_registrar_auto'] ?? 'NO';
    
    // Variables del contrato
    $dep            = trim($data['dep'] ?? '');
    $recamara       = trim($data['recamara'] ?? '');
    $cama           = trim($data['cama'] ?? '');
    $nomenclatura   = trim($data['nomenclatura'] ?? '');
    $tipologia      = trim($data['tipologia'] ?? 'twin');
    $renta          = floatval($data['renta'] ?? 0);
    $fechaMoveIn    = trim($data['fecha_move_in'] ?? '');
    $fechaMoveOut   = trim($data['fecha_move_out'] ?? '');
    
    $esEdicion      = $data['es_edicion'] ?? false;

    // 2. VALIDACIÓN DE TELÉFONO (Solo números, mín. 10 dígitos)
    $telefonoRaw = trim($data['telefono'] ?? '');
    $telefono = preg_replace('/[^0-9]/', '', $telefonoRaw); 
    
    if (strlen($telefono) < 10) {
        throw new Exception("El teléfono debe contener al menos 10 números.");
    }

    // 3. VALIDACIONES CONDICIONALES Y RESCATE DE DATOS
    if ($esEdicion) {
        // Si es EDICIÓN, verificamos si nos enviaron los datos del contrato.
        // Si vienen vacíos (porque el usuario no cambió de pestaña), los buscamos en la BD.
        if (empty($dep) || empty($nomenclatura) || empty($fechaMoveIn) || empty($fechaMoveOut) || $renta <= 0) {
            $stmtBusq = $conn->prepare("SELECT numero_departamento, nomenclatura, recamara, fecha_move_in, fecha_move_out, renta, tipologia FROM contrato WHERE nombre_residente = ? LIMIT 1");
            $stmtBusq->bind_param("s", $nombreCompleto);
            $stmtBusq->execute();
            $resBusq = $stmtBusq->get_result()->fetch_assoc();
            
            if ($resBusq) {
                $dep = $resBusq['numero_departamento'];
                $nomenclatura = $resBusq['nomenclatura'];
                $recamara = $resBusq['recamara'];
                $fechaMoveIn = $resBusq['fecha_move_in'];
                $fechaMoveOut = $resBusq['fecha_move_out'];
                $renta = floatval($resBusq['renta']);
                $tipologia = $resBusq['tipologia'];
            }
            $stmtBusq->close();
        }
    } else {
        // Si es NUEVO, exigimos obligatoriamente todo
        if (empty($nombreCompleto) || empty($dep) || empty($nomenclatura) || $renta <= 0 || empty($fechaMoveIn) || empty($fechaMoveOut)) {
            throw new Exception("Faltan datos obligatorios. Asegúrate de llenar el nombre, departamento, renta y fechas.");
        }

        $fechaIn = new DateTime($fechaMoveIn);
        $fechaOut = new DateTime($fechaMoveOut);

        if ($fechaOut <= $fechaIn) {
            throw new Exception("La fecha de Move-Out debe ser posterior a la de Move-In.");
        }
    }

    if (empty($nomenclatura)) {
        throw new Exception("La nomenclatura no puede estar vacía.");
    }
    if ($renta <= 0) {
        throw new Exception("La renta debe ser un número mayor a 0.");
    }

    // 4. VERIFICAR BLOQUEO POR OTRO USUARIO (CONCURRENCIA)
    $idUsuarioSesion = (int)($_SESSION['id_usuario'] ?? 0);
    $stmtLockCheck = $conn->prepare("SELECT nombre_usuario FROM bloqueos_expedientes WHERE nomenclatura = ? AND id_usuario != ? AND ultimo_latido >= DATE_SUB(NOW(), INTERVAL 60 SECOND) LIMIT 1");
    $stmtLockCheck->bind_param("si", $nomenclatura, $idUsuarioSesion);
    $stmtLockCheck->execute();
    $lockResult = $stmtLockCheck->get_result()->fetch_assoc();
    $stmtLockCheck->close();

    if ($lockResult) {
        throw new Exception("No es posible guardar: el expediente de {$nomenclatura} está siendo modificado actualmente por {$lockResult['nombre_usuario']}.");
    }

    // 5. VALIDAR DOBLE RESERVA (CON BLOQUEO FOR UPDATE)
    $chkDisp = $conn->prepare("SELECT nombre_completo FROM residentes WHERE nomenclatura = ? FOR UPDATE");
    $chkDisp->bind_param("s", $nomenclatura);
    $chkDisp->execute();
    $resDisp = $chkDisp->get_result();
    
    if ($resDisp->num_rows > 0 && !$esEdicion) {
        $ocupante = $resDisp->fetch_assoc()['nombre_completo'];
        if ($ocupante !== $nombreCompleto) {
            throw new Exception("La unidad {$nomenclatura} ya está ocupada por {$ocupante}.");
        }
    }
    $chkDisp->close();

    // 5. ACTUALIZAR O INSERTAR
    $chk = $conn->prepare("SELECT id_residente FROM residentes WHERE nomenclatura = ?");
    $chk->bind_param("s", $nomenclatura);
    $chk->execute();
    $existeResidente = $chk->get_result()->num_rows > 0;
    $chk->close();

    if ($esEdicion || $existeResidente) {
        // --- ACTUALIZAR REGISTROS EXISTENTES ---
        $stmt1 = $conn->prepare("UPDATE residentes SET nombre_completo = ?, genero = ? WHERE nomenclatura = ?");
        $stmt1->bind_param("sss", $nombreCompleto, $genero, $nomenclatura);
        $stmt1->execute();
        $stmt1->close();

        $chkC = $conn->prepare("SELECT id_contrato FROM contrato WHERE nomenclatura = ?");
        $chkC->bind_param("s", $nomenclatura);
        $chkC->execute();
        $existeContrato = $chkC->get_result()->num_rows > 0;
        $chkC->close();

        if ($existeContrato) {
            // Actualizamos el contrato existente
            $stmt2 = $conn->prepare("UPDATE contrato SET nombre_residente = ?, celular = ?, correo = ?, tiene_carro = ? WHERE nomenclatura = ?");
            $stmt2->bind_param("sssss", $nombreCompleto, $telefono, $correo, $tieneCarro, $nomenclatura);
            $stmt2->execute();
            $stmt2->close();
        } else {
            // Si NO existe el contrato (estaba "Sin Contrato"), lo creamos ahora
            // Usamos los datos que vienen del formulario (o valores por defecto si vienen vacíos)
            $depVal = !empty($dep) ? $dep : explode('-', $nomenclatura)[0]; // Si no hay dep, lo sacamos de la nomenclatura
            $recVal = !empty($recamara) ? $recamara : 'A1';
            $rentaVal = $renta > 0 ? $renta : 10200.00; // Renta por defecto si no pusieron nada
            $fechaInVal = !empty($fechaMoveIn) ? $fechaMoveIn : date('Y-m-d');
            $fechaOutVal = !empty($fechaMoveOut) ? $fechaMoveOut : date('Y-m-d', strtotime('+1 year'));

            $stmt2 = $conn->prepare("INSERT INTO contrato (numero_departamento, recamara, nombre_residente, celular, correo, renta, tiene_carro, fecha_move_in, fecha_move_out) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
            $stmt2->bind_param("issssdsss", $depVal, $recVal, $nombreCompleto, $telefono, $correo, $rentaVal, $tieneCarro, $fechaInVal, $fechaOutVal);
            $stmt2->execute();
            $stmt2->close();
        }

        // ========================================================
        // NUEVO: ACTUALIZAR ESTACIONAMIENTO EN MODO EDICIÓN
        // ========================================================
        $stmtDelEst = $conn->prepare("DELETE FROM estacionamiento WHERE nomenclatura = ?");
        $stmtDelEst->bind_param("s", $nomenclatura);
        $stmtDelEst->execute();
        $stmtDelEst->close();

        if (!empty($data['cajon']) && $data['cajon'] !== '') {
            $cajonRaw = $data['cajon']; 
            preg_match('/\d+/', $cajonRaw, $matches);
            $numeroCajon = isset($matches[0]) ? (int)$matches[0] : 0;

            if ($numeroCajon > 0) {
                $stmtEst = $conn->prepare("INSERT INTO estacionamiento (cajon, numero_tag, nombre_completo, nomenclatura, modelo_auto, color_auto, placas) VALUES (?, ?, ?, ?, ?, ?, ?)");
                $tagVal = $data['numero_tag'] ?? '---';
                $modVal = $data['modelo_auto'] ?? '---';
                $colVal = $data['color_auto'] ?? '---';
                $plaVal = $data['placas'] ?? '---';
                
                $stmtEst->bind_param("issssss", $numeroCajon, $tagVal, $nombreCompleto, $nomenclatura, $modVal, $colVal, $plaVal);
                $stmtEst->execute();
                $stmtEst->close();
            }
        }
        // ========================================================

        $msg = "Expediente actualizado correctamente.";
    } else {
          // --- INSERTAR NUEVO RESIDENTE Y CONTRATO ---
        $stmt1 = $conn->prepare("INSERT INTO residentes (nombre_completo, genero, fecha_move_in, nomenclatura) VALUES (?, ?, ?, ?)");
        $stmt1->bind_param("ssss", $nombreCompleto, $genero, $fechaMoveIn, $nomenclatura);
        $stmt1->execute();
        $stmt1->close();

        $stmt2 = $conn->prepare("INSERT INTO contrato (numero_departamento, recamara, nombre_residente, celular, correo, renta, tiene_carro, fecha_move_in, fecha_move_out) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt2->bind_param("issssdsss", $dep, $recamara, $nombreCompleto, $telefono, $correo, $renta, $tieneCarro, $fechaMoveIn, $fechaMoveOut);
        $stmt2->execute();
        $stmt2->close();

      if ($deseaRegistrar === 'SI' && !empty($data['cajon'])) {
            $nombreCajon = $data['cajon']; 
            $stmt3 = $conn->prepare("INSERT INTO estacionamiento (cajon, numero_tag, nombre_completo, nomenclatura, modelo_auto, color_auto, placas) VALUES (?, ?, ?, ?, ?, ?, ?)");
            $stmt3->bind_param("sssssss", $nombreCajon, $data['numero_tag'], $nombreCompleto, $nomenclatura, $data['modelo_auto'], $data['color_auto'], $data['placas']);
            $stmt3->execute();
            $stmt3->close();
        }

        $stmt4 = $conn->prepare("INSERT INTO move_in (numero_departamento, tipologia, recamara, cama, nomenclatura, nombre_residente, move_in) VALUES (?, ?, ?, ?, ?, ?, ?)");
        $stmt4->bind_param("sssssss", $dep, $tipologia, $recamara, $cama, $nomenclatura, $nombreCompleto, $fechaMoveIn);
        $stmt4->execute();
        $stmt4->close();

        $msg = "Residente registrado correctamente.";
    }

    // --- REGISTRO DE AUDITORÍA ---
    $ip = $_SERVER['REMOTE_ADDR'];
    $accionLog = $esEdicion ? 'Editar Residente' : 'Nuevo Move-In';
    $detallesLog = "Se " . ($esEdicion ? "editó" : "registró") . " el expediente de: " . $nombreCompleto . " en la unidad " . $nomenclatura;
            
    $stmtLog = $conn->prepare("INSERT INTO logs_sistema (id_usuario, accion, detalles, ip_usuario) VALUES (?, ?, ?, ?)");
    $stmtLog->bind_param("isss", $_SESSION['id_usuario'], $accionLog, $detallesLog, $ip);
    $stmtLog->execute();
    // -----------------------------

    $conn->commit();

    // Liberar bloqueo si este usuario lo tenía activo
    if (!empty($nomenclatura) && $idUsuarioSesion > 0) {
        $stmtRelLock = $conn->prepare("DELETE FROM bloqueos_expedientes WHERE nomenclatura = ? AND id_usuario = ?");
        $stmtRelLock->bind_param("si", $nomenclatura, $idUsuarioSesion);
        $stmtRelLock->execute();
        $stmtRelLock->close();
    }

    echo json_encode(["status" => "success", "message" => $msg]);

} catch (Exception $e) {
    $conn->rollback();
    echo json_encode(["status" => "error", "message" => "Error: " . $e->getMessage()]);
}

$conn->close();
?>