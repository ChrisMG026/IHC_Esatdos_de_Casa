<?php
// API/api_cambio_unidad.php
// Procesa el cambio de unidad de un residente con validación de concurrencia y auditoría

header('Content-Type: application/json; charset=utf-8');

require_once 'config.php';
require_once 'auth_middleware.php';
requerir_permiso('editar_residentes');

$conn = conectarDB();

$data = json_decode(file_get_contents('php://input'), true);

if (!$data) {
    echo json_encode(["status" => "error", "message" => "Sin datos para procesar."]);
    $conn->close();
    exit;
}

$conn->begin_transaction();

try {
    $nomAnterior     = trim($data['nomenclatura_anterior'] ?? '');
    $nomNueva        = trim($data['nomenclatura_nueva'] ?? '');
    $residente       = trim($data['residente'] ?? '');
    $motivo          = trim($data['motivo_cambio'] ?? 'Cambio de unidad');
    $fechaCambio     = date('Y-m-d');
    $depNuevo        = trim($data['dep_nuevo'] ?? '');
    $recamaraNueva   = trim($data['recamara_nueva'] ?? '');
    $cambiaContrato  = $data['cambia_contrato'] ?? 'NO';
    $rentaNueva      = isset($data['renta_nueva']) ? floatval($data['renta_nueva']) : null;
    $idUsuarioSesion = (int)($_SESSION['id_usuario'] ?? 0);

    if (empty($nomAnterior) || empty($nomNueva)) {
        throw new Exception("Nomenclatura anterior y nueva son requeridas.");
    }

    // 1. Verificar si la unidad destino o anterior están bloqueadas por otro usuario
    $stmtLockCheck = $conn->prepare("SELECT nomenclatura, nombre_usuario FROM bloqueos_expedientes 
                                    WHERE (nomenclatura = ? OR nomenclatura = ?) 
                                      AND id_usuario != ? 
                                      AND ultimo_latido >= DATE_SUB(NOW(), INTERVAL 60 SECOND) LIMIT 1");
    $stmtLockCheck->bind_param("ssi", $nomAnterior, $nomNueva, $idUsuarioSesion);
    $stmtLockCheck->execute();
    $bloqueo = $stmtLockCheck->get_result()->fetch_assoc();
    $stmtLockCheck->close();

    if ($bloqueo) {
        throw new Exception("No es posible procesar el cambio: la unidad " . $bloqueo['nomenclatura'] . " está siendo modificada por " . $bloqueo['nombre_usuario'] . ".");
    }

    // 2. Verificar que la nueva unidad esté realmente disponible (FOR UPDATE para prevenir carreras)
    $stmtChkDest = $conn->prepare("SELECT nombre_completo FROM residentes WHERE nomenclatura = ? FOR UPDATE");
    $stmtChkDest->bind_param("s", $nomNueva);
    $stmtChkDest->execute();
    $resDest = $stmtChkDest->get_result();
    if ($resDest->num_rows > 0) {
        $ocupante = $resDest->fetch_assoc()['nombre_completo'];
        if ($ocupante !== $residente) {
            $stmtChkDest->close();
            throw new Exception("La unidad destino {$nomNueva} ya está ocupada por {$ocupante}.");
        }
    }
    $stmtChkDest->close();

    // 3. Actualizar residentes
    $stmt1 = $conn->prepare("UPDATE residentes SET nomenclatura = ? WHERE nomenclatura = ?");
    $stmt1->bind_param("ss", $nomNueva, $nomAnterior);
    $stmt1->execute();
    $stmt1->close();

    // 4. Actualizar contrato (NO tocar nomenclatura ya que es GENERATED ALWAYS STORED)
    if ($cambiaContrato === 'SI' && $rentaNueva !== null) {
        $stmt2 = $conn->prepare("UPDATE contrato SET numero_departamento = ?, recamara = ?, renta = ? WHERE nomenclatura = ?");
        $stmt2->bind_param("ssds", $depNuevo, $recamaraNueva, $rentaNueva, $nomAnterior);
    } else {
        $stmt2 = $conn->prepare("UPDATE contrato SET numero_departamento = ?, recamara = ? WHERE nomenclatura = ?");
        $stmt2->bind_param("sss", $depNuevo, $recamaraNueva, $nomAnterior);
    }
    $stmt2->execute();
    $stmt2->close();

    // 5. Actualizar estacionamiento si tiene
    $stmt3 = $conn->prepare("UPDATE estacionamiento SET nomenclatura = ? WHERE nomenclatura = ?");
    $stmt3->bind_param("ss", $nomNueva, $nomAnterior);
    $stmt3->execute();
    $stmt3->close();

    // 6. Registrar en bitácora cambio_unidad
    $stmt4 = $conn->prepare("INSERT INTO cambio_unidad (residente, nomenclatura_inicial, nomenclatura_nueva, motivo_cambio, fecha_cambio) VALUES (?, ?, ?, ?, ?)");
    $stmt4->bind_param("sssss", $residente, $nomAnterior, $nomNueva, $motivo, $fechaCambio);
    $stmt4->execute();
    $stmt4->close();

    // 7. Registro en logs_sistema (Auditoría)
    $ip = $_SERVER['REMOTE_ADDR'] ?? '::1';
    $accionLog = 'Cambio de Unidad';
    $detallesLog = "Se cambió al residente {$residente} de {$nomAnterior} a {$nomNueva}. Motivo: {$motivo}";
    $stmtLog = $conn->prepare("INSERT INTO logs_sistema (id_usuario, accion, detalles, ip_usuario) VALUES (?, ?, ?, ?)");
    $stmtLog->bind_param("isss", $idUsuarioSesion, $accionLog, $detallesLog, $ip);
    $stmtLog->execute();
    $stmtLog->close();

    // 8. Liberar bloqueos asociados
    $stmtRel = $conn->prepare("DELETE FROM bloqueos_expedientes WHERE (nomenclatura = ? OR nomenclatura = ?) AND id_usuario = ?");
    $stmtRel->bind_param("ssi", $nomAnterior, $nomNueva, $idUsuarioSesion);
    $stmtRel->execute();
    $stmtRel->close();

    $conn->commit();
    echo json_encode(["status" => "success", "message" => "Cambio de unidad procesado exitosamente."]);

} catch (Exception $e) {
    $conn->rollback();
    echo json_encode(["status" => "error", "message" => "Error en cambio de unidad: " . $e->getMessage()]);
}

$conn->close();
?>
