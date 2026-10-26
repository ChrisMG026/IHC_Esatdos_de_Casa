<?php
header('Content-Type: application/json; charset=utf-8');

require_once 'config.php';
$conn = conectarDB();

// 1. CAMBIOS DE CAJÓN
$sqlCambiosCajon = "SELECT nombre_completo, numero_tag, nomenclatura, cajon_anterior, cajon_nuevo, modelo_auto, color_auto, placas, motivo, fecha_cambio FROM cambios_cajon ORDER BY fecha_cambio DESC";
$res1 = $conn->query($sqlCambiosCajon);
$cambiosCajon = $res1 ? $res1->fetch_all(MYSQLI_ASSOC) : [];

// 2. CAMBIO DE UNIDAD
$sqlCambioUnidad = "SELECT residente, nomenclatura_inicial, nomenclatura_nueva, motivo_cambio, fecha_cambio FROM cambio_unidad ORDER BY fecha_cambio DESC";
$res2 = $conn->query($sqlCambioUnidad);
$cambioUnidad = $res2 ? $res2->fetch_all(MYSQLI_ASSOC) : [];

// 3. MOVE-IN
$sqlMoveIn = "SELECT numero_departamento, tipologia, recamara, cama, nomenclatura, nombre_residente, move_in FROM move_in ORDER BY move_in DESC";
$res3 = $conn->query($sqlMoveIn);
$moveIn = $res3 ? $res3->fetch_all(MYSQLI_ASSOC) : [];

// 4. MOVE-OUT
$sqlMoveOut = "SELECT nomenclatura, nombre_residente, move_in, move_out, motivo_salida FROM move_out ORDER BY move_out DESC";
$res4 = $conn->query($sqlMoveOut);
$moveOut = $res4 ? $res4->fetch_all(MYSQLI_ASSOC) : [];

// 5. RENOVACIÓN DE CONTRATO
$sqlRenovacion = "SELECT residente, nomenclatura_anterior, nomenclatura_nueva, fecha_out_anterior, fecha_out_nueva, renta_anterior, renta_nueva, plazo_extension, fecha_registro FROM renovacion_contrato ORDER BY fecha_registro DESC";
$res5 = $conn->query($sqlRenovacion);
$renovacionContrato = $res5 ? $res5->fetch_all(MYSQLI_ASSOC) : [];

// 6. DEPARTAMENTOS DESHABILITADOS
$sqlDepsDesh = "SELECT nomenclatura, numero_dep, razon, fecha_deshabilitacion FROM departamentos_deshabilitados ORDER BY fecha_deshabilitacion DESC";
$res6 = $conn->query($sqlDepsDesh);
$departamentosDeshabilitados = $res6 ? $res6->fetch_all(MYSQLI_ASSOC) : [];

// 7. CAJONES DESHABILITADOS
$sqlCajonesDesh = "SELECT nombre_cajon, razon, fecha_deshabilitacion FROM cajones_deshabilitados ORDER BY fecha_deshabilitacion DESC";
$res7 = $conn->query($sqlCajonesDesh);
$cajonesDeshabilitados = $res7 ? $res7->fetch_all(MYSQLI_ASSOC) : [];

echo json_encode([
    "status" => "success",
    "cambios_cajon" => $cambiosCajon,
    "cambio_unidad" => $cambioUnidad,
    "move_in" => $moveIn,
    "move_out" => $moveOut,
    "renovacion_contrato" => $renovacionContrato,
    "departamentos_deshabilitados" => $departamentosDeshabilitados,
    "cajones_deshabilitados" => $cajonesDeshabilitados
], JSON_UNESCAPED_UNICODE);

$conn->close();
?>