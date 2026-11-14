<?php
// API/api_bloqueos.php
// Sistema de concurrencia y bloqueo de expedientes (Pessimistic Locking con Heartbeat)

require_once 'config.php';
require_once 'auth_middleware.php';

header('Content-Type: application/json; charset=utf-8');

if (!isset($_SESSION['id_usuario'])) {
    http_response_code(401);
    echo json_encode(["status" => "error", "message" => "Debes iniciar sesión."]);
    exit;
}

$idUsuarioActual = (int)$_SESSION['id_usuario'];
$nombreUsuarioActual = $_SESSION['nombre'] ?? 'Otro usuario';

$conn = conectarDB();

// 1. Limpieza automática de bloqueos caducados (TTL: 60 segundos)
$conn->query("DELETE FROM bloqueos_expedientes WHERE ultimo_latido < DATE_SUB(NOW(), INTERVAL 60 SECOND)");

$metodo = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

if ($metodo === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    if ($input && isset($input['action'])) {
        $action = $input['action'];
    }
}

// ----------------------------------------------------
// ACCIÓN: LISTAR TODOS LOS BLOQUEOS ACTIVOS
// ----------------------------------------------------
if ($action === 'listar' || ($metodo === 'GET' && empty($_GET['nomenclatura']))) {
    liberar_bloqueo_sesion();
    $res = $conn->query("SELECT nomenclatura, id_usuario, nombre_usuario, fecha_bloqueo, ultimo_latido FROM bloqueos_expedientes");
    $bloqueos = [];
    if ($res) {
        while ($row = $res->fetch_assoc()) {
            $bloqueos[$row['nomenclatura']] = [
                "id_usuario" => (int)$row['id_usuario'],
                "nombre_usuario" => $row['nombre_usuario'],
                "es_propio" => ((int)$row['id_usuario'] === $idUsuarioActual)
            ];
        }
    }
    echo json_encode(["status" => "success", "bloqueos" => $bloqueos], JSON_UNESCAPED_UNICODE);
    $conn->close();
    exit;
}

// ----------------------------------------------------
// ACCIÓN: VERIFICAR ESTADO DE UN EXPEDIENTE
// ----------------------------------------------------
if ($action === 'verificar') {
    liberar_bloqueo_sesion();
    $nomenclatura = trim($_GET['nomenclatura'] ?? ($input['nomenclatura'] ?? ''));
    if (empty($nomenclatura)) {
        echo json_encode(["status" => "error", "message" => "Nomenclatura requerida."]);
        $conn->close();
        exit;
    }

    $stmt = $conn->prepare("SELECT id_usuario, nombre_usuario FROM bloqueos_expedientes WHERE nomenclatura = ? AND ultimo_latido >= DATE_SUB(NOW(), INTERVAL 60 SECOND) LIMIT 1");
    $stmt->bind_param("s", $nomenclatura);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if ($row) {
        $esPropio = ((int)$row['id_usuario'] === $idUsuarioActual);
        echo json_encode([
            "status" => "success",
            "bloqueado" => true,
            "es_propio" => $esPropio,
            "bloqueado_por" => $row['nombre_usuario'],
            "bloqueado_por_id" => (int)$row['id_usuario']
        ], JSON_UNESCAPED_UNICODE);
    } else {
        echo json_encode([
            "status" => "success",
            "bloqueado" => false,
            "es_propio" => false
        ]);
    }
    $conn->close();
    exit;
}

