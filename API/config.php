<?php
// API/config.php
// ==========================================
// CONFIGURACIÓN GLOBAL DE LA BASE DE DATOS
// ==========================================

// Si el sistema se sube a un servidor real, solo se modifican estos valores
define('DB_HOST', 'localhost');
define('DB_USER', 'root');       // Aquí el cliente pondría su usuario de MySQL
define('DB_PASS', '');           // Aquí pondría su contraseña
define('DB_NAME', 'estado_de_casa_utower');

// Zona horaria para que las fechas de los logs y registros sean exactas
date_default_timezone_set('America/Monterrey'); // Cámbiala a tu ciudad si es necesario

// Función maestra para conectar a la base de datos
function conectarDB() {
    $conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
    
    if ($conn->connect_error) {
        // Si falla, matamos el script y devolvemos un JSON de error (para que el front lo lea)
        die(json_encode(["status" => "error", "message" => "Error de conexión: " . $conn->connect_error]));
    }
    
    $conn->set_charset("utf8mb4");
    return $conn;
}
?>