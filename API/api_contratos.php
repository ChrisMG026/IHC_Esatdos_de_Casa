<?php
header('Content-Type: application/json; charset=utf-8');

$host = "localhost";
$user = "root";
$pass = "";
$db   = "estado_de_casa_utower";

$conn = new mysqli($host, $user, $pass, $db);
if ($conn->connect_error) {
    die(json_encode(["status" => "error", "message" => "Conexión fallida: " . $conn->connect_error]));
}

$conn->set_charset("utf8mb4");

// OBTENER INFORMACIÓN DE VEHÍCULO / ESTACIONAMIENTO DE UNA NOMENCLATURA
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['action']) && $_GET['action'] === 'obtener_auto') {
    $nomenclatura = $_GET['nomenclatura'] ?? '';
    
    $stmt = $conn->prepare("SELECT * FROM estacionamiento WHERE nomenclatura = ? LIMIT 1");
    $stmt->bind_param("s", $nomenclatura);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($row = $result->fetch_assoc()) {
        echo json_encode(["status" => "success", "data" => $row], JSON_UNESCAPED_UNICODE);
    } else {
        echo json_encode(["status" => "success", "data" => null]);
    }
    $conn->close();
    exit;
}

// OBTENER HISTÓRICO COMBINADO (CAMBIOS DE UNIDAD Y RENOVACIONES)
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['action']) && $_GET['action'] === 'historico') {
    $nomenclatura = $_GET['nomenclatura'] ?? '';
    $residente = $_GET['residente'] ?? '';

    $stmt1 = $conn->prepare("SELECT * FROM renovacion_contrato WHERE nomenclatura_anterior = ? OR nomenclatura_nueva = ? OR residente LIKE ? ORDER BY fecha_registro DESC");
    $paramRes = "%" . $residente . "%";
    $stmt1->bind_param("sss", $nomenclatura, $nomenclatura, $paramRes);
    $stmt1->execute();
    $renovaciones = $stmt1->get_result()->fetch_all(MYSQLI_ASSOC);

    $stmt2 = $conn->prepare("SELECT * FROM cambio_unidad WHERE nomenclatura_inicial = ? OR nomenclatura_nueva = ? OR residente LIKE ? ORDER BY fecha_cambio DESC");
    $stmt2->bind_param("sss", $nomenclatura, $nomenclatura, $paramRes);
    $stmt2->execute();
    $cambios = $stmt2->get_result()->fetch_all(MYSQLI_ASSOC);

    echo json_encode([
        "status" => "success", 
        "renovaciones" => $renovaciones, 
        "cambios" => $cambios
    ], JSON_UNESCAPED_UNICODE);

    $conn->close();
    exit;
}