// ----------------------------------------------------
// ACCIÓN: BLOQUEAR EXPEDIENTE PARA EDICIÓN
// ----------------------------------------------------
if ($action === 'bloquear') {
    $nomenclatura = trim($input['nomenclatura'] ?? ($_POST['nomenclatura'] ?? ''));
    if (empty($nomenclatura)) {
        echo json_encode(["status" => "error", "message" => "Nomenclatura requerida para bloquear."]);
        $conn->close();
        exit;
    }

    // Verificar si alguien más ya lo tiene bloqueado activamente
    $stmtCheck = $conn->prepare("SELECT id_usuario, nombre_usuario FROM bloqueos_expedientes WHERE nomenclatura = ? AND id_usuario != ? AND ultimo_latido >= DATE_SUB(NOW(), INTERVAL 60 SECOND) LIMIT 1");
    $stmtCheck->bind_param("si", $nomenclatura, $idUsuarioActual);
    $stmtCheck->execute();
    $bloqueoAjeno = $stmtCheck->get_result()->fetch_assoc();
    $stmtCheck->close();

    if ($bloqueoAjeno) {
        // Está bloqueado por otro usuario
        echo json_encode([
            "status" => "locked",
            "bloqueado" => true,
            "bloqueado_por" => $bloqueoAjeno['nombre_usuario'],
            "bloqueado_por_id" => (int)$bloqueoAjeno['id_usuario'],
            "message" => "El expediente de la unidad " . $nomenclatura . " está siendo modificado actualmente por " . $bloqueoAjeno['nombre_usuario'] . ". No es posible editarlo hasta que termine."
        ], JSON_UNESCAPED_UNICODE);
        $conn->close();
        exit;
    }

    // Adquirir o renovar el bloqueo a nombre del usuario actual
    $stmtLock = $conn->prepare("INSERT INTO bloqueos_expedientes (nomenclatura, id_usuario, nombre_usuario, fecha_bloqueo, ultimo_latido) 
                                VALUES (?, ?, ?, NOW(), NOW()) 
                                ON DUPLICATE KEY UPDATE id_usuario = VALUES(id_usuario), nombre_usuario = VALUES(nombre_usuario), ultimo_latido = NOW()");
    $stmtLock->bind_param("sis", $nomenclatura, $idUsuarioActual, $nombreUsuarioActual);
    $stmtLock->execute();
    $stmtLock->close();

    echo json_encode([
        "status" => "success",
        "bloqueado" => true,
        "es_propio" => true,
        "message" => "Expediente bloqueado correctamente para edición."
    ], JSON_UNESCAPED_UNICODE);

    $conn->close();
    exit;
}

// ----------------------------------------------------
// ACCIÓN: LATIDO / HEARTBEAT (MANTENER BLOQUEO ACTIVO)
// ----------------------------------------------------
if ($action === 'heartbeat') {
    liberar_bloqueo_sesion();
    $nomenclatura = trim($input['nomenclatura'] ?? ($_POST['nomenclatura'] ?? ''));
    if (!empty($nomenclatura)) {
        $stmtBeat = $conn->prepare("UPDATE bloqueos_expedientes SET ultimo_latido = NOW() WHERE nomenclatura = ? AND id_usuario = ?");
        $stmtBeat->bind_param("si", $nomenclatura, $idUsuarioActual);
        $stmtBeat->execute();
        $filasAfectadas = $stmtBeat->affected_rows;
        $stmtBeat->close();

        if ($filasAfectadas === 0) {
            // El bloqueo ya había expirado o fue liberado; intentar recrearlo si no hay otro usuario
            $stmtRecrear = $conn->prepare("INSERT IGNORE INTO bloqueos_expedientes (nomenclatura, id_usuario, nombre_usuario, fecha_bloqueo, ultimo_latido) VALUES (?, ?, ?, NOW(), NOW())");
            $stmtRecrear->bind_param("sis", $nomenclatura, $idUsuarioActual, $nombreUsuarioActual);
            $stmtRecrear->execute();
            $stmtRecrear->close();
        }
    }

    echo json_encode(["status" => "success"]);
    $conn->close();
    exit;
}

// ----------------------------------------------------
// ACCIÓN: DESBLOQUEAR EXPEDIENTE
// ----------------------------------------------------
if ($action === 'desbloquear') {
    liberar_bloqueo_sesion();
    $nomenclatura = trim($input['nomenclatura'] ?? ($_POST['nomenclatura'] ?? ''));
    if (!empty($nomenclatura)) {
        $stmtUnlock = $conn->prepare("DELETE FROM bloqueos_expedientes WHERE nomenclatura = ? AND id_usuario = ?");
        $stmtUnlock->bind_param("si", $nomenclatura, $idUsuarioActual);
        $stmtUnlock->execute();
        $stmtUnlock->close();
    }

    echo json_encode(["status" => "success", "message" => "Expediente liberado con éxito."]);
    $conn->close();
    exit;
}

echo json_encode(["status" => "error", "message" => "Acción no reconocida."]);
$conn->close();
?>
