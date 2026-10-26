<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

// Conexión a la base de datos
require_once 'config.php';
$conn = conectarDB();


$data = json_decode(file_get_contents('php://input'), true);
$username = trim($data['username'] ?? '');
$password = trim($data['password'] ?? '');

if (empty($username) || empty($password)) {
    echo json_encode(["status" => "error", "message" => "Faltan credenciales."]);
    exit;
}

$stmt = $conn->prepare("SELECT id_usuario, nombre_completo, password_hash, id_rol FROM usuarios WHERE username = ? AND activo = 1");
$stmt->bind_param("s", $username);
$stmt->execute();
$result = $stmt->get_result();

if ($row = $result->fetch_assoc()) {
    if (password_verify($password, $row['password_hash'])) {
        
        // Autenticación exitosa
        $_SESSION['id_usuario'] = $row['id_usuario'];
        $_SESSION['nombre'] = $row['nombre_completo'];
        $_SESSION['id_rol'] = $row['id_rol'];
        $_SESSION['ultimo_movimiento'] = time(); // Para el control de inactividad

        // Buscar permisos del rol
        $stmtPerm = $conn->prepare("SELECT p.clave_permiso FROM permisos p JOIN roles_permisos rp ON p.id_permiso = rp.id_permiso WHERE rp.id_rol = ?");
        $stmtPerm->bind_param("i", $row['id_rol']);
        $stmtPerm->execute();
        $resPerm = $stmtPerm->get_result();
        
        $permisos = [];
        while($p = $resPerm->fetch_assoc()) {
            $permisos[] = $p['clave_permiso'];
        }
        $_SESSION['permisos'] = $permisos;

        echo json_encode(["status" => "success"]);
    } else {
        echo json_encode(["status" => "error", "message" => "Contraseña incorrecta."]);
    }
} else {
    echo json_encode(["status" => "error", "message" => "Usuario no encontrado o inactivo."]);
}
$conn->close();
?>