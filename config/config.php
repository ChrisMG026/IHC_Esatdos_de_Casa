<?php
// config/config.php
// ==========================================
// CONFIGURACIÓN GLOBAL DEL SISTEMA
// ==========================================

// Parámetros de la Base de Datos
define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_NAME', 'estado_de_casa_utower');

// Zona horaria
date_default_timezone_set('America/Monterrey');

// Constantes de seguridad y sesión
define('SESSION_LIFETIME', 3600); // 1 hora de inactividad
define('LOCK_TTL_SECONDS', 60);   // 60 segundos de caducidad para bloqueos concurrentes
