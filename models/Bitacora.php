<?php
// models/Bitacora.php
// ============================================================
// MODELO: BITÁCORA DE AUDITORÍA Y RESPALDOS DEL SISTEMA
// ============================================================

require_once __DIR__ . '/../config/Database.php';

class Bitacora {
    private mysqli $db;

    public function __construct() {
        $this->db = Database::getInstance()->getConnection();
    }

    public function registrar(?int $idUsuario, string $accion, string $detalles): bool {
        $ip = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
        $stmt = $this->db->prepare("INSERT INTO logs_sistema (id_usuario, accion, detalles, ip_usuario) VALUES (?, ?, ?, ?)");
        if (!$stmt) return false;
        $stmt->bind_param("isss", $idUsuario, $accion, $detalles, $ip);
        $res = $stmt->execute();
        $stmt->close();
        return $res;
    }

    public function obtenerUltimos(int $limite = 200): array {
        $limite = (int)$limite;
        $sql = "SELECT l.id_log, l.accion, l.detalles, l.fecha_log, l.ip_usuario, u.nombre_completo 
                FROM logs_sistema l 
                LEFT JOIN usuarios u ON l.id_usuario = u.id_usuario 
                ORDER BY l.fecha_log DESC LIMIT {$limite}";
        $result = $this->db->query($sql);
        $logs = [];
        if ($result) {
            while ($row = $result->fetch_assoc()) {
                $logs[] = $row;
            }
        }
        return $logs;
    }

    public function generarRespaldoSql(): string {
        $output = "-- Respaldo U-Tower Database\n-- Fecha: " . date('Y-m-d H:i:s') . "\n\n";
        $output .= "SET FOREIGN_KEY_CHECKS = 0;\n\n";

        $tables = [];
        $result = $this->db->query("SHOW TABLES");
        while ($row = $result->fetch_row()) { 
            $tables[] = $row[0]; 
        }

        foreach ($tables as $table) {
            $output .= "DROP TABLE IF EXISTS `$table`;\n";
            $row2 = $this->db->query("SHOW CREATE TABLE `$table`")->fetch_row();
            $output .= $row2[1] . ";\n\n";

            $rows = $this->db->query("SELECT * FROM `$table`");
            while ($row = $rows->fetch_assoc()) {
                $fields = array_keys($row);
                $values = array_values($row);
                $escapedValues = array_map(function($val) {
                    if ($val === null) return "NULL";
                    return "'" . $this->db->real_escape_string($val) . "'";
                }, $values);
                $output .= "INSERT INTO `$table` (`" . implode("`, `", $fields) . "`) VALUES (" . implode(", ", $escapedValues) . ");\n";
            }
            $output .= "\n\n";
        }

        $output .= "SET FOREIGN_KEY_CHECKS = 1;\n";
        return $output;
    }
}
