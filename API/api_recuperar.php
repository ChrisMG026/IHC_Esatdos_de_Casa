<?php
header('Content-Type: application/json; charset=utf-8');
require_once 'config.php';
$conn = conectarDB();

$input = json_decode(file_get_contents('php://input'), true);
$accion = $input['accion'] ?? '';
$username = trim($input['username'] ?? '');

if (empty($username)) {
    echo json_encode(["status" => "error", "message" => "El usuario es obligatorio."]);
    exit;
}

// PASO 1: BUSCAR PREGUNTA
if ($accion === 'buscar') {
    $stmt = $conn->prepare("SELECT pregunta_seguridad FROM usuarios WHERE username = ? AND activo = 1");
    $stmt->bind_param("s", $username);
    $stmt->execute();
    $res = $stmt->get_result();

    if ($row = $res->fetch_assoc()) {
        echo json_encode(["status" => "success", "pregunta" => $row['pregunta_seguridad']]);
    } else {
        echo json_encode(["status" => "error", "message" => "Usuario no encontrado o inactivo."]);
    }
    exit;
}

// PASO 2: VALIDAR RESPUESTA Y CAMBIAR CONTRASEÑA
if ($accion === 'cambiar') {
    $respuesta = trim($input['respuesta'] ?? '');
    $nuevaPass = $input['nueva_password'] ?? '';

    if (empty($respuesta) || empty($nuevaPass) || strlen($nuevaPass) < 6) {
        echo json_encode(["status" => "error", "message" => "La respuesta es obligatoria y la nueva contraseña debe tener al menos 6 caracteres."]);
        exit;
    }

    // Buscamos al usuario y su respuesta encriptada
    $stmt = $conn->prepare("SELECT id_usuario, respuesta_seguridad_hash FROM usuarios WHERE username = ? AND activo = 1");
    $stmt->bind_param("s", $username);
    $stmt->execute();
    $res = $stmt->get_result();

    if ($row = $res->fetch_assoc()) {
        // Comparamos la respuesta escrita con el Hash de la BD (Ignorando mayúsculas/minúsculas)
        if (password_verify(strtolower($respuesta), $row['respuesta_seguridad_hash'])) {
            
            $id_user = $row['id_usuario'];
            $nuevoHash = password_hash($nuevaPass, PASSWORD_BCRYPT);

            $stmtUpdate = $conn->prepare("UPDATE usuarios SET password_hash = ? WHERE id_usuario = ?");
            $stmtUpdate->bind_param("si", $nuevoHash, $id_user);
            
            if ($stmtUpdate->execute()) {
                echo json_encode(["status" => "success", "message" => "Contraseña actualizada. Redirigiendo..."]);
            } else {
                echo json_encode(["status" => "error", "message" => "Error al actualizar la contraseña."]);
            }
        } else {
            echo json_encode(["status" => "error", "message" => "La respuesta de seguridad es incorrecta."]);
        }
    } else {
        echo json_encode(["status" => "error", "message" => "Error de usuario."]);
    }
    exit;
}
?>