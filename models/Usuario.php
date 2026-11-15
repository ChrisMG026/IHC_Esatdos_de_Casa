<?php
// models/Usuario.php
// ============================================================
// MODELO: GESTIÓN DE USUARIOS, ROLES, PERMISOS Y SEGURIDAD
// ============================================================

require_once __DIR__ . '/../config/Database.php';

class Usuario {
    private mysqli $db;

    public function __construct() {
        $this->db = Database::getInstance()->getConnection();
    }

    public function autenticar(string $username, string $password): array {
        $stmt = $this->db->prepare("SELECT id_usuario, nombre_completo, password_hash, id_rol FROM usuarios WHERE username = ? AND activo = 1");
        $stmt->bind_param("s", $username);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        if (!$row) {
            return ["success" => false, "message" => "Usuario no encontrado o inactivo."];
        }

        if (!password_verify($password, $row['password_hash'])) {
            return ["success" => false, "message" => "Contraseña incorrecta."];
        }

        // Obtener permisos del rol
        $stmtPerm = $this->db->prepare("SELECT p.clave_permiso 
                                        FROM permisos p 
                                        JOIN roles_permisos rp ON p.id_permiso = rp.id_permiso 
                                        WHERE rp.id_rol = ?");
        $stmtPerm->bind_param("i", $row['id_rol']);
        $stmtPerm->execute();
        $resPerm = $stmtPerm->get_result();

        $permisos = [];
        while ($p = $resPerm->fetch_assoc()) {
            $permisos[] = $p['clave_permiso'];
        }
        $stmtPerm->close();

        return [
            "success" => true,
            "usuario" => [
                "id_usuario"      => (int)$row['id_usuario'],
                "nombre_completo" => $row['nombre_completo'],
                "id_rol"          => (int)$row['id_rol'],
                "permisos"        => $permisos
            ]
        ];
    }

    public function listar(): array {
        $sql = "SELECT u.id_usuario, u.nombre_completo, u.username, u.activo, r.nombre_rol, u.id_rol
                FROM usuarios u 
                JOIN roles r ON u.id_rol = r.id_rol 
                ORDER BY u.id_usuario ASC";
        return $this->db->query($sql)->fetch_all(MYSQLI_ASSOC) ?: [];
    }

    public function obtenerRoles(): array {
        $sql = "SELECT r.id_rol, r.nombre_rol, r.descripcion, r.es_admin_principal, GROUP_CONCAT(p.clave_permiso) as permisos 
                FROM roles r 
                LEFT JOIN roles_permisos rp ON r.id_rol = rp.id_rol 
                LEFT JOIN permisos p ON rp.id_permiso = p.id_permiso 
                GROUP BY r.id_rol";
        return $this->db->query($sql)->fetch_all(MYSQLI_ASSOC) ?: [];
    }

    public function obtenerPermisos(): array {
        return $this->db->query("SELECT * FROM permisos ORDER BY id_permiso ASC")->fetch_all(MYSQLI_ASSOC) ?: [];
    }

    public function crear(array $data): array {
        $nombre = trim($data['nombre_completo'] ?? '');
        $username = trim($data['username'] ?? '');
        $password = $data['password'] ?? '';
        $id_rol = intval($data['id_rol'] ?? 0);
        $pregunta = trim($data['pregunta'] ?? '');
        $respuesta = password_hash(strtolower(trim($data['respuesta'] ?? '')), PASSWORD_BCRYPT);
        $passHash = password_hash($password, PASSWORD_BCRYPT);

        if (empty($nombre) || empty($username) || empty($password)) {
            return ["success" => false, "message" => "Todos los campos son obligatorios."];
        }

        $stmt = $this->db->prepare("INSERT INTO usuarios (nombre_completo, username, password_hash, id_rol, pregunta_seguridad, respuesta_seguridad_hash) VALUES (?, ?, ?, ?, ?, ?)");
        $stmt->bind_param("sssiss", $nombre, $username, $passHash, $id_rol, $pregunta, $respuesta);
        
        if ($stmt->execute()) {
            $id = $this->db->insert_id;
            $stmt->close();
            return ["success" => true, "message" => "Usuario creado correctamente.", "id_usuario" => $id];
        } else {
            $stmt->close();
            return ["success" => false, "message" => "Error: El nombre de usuario ya existe o hubo un conflicto."];
        }
    }

    public function actualizar(array $data): array {
        $id_usuario = intval($data['id_usuario'] ?? 0);
        $id_rol = intval($data['id_rol'] ?? 0);
        $activo = !empty($data['activo']) ? 1 : 0;
        $nueva_password = trim($data['nueva_password'] ?? '');

        // Proteger admin principal
        if ($id_usuario === 1 && $id_rol !== 1) {
            return ["success" => false, "message" => "No puedes quitarle el rol de Administrador al Admin Principal."];
        }

        if (!empty($nueva_password)) {
            if (strlen($nueva_password) < 6) {
                return ["success" => false, "message" => "La nueva contraseña debe tener al menos 6 caracteres."];
            }
            $passHash = password_hash($nueva_password, PASSWORD_BCRYPT);
            $stmt = $this->db->prepare("UPDATE usuarios SET id_rol = ?, activo = ?, password_hash = ? WHERE id_usuario = ?");
            $stmt->bind_param("iisi", $id_rol, $activo, $passHash, $id_usuario);
        } else {
            $stmt = $this->db->prepare("UPDATE usuarios SET id_rol = ?, activo = ? WHERE id_usuario = ?");
            $stmt->bind_param("iii", $id_rol, $activo, $id_usuario);
        }

        $ok = $stmt->execute();
        $stmt->close();
        return [
            "success" => $ok,
            "message" => $ok ? "Usuario actualizado correctamente." : "Error al actualizar usuario."
        ];
    }

    public function eliminar(int $idUsuario): array {
        // Evitar eliminar al admin principal
        $chk = $this->db->query("SELECT es_admin_principal FROM roles r JOIN usuarios u ON r.id_rol = u.id_rol WHERE u.id_usuario = {$idUsuario}")->fetch_assoc();
        if ($chk && (int)$chk['es_admin_principal'] === 1) {
            return ["success" => false, "message" => "No se puede eliminar al Administrador Principal."];
        }

        $stmt = $this->db->prepare("DELETE FROM usuarios WHERE id_usuario = ?");
        $stmt->bind_param("i", $idUsuario);
        $ok = $stmt->execute();
        $stmt->close();

        return [
            "success" => $ok,
            "message" => $ok ? "Usuario eliminado correctamente." : "Error al eliminar usuario."
        ];
    }

    public function guardarRol(int $id_rol, string $nombre, string $descripcion, array $permisos): array {
        if (empty($nombre)) {
            return ["success" => false, "message" => "El nombre del rol es obligatorio."];
        }

        $this->db->begin_transaction();
        try {
            if ($id_rol === 0) {
                $stmt = $this->db->prepare("INSERT INTO roles (nombre_rol, descripcion) VALUES (?, ?)");
                $stmt->bind_param("ss", $nombre, $descripcion);
                $stmt->execute();
                $id_rol = $this->db->insert_id;
                $stmt->close();
                $msg = "Rol creado correctamente.";
            } else {
                $chk = $this->db->query("SELECT es_admin_principal FROM roles WHERE id_rol = {$id_rol}")->fetch_assoc();
                if ($chk && (int)$chk['es_admin_principal'] === 1) {
                    throw new Exception("El rol de Administrador Principal no se puede modificar.");
                }
                $stmt = $this->db->prepare("UPDATE roles SET nombre_rol = ?, descripcion = ? WHERE id_rol = ?");
                $stmt->bind_param("ssi", $nombre, $descripcion, $id_rol);
                $stmt->execute();
                $stmt->close();
                $msg = "Rol actualizado correctamente.";
            }

            $this->db->query("DELETE FROM roles_permisos WHERE id_rol = {$id_rol}");
            if (!empty($permisos)) {
                $stmtPerm = $this->db->prepare("INSERT INTO roles_permisos (id_rol, id_permiso) SELECT ?, id_permiso FROM permisos WHERE clave_permiso = ?");
                foreach ($permisos as $clave) {
                    $stmtPerm->bind_param("is", $id_rol, $clave);
                    $stmtPerm->execute();
                }
                $stmtPerm->close();
            }

            $this->db->commit();
            return ["success" => true, "message" => $msg, "id_rol" => $id_rol];
        } catch (Exception $e) {
            $this->db->rollback();
            return ["success" => false, "message" => $e->getMessage()];
        }
    }

    public function buscarPreguntaSeguridad(string $username): array {
        $stmt = $this->db->prepare("SELECT pregunta_seguridad FROM usuarios WHERE username = ? AND activo = 1");
        $stmt->bind_param("s", $username);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        if ($row) {
            return ["success" => true, "pregunta" => $row['pregunta_seguridad']];
        }
        return ["success" => false, "message" => "Usuario no encontrado o inactivo."];
    }

    public function cambiarPasswordSeguridad(string $username, string $respuesta, string $nuevaPassword): array {
        if (empty($respuesta) || empty($nuevaPassword) || strlen($nuevaPassword) < 6) {
            return ["success" => false, "message" => "La respuesta es obligatoria y la nueva contraseña debe tener al menos 6 caracteres."];
        }

        $stmt = $this->db->prepare("SELECT id_usuario, respuesta_seguridad_hash FROM usuarios WHERE username = ? AND activo = 1");
        $stmt->bind_param("s", $username);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        if (!$row) {
            return ["success" => false, "message" => "Usuario no encontrado."];
        }

        if (!password_verify(strtolower($respuesta), $row['respuesta_seguridad_hash'])) {
            return ["success" => false, "message" => "Respuesta de seguridad incorrecta."];
        }

        $nuevoHash = password_hash($nuevaPassword, PASSWORD_BCRYPT);
        $stmtUpdate = $this->db->prepare("UPDATE usuarios SET password_hash = ? WHERE id_usuario = ?");
        $stmtUpdate->bind_param("si", $nuevoHash, $row['id_usuario']);
        $ok = $stmtUpdate->execute();
        $stmtUpdate->close();

        return [
            "success" => $ok,
            "message" => $ok ? "Contraseña actualizada exitosamente." : "Error al actualizar la contraseña."
        ];
    }
}
