<?php
// config/Database.php
// ============================================================
// CLASE DE CONEXIÓN A BASE DE DATOS (PATRÓN SINGLETON)
// ============================================================

require_once __DIR__ . '/config.php';

class Database {
    private static ?Database $instance = null;
    private ?mysqli $connection = null;

    private function __construct() {
        $this->connection = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);

        if ($this->connection->connect_error) {
            http_response_code(500);
            echo json_encode([
                "status" => "error",
                "message" => "Error de conexión a la base de datos: " . $this->connection->connect_error
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $this->connection->set_charset("utf8mb4");
    }

    public static function getInstance(): Database {
        if (self::$instance === null || !self::$instance->connection || !self::$instance->connection->ping()) {
            self::$instance = new Database();
        }
        return self::$instance;
    }

    public function getConnection(): mysqli {
        return $this->connection;
    }

    // Prevenir clonación y deserialización
    private function __clone() {}
    public function __wakeup() {
        throw new Exception("No se permite deserializar una instancia de Database.");
    }
}

// Función auxiliar global para retrocompatibilidad
if (!function_exists('conectarDB')) {
    function conectarDB(): mysqli {
        return Database::getInstance()->getConnection();
    }
}
