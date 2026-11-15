<?php
// models/Bloqueo.php
// ============================================================
// MODELO: CONTROL DE CONCURRENCIA Y BLOQUEOS (PESSIMISTIC LOCKING)
// ============================================================

require_once __DIR__ . '/../config/Database.php';
require_once __DIR__ . '/../config/config.php';

class Bloqueo {
    private mysqli $db;

    public function __construct() {
        $this->db = Database::getInstance()->getConnection();
    }

    public function limpiarExpirados(): void {
        $ttl = LOCK_TTL_SECONDS;
        $this->db->query("DELETE FROM bloqueos_expedientes WHERE ultimo_latido < DATE_SUB(NOW(), INTERVAL {$ttl} SECOND)");
    }

    public function listarActivos(int $idUsuarioActual): array {
        $this->limpiarExpirados();
        $res = $this->db->query("SELECT nomenclatura, id_usuario, nombre_usuario, fecha_bloqueo, ultimo_latido FROM bloqueos_expedientes");
        $bloqueos = [];
        if ($res) {
            while ($row = $res->fetch_assoc()) {
                $bloqueos[$row['nomenclatura']] = [
                    "id_usuario"     => (int)$row['id_usuario'],
                    "nombre_usuario" => $row['nombre_usuario'],
                    "es_propio"      => ((int)$row['id_usuario'] === $idUsuarioActual)
                ];
            }
        }
        return $bloqueos;
    }

    public function verificar(string $nomenclatura, int $idUsuarioActual): array {
        $this->limpiarExpirados();
        $ttl = LOCK_TTL_SECONDS;
        $stmt = $this->db->prepare("SELECT id_usuario, nombre_usuario, fecha_bloqueo, ultimo_latido 
                                    FROM bloqueos_expedientes 
                                    WHERE nomenclatura = ? AND ultimo_latido >= DATE_SUB(NOW(), INTERVAL {$ttl} SECOND) LIMIT 1");
        $stmt->bind_param("s", $nomenclatura);
        $stmt->execute();
        $res = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        if ($res) {
            $esPropio = ((int)$res['id_usuario'] === $idUsuarioActual);
            return [
                "bloqueado"        => true,
                "es_propio"        => $esPropio,
                "bloqueado_por"    => $res['nombre_usuario'],
                "bloqueado_por_id" => (int)$res['id_usuario'],
                "fecha_bloqueo"    => $res['fecha_bloqueo']
            ];
        }

        return [
            "bloqueado" => false,
            "es_propio" => false
        ];
    }

    public function adquirir(string $nomenclatura, int $idUsuario, string $nombreUsuario): array {
        $this->limpiarExpirados();
        $ttl = LOCK_TTL_SECONDS;

        // Verificar si alguien más ya lo tiene bloqueado activamente
        $stmt = $this->db->prepare("SELECT id_usuario, nombre_usuario FROM bloqueos_expedientes 
                                    WHERE nomenclatura = ? AND id_usuario != ? AND ultimo_latido >= DATE_SUB(NOW(), INTERVAL {$ttl} SECOND) LIMIT 1");
        $stmt->bind_param("si", $nomenclatura, $idUsuario);
        $stmt->execute();
        $otro = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        if ($otro) {
            return [
                "status"           => "locked",
                "bloqueado"        => true,
                "bloqueado_por"    => $otro['nombre_usuario'],
                "bloqueado_por_id" => (int)$otro['id_usuario'],
                "message"          => "El expediente de la unidad {$nomenclatura} está siendo modificado actualmente por {$otro['nombre_usuario']}. No es posible editarlo hasta que termine."
            ];
        }

        // Adquirir o renovar bloqueo
        $stmtUpsert = $this->db->prepare("INSERT INTO bloqueos_expedientes (nomenclatura, id_usuario, nombre_usuario, fecha_bloqueo, ultimo_latido) 
                                         VALUES (?, ?, ?, NOW(), NOW()) 
                                         ON DUPLICATE KEY UPDATE id_usuario = VALUES(id_usuario), nombre_usuario = VALUES(nombre_usuario), ultimo_latido = NOW()");
        $stmtUpsert->bind_param("sis", $nomenclatura, $idUsuario, $nombreUsuario);
        $ok = $stmtUpsert->execute();
        $stmtUpsert->close();

        return [
            "status"    => "success",
            "bloqueado" => true,
            "es_propio" => true,
            "message"   => "Expediente bloqueado correctamente para edición."
        ];
    }

    public function renovarLatido(string $nomenclatura, int $idUsuario, string $nombreUsuario): bool {
        $stmt = $this->db->prepare("UPDATE bloqueos_expedientes SET ultimo_latido = NOW() WHERE nomenclatura = ? AND id_usuario = ?");
        $stmt->bind_param("si", $nomenclatura, $idUsuario);
        $stmt->execute();
        $afectados = $stmt->affected_rows;
        $stmt->close();

        if ($afectados === 0) {
            $stmtRecrear = $this->db->prepare("INSERT IGNORE INTO bloqueos_expedientes (nomenclatura, id_usuario, nombre_usuario, fecha_bloqueo, ultimo_latido) VALUES (?, ?, ?, NOW(), NOW())");
            $stmtRecrear->bind_param("sis", $nomenclatura, $idUsuario, $nombreUsuario);
            $stmtRecrear->execute();
            $stmtRecrear->close();
        }
        return true;
    }

    public function liberar(string $nomenclatura, int $idUsuario): bool {
        $stmt = $this->db->prepare("DELETE FROM bloqueos_expedientes WHERE nomenclatura = ? AND id_usuario = ?");
        $stmt->bind_param("si", $nomenclatura, $idUsuario);
        $res = $stmt->execute();
        $stmt->close();
        return $res;
    }

    public function liberarTodosDeUsuario(int $idUsuario): bool {
        $stmt = $this->db->prepare("DELETE FROM bloqueos_expedientes WHERE id_usuario = ?");
        $stmt->bind_param("i", $idUsuario);
        $res = $stmt->execute();
        $stmt->close();
        return $res;
    }
}