// PROCESAR POST (RENOVACIÓN O GESTIÓN DE VEHÍCULO)
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    $action = $data['action'] ?? '';

    // 1. RENOVACIÓN DE CONTRATO
    if ($action === 'renovar') {
        $conn->begin_transaction();
        try {
            $nomAnterior     = $data['nomenclatura_anterior'];
            $nomNueva        = $data['nomenclatura_nueva'];
            $residente       = $data['residente'];
            $nuevaFechaOut   = $data['nueva_fecha_out'];
            $fechaOutAnt     = $data['fecha_out_anterior'];
            $nuevaRenta      = floatval($data['nueva_renta']);
            $rentaAnt        = floatval($data['renta_anterior']);
            $plazo           = $data['plazo_extension'];
            $depNuevo        = $data['dep_nuevo'];
            $recamaraNueva   = $data['recamara_nueva'];

            if ($nomAnterior !== $nomNueva) {
                $stmtU1 = $conn->prepare("UPDATE residentes SET dep = ?, recamara = ?, nomenclatura = ?, renta = ? WHERE nomenclatura = ?");
                $stmtU1->bind_param("sssss", $depNuevo, $recamaraNueva, $nomNueva, $nuevaRenta, $nomAnterior);
                $stmtU1->execute();

                $stmtU2 = $conn->prepare("UPDATE estacionamiento SET nomenclatura = ? WHERE nomenclatura = ?");
                $stmtU2->bind_param("ss", $nomNueva, $nomAnterior);
                $stmtU2->execute();

                $stmtU3 = $conn->prepare("UPDATE contrato SET numero_departamento = ?, recamara = ?, nomenclatura = ?, fecha_move_out = ?, renta = ? WHERE nomenclatura = ?");
                $stmtU3->bind_param("ssssds", $depNuevo, $recamaraNueva, $nomNueva, $nuevaFechaOut, $nuevaRenta, $nomAnterior);
                $stmtU3->execute();

                $stmtB = $conn->prepare("INSERT INTO cambio_unidad (residente, nomenclatura_inicial, nomenclatura_nueva, motivo_cambio, fecha_cambio) VALUES (?, ?, ?, 'Renovación con cambio de unidad', CURDATE())");
                $stmtB->bind_param("sss", $residente, $nomAnterior, $nomNueva);
                $stmtB->execute();
            } else {
                $stmtR = $conn->prepare("UPDATE contrato SET fecha_move_out = ?, renta = ? WHERE nomenclatura = ?");
                $stmtR->bind_param("sds", $nuevaFechaOut, $nuevaRenta, $nomAnterior);
                $stmtR->execute();

                $stmtR2 = $conn->prepare("UPDATE residentes SET renta = ? WHERE nomenclatura = ?");
                $stmtR2->bind_param("ds", $nuevaRenta, $nomAnterior);
                $stmtR2->execute();
            }

            $stmtRen = $conn->prepare("INSERT INTO renovacion_contrato (residente, nomenclatura_anterior, nomenclatura_nueva, fecha_out_anterior, fecha_out_nueva, renta_anterior, renta_nueva, plazo_extension) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
            $stmtRen->bind_param("sssssdds", $residente, $nomAnterior, $nomNueva, $fechaOutAnt, $nuevaFechaOut, $rentaAnt, $nuevaRenta, $plazo);
            $stmtRen->execute();

            $conn->commit();
            echo json_encode(["status" => "success", "message" => "Renovación procesada y registrada exitosamente."]);
        } catch (Exception $e) {
            $conn->rollback();
            echo json_encode(["status" => "error", "message" => "Error al renovar: " . $e->getMessage()]);
        }
        $conn->close();
        exit;
    }

    // 2. GESTIÓN DE VEHÍCULO / CAJÓN
    if ($action === 'guardar_auto') {
        $nomenclatura = $data['nomenclatura'];
        $residente    = $data['residente'];
        $opcion       = $data['opcion_auto'];
        $motivo       = trim($data['motivo'] ?? '');

        // Validación estricta: El motivo es obligatorio
        if (empty($motivo)) {
            echo json_encode(["status" => "error", "message" => "El motivo del cambio de cajón/vehículo es obligatorio."]);
            $conn->close();
            exit;
        }

        $conn->begin_transaction();
        try {
            // Obtener datos actuales del vehículo/cajón antes de modificarlo para la bitácora
            $chkAnt = $conn->prepare("SELECT cajon, numero_tag, modelo_auto, color_auto, placas FROM estacionamiento WHERE nomenclatura = ?");
            $chkAnt->bind_param("s", $nomenclatura);
            $chkAnt->execute();
            $resAnt = $chkAnt->get_result();
            $cajonAnterior = 'Ninguno';
            $tagAnterior = '';

            if ($rowAnt = $resAnt->fetch_assoc()) {
                $cajonAnterior = $rowAnt['cajon'] ?? 'Ninguno';
                $tagAnterior = $rowAnt['numero_tag'] ?? '';
            }

            if ($opcion === 'RETIRAR') {
                $stmtD1 = $conn->prepare("DELETE FROM estacionamiento WHERE nomenclatura = ?");
                $stmtD1->bind_param("s", $nomenclatura);
                $stmtD1->execute();

                // Registrar en bitácora cambios_cajon
                $stmtBit = $conn->prepare("INSERT INTO cambios_cajon (nombre_completo, numero_tag, nomenclatura, cajon_anterior, cajon_nuevo, modelo_auto, color_auto, placas, motivo) VALUES (?, ?, ?, ?, 'Libre', '---', '---', '---', ?)");
                $stmtBit->bind_param("sssss", $residente, $tagAnterior, $nomenclatura, $cajonAnterior, $motivo);
                $stmtBit->execute();

                $msg = "Vehículo retirado y cajón liberado correctamente.";
            } else {
                $cajonNuevo = $data['cajon'];
                $modelo     = $data['modelo'];
                $color      = $data['color'];
                $tag        = $data['tag'];
                $placas     = $data['placas'];

                $chk = $conn->prepare("SELECT nomenclatura FROM estacionamiento WHERE nomenclatura = ?");
                $chk->bind_param("s", $nomenclatura);
                $chk->execute();
                $resChk = $chk->get_result();

                if ($resChk->num_rows > 0) {
                    $stmtE = $conn->prepare("UPDATE estacionamiento SET cajon = ?, numero_tag = ?, nombre_completo = ?, modelo_auto = ?, color_auto = ?, placas = ? WHERE nomenclatura = ?");
                    $stmtE->bind_param("sssssss", $cajonNuevo, $tag, $residente, $modelo, $color, $placas, $nomenclatura);
                } else {
                    $stmtE = $conn->prepare("INSERT INTO estacionamiento (cajon, numero_tag, nombre_completo, nomenclatura, modelo_auto, color_auto, placas) VALUES (?, ?, ?, ?, ?, ?, ?)");
                    $stmtE->bind_param("sssssss", $cajonNuevo, $tag, $residente, $nomenclatura, $modelo, $color, $placas);
                }
                $stmtE->execute();

                // Registrar en bitácora cambios_cajon conectando la nomenclatura correcta
                $stmtBit = $conn->prepare("INSERT INTO cambios_cajon (nombre_completo, numero_tag, nomenclatura, cajon_anterior, cajon_nuevo, modelo_auto, color_auto, placas, motivo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
                $stmtBit->bind_param("sssssssss", $residente, $tag, $nomenclatura, $cajonAnterior, $cajonNuevo, $modelo, $color, $placas, $motivo);
                $stmtBit->execute();

                $msg = "Vehículo y cajón asignados correctamente.";
            }

            $conn->commit();
            echo json_encode(["status" => "success", "message" => $msg]);
        } catch (Exception $e) {
            $conn->rollback();
            echo json_encode(["status" => "error", "message" => "Error en gestión de vehículo: " . $e->getMessage()]);
        }
        $conn->close();
        exit;
    }
}

// CONSULTA OPTIMIZADA: Todo el cálculo pesado se delega a MySQL
$sql = "SELECT 
            c.numero_departamento, 
            c.recamara, 
            c.nomenclatura, 
            c.nombre_residente, 
            c.celular, 
            c.correo, 
            c.renta, 
            CASE WHEN e.nomenclatura IS NOT NULL THEN 'Si' ELSE 'No' END as tiene_carro, 
            c.fecha_move_in, 
            c.fecha_move_out,
            IF(TIMESTAMPDIFF(MONTH, c.fecha_move_in, c.fecha_move_out) > 9, '12 meses', '6 meses') AS tipo_contrato,
            DATEDIFF(c.fecha_move_out, CURDATE()) AS dias_restantes,
            CASE 
                WHEN DATEDIFF(c.fecha_move_out, CURDATE()) < 0 THEN 'Vencido'
                WHEN DATEDIFF(c.fecha_move_out, CURDATE()) <= 30 THEN 'Por vencer'
                ELSE 'Vigente'
            END AS estado_vencimiento
        FROM contrato c
        LEFT JOIN estacionamiento e ON c.nomenclatura = e.nomenclatura
        ORDER BY CAST(c.numero_departamento AS UNSIGNED) ASC, c.nomenclatura ASC";

$result = $conn->query($sql);
$data = [];

if ($result) {
    while ($row = $result->fetch_assoc()) {
        $data[] = $row;
    }
}

echo json_encode($data, JSON_UNESCAPED_UNICODE);
$conn->close();
?>