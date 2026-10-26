<?php
require_once 'config.php';
require_once 'auth_middleware.php';

// Solo los que pueden gestionar usuarios pueden ver los logs
requerir_permiso('gestionar_usuarios');

header('Content-Type: application/json; charset=utf-8');
$conn = conectarDB();

// Traemos los últimos 200 movimientos, uniendo con la tabla de usuarios para ver el nombre
$sql = "SELECT l.id_log, l.accion, l.detalles, l.fecha_log, l.ip_usuario, u.nombre_completo 
        FROM logs_sistema l 
        LEFT JOIN usuarios u ON l.id_usuario = u.id_usuario 
        ORDER BY l.fecha_log DESC LIMIT 200";

$result = $conn->query($sql);
$logs = [];
if ($result) {
    while ($row = $result->fetch_assoc()) {
        $logs[] = $row;
    }
}

echo json_encode(["status" => "success", "logs" => $logs], JSON_UNESCAPED_UNICODE);
$conn->close();
?>