<?php
require_once 'auth_middleware.php';
requerir_permiso('gestionar_usuarios');

header('Content-Type: application/json; charset=utf-8');
$conn = new mysqli("localhost", "root", "", "estado_de_casa_utower");
$conn->set_charset("utf8mb4");

$method = $_SERVER['REQUEST_METHOD'];

// OBTENER DATOS
if ($method === 'GET') {
    $sqlUsers = "SELECT u.id_usuario, u.nombre_completo, u.username, u.activo, r.nombre_rol 
                 FROM usuarios u JOIN roles r ON u.id_rol = r.id_rol ORDER BY u.id_usuario ASC";
    $resUsers = $conn->query($sqlUsers)->fetch_all(MYSQLI_ASSOC);

    $sqlRoles = "SELECT r.id_rol, r.nombre_rol, r.descripcion, r.es_admin_principal, GROUP_CONCAT(p.clave_permiso) as permisos 
                 FROM roles r 
                 LEFT JOIN roles_permisos rp ON r.id_rol = rp.id_rol 
                 LEFT JOIN permisos p ON rp.id_permiso = p.id_permiso 
                 GROUP BY r.id_rol";
    $resRoles = $conn->query($sqlRoles)->fetch_all(MYSQLI_ASSOC);

    $resPermisos = $conn->query("SELECT * FROM permisos")->fetch_all(MYSQLI_ASSOC);

    echo json_encode([
        "status" => "success",
        "usuarios" => $resUsers,
        "roles" => $resRoles,
        "permisos" => $resPermisos
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// ACCIONES POST
if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $accion = $input['accion'] ?? '';

    // CREAR USUARIO
    if ($accion === 'crear_usuario') {
        $nombre = trim($input['nombre_completo']);
        $username = trim($input['username']);
        $password = $input['password'];
        $id_rol = intval($input['id_rol']);
        $pregunta = trim($input['pregunta']);
        $respuesta = password_hash(trim($input['respuesta']), PASSWORD_BCRYPT);
        $passHash = password_hash($password, PASSWORD_BCRYPT);

        if (empty($nombre) || empty($username) || empty($password)) {
            echo json_encode(["status" => "error", "message" => "Todos los campos son obligatorios."]);
            exit;
        }

        $stmt = $conn->prepare("INSERT INTO usuarios (nombre_completo, username, password_hash, id_rol, pregunta_seguridad, respuesta_seguridad_hash) VALUES (?, ?, ?, ?, ?, ?)");
        $stmt->bind_param("sssiss", $nombre, $username, $passHash, $id_rol, $pregunta, $respuesta);
        
        if ($stmt->execute()) {
            echo json_encode(["status" => "success", "message" => "Usuario creado correctamente."]);
        } else {
            echo json_encode(["status" => "error", "message" => "Error: El nombre de usuario ya existe."]);
        }
        exit;
    }

 // EDITAR USUARIO (Rol, Estado y Contraseña)
    if ($accion === 'editar_usuario') {
        $id_usuario = intval($input['id_usuario']);
        
        // Proteger al admin principal
        if ($id_usuario == 1 && $input['id_rol'] != 1) {
            echo json_encode(["status" => "error", "message" => "No puedes quitarle el rol de Admin al Administrador Principal."]);
            exit;
        }

        $id_rol = intval($input['id_rol']);
        $activo = $input['activo'] ? 1 : 0;
        $nueva_password = trim($input['nueva_password'] ?? '');

        if (!empty($nueva_password)) {
            if (strlen($nueva_password) < 6) {
                echo json_encode(["status" => "error", "message" => "La nueva contraseña debe tener al menos 6 caracteres."]);
                exit;
            }
            // Si envían contraseña, la actualizamos
            $passHash = password_hash($nueva_password, PASSWORD_BCRYPT);
            $stmt = $conn->prepare("UPDATE usuarios SET id_rol = ?, activo = ?, password_hash = ? WHERE id_usuario = ?");
            $stmt->bind_param("iisi", $id_rol, $activo, $passHash, $id_usuario);
        } else {
            // Si no envían contraseña, solo actualizamos rol y estado
            $stmt = $conn->prepare("UPDATE usuarios SET id_rol = ?, activo = ? WHERE id_usuario = ?");
            $stmt->bind_param("iii", $id_rol, $activo, $id_usuario);
        }

        if ($stmt->execute()) {
            echo json_encode(["status" => "success", "message" => "Usuario actualizado correctamente."]);
        } else {
            echo json_encode(["status" => "error", "message" => "Error al actualizar."]);
        }
        exit;
    }

    // ELIMINAR USUARIO
    if ($accion === 'eliminar_usuario') {
        $id_usuario = intval($input['id_usuario']);

        // Evitar que se elimine el administrador principal por accidente
        $chkAdmin = $conn->query("SELECT es_admin_principal FROM roles r JOIN usuarios u ON r.id_rol = u.id_rol WHERE u.id_usuario = $id_usuario")->fetch_assoc();
        if ($chkAdmin && $chkAdmin['es_admin_principal'] == 1) {
            echo json_encode(["status" => "error", "message" => "No se puede eliminar al Administrador Principal."]);
            exit;
        }

        $stmt = $conn->prepare("DELETE FROM usuarios WHERE id_usuario = ?");
        $stmt->bind_param("i", $id_usuario);
        
        if ($stmt->execute()) {
            echo json_encode(["status" => "success", "message" => "Usuario eliminado correctamente."]);
        } else {
            echo json_encode(["status" => "error", "message" => "Error al eliminar el usuario."]);
        }
        exit;
    }
    // CREAR/EDITAR ROL
    if ($accion === 'crear_rol' || $accion === 'editar_rol') {
        $id_rol = intval($input['id_rol']);
        $nombre = trim($input['nombre']);
        $desc = trim($input['descripcion']);
        $permisos = $input['permisos'] ?? [];

        if (empty($nombre)) {
            echo json_encode(["status" => "error", "message" => "El nombre del rol es obligatorio."]);
            exit;
        }

        $conn->begin_transaction();
        try {
            if ($id_rol === 0) {
                $stmt = $conn->prepare("INSERT INTO roles (nombre_rol, descripcion) VALUES (?, ?)");
                $stmt->bind_param("ss", $nombre, $desc);
                $stmt->execute();
                $id_rol = $conn->insert_id;
                $msg = "Rol creado correctamente.";
            } else {
                $chk = $conn->query("SELECT es_admin_principal FROM roles WHERE id_rol = $id_rol")->fetch_assoc();
                if ($chk['es_admin_principal'] == 1) {
                    throw new Exception("El rol de Administrador Principal no se puede modificar.");
                }
                $stmt = $conn->prepare("UPDATE roles SET nombre_rol = ?, descripcion = ? WHERE id_rol = ?");
                $stmt->bind_param("ssi", $nombre, $desc, $id_rol);
                $stmt->execute();
                $msg = "Rol actualizado correctamente.";
            }

            $conn->query("DELETE FROM roles_permisos WHERE id_rol = $id_rol");
            if (!empty($permisos)) {
                $stmtPerm = $conn->prepare("INSERT INTO roles_permisos (id_rol, id_permiso) SELECT ?, id_permiso FROM permisos WHERE clave_permiso = ?");
                foreach ($permisos as $clave) {
                    $stmtPerm->bind_param("is", $id_rol, $clave);
                    $stmtPerm->execute();
                }
            }
            $conn->commit();
            echo json_encode(["status" => "success", "message" => $msg]);
        } catch (Exception $e) {
            $conn->rollback();
            echo json_encode(["status" => "error", "message" => $e->getMessage()]);
        }
        exit;
    }
}
$conn->close();
?>