<?php
// models/Estacionamiento.php
// ============================================================
// MODELO: GESTIÓN DE CAJONES DE ESTACIONAMIENTO
// ============================================================

require_once __DIR__ . '/../config/Database.php';
require_once __DIR__ . '/../models/Bitacora.php';

class Estacionamiento {
    private mysqli $db;
    private Bitacora $bitacora;

    public function __construct() {
        $this->db = Database::getInstance()->getConnection();
        $this->bitacora = new Bitacora();
    }

    public function obtenerTodos(): array {
        $sql = "SELECT 
                    c.nombre_cajon AS cajon,
                    e.numero_tag,
                    e.nombre_completo,
                    e.nomenclatura,
                    e.modelo_auto,
                    e.color_auto,
                    e.placas,
                    c.estado AS estado_cajon,
                    CASE 
                        WHEN c.estado = 'Deshabilitado' THEN 'Deshabilitado'
                        WHEN c.nombre_cajon LIKE 'Admin%' THEN 'Admin'
                        WHEN e.nombre_completo IS NOT NULL AND e.nombre_completo != '' THEN 'Ocupado'
                        ELSE 'Libre'
                    END AS estado_ocupacion
                FROM cajones_estacionamiento c
                LEFT JOIN estacionamiento e ON c.nombre_cajon = e.cajon
                ORDER BY 
                    CASE 
                        WHEN c.nombre_cajon LIKE 'Admin%' THEN 0 
                        ELSE 1 
                    END,
                    CAST(REGEXP_REPLACE(c.nombre_cajon, '[^0-9]', '') AS UNSIGNED) ASC";

        $result = $this->db->query($sql);
        $data = [];
        if ($result) {
            while ($row = $result->fetch_assoc()) {
                $data[] = $row;
            }
        }
        return $data;
    }

    public function actualizarAdmin(array $data, int $idUsuario): array {
        $cajon  = trim($data['cajon'] ?? '');
        $tag    = trim($data['numero_tag'] ?? '');
        $nombre = trim($data['nombre_completo'] ?? '');
        $modelo = trim($data['modelo_auto'] ?? '');
        $color  = trim($data['color_auto'] ?? '');
        $placas = trim($data['placas'] ?? '');

        if (empty($cajon)) {
            return ["success" => false, "message" => "El cajón es obligatorio."];
        }

        $chk = $this->db->prepare("SELECT cajon FROM estacionamiento WHERE cajon = ?");
        $chk->bind_param("s", $cajon);
        $chk->execute();
        $resChk = $chk->get_result();
        $chk->close();

        if ($resChk->num_rows > 0) {
            $stmt = $this->db->prepare("UPDATE estacionamiento SET numero_tag = ?, nombre_completo = ?, modelo_auto = ?, color_auto = ?, placas = ? WHERE cajon = ?");
            $stmt->bind_param("ssssss", $tag, $nombre, $modelo, $color, $placas, $cajon);
        } else {
            $stmt = $this->db->prepare("INSERT INTO estacionamiento (cajon, numero_tag, nombre_completo, nomenclatura, modelo_auto, color_auto, placas) VALUES (?, ?, ?, NULL, ?, ?, ?)");
            $stmt->bind_param("ssssss", $cajon, $tag, $nombre, $modelo, $color, $placas);
        }

        $ok = $stmt->execute();
        $stmt->close();

        if ($ok) {
            $this->bitacora->registrar($idUsuario, "Cajón Administrativo", "Actualizado: {$cajon} - Asignado a: {$nombre}");
            return ["success" => true, "message" => "Cajón administrativo actualizado correctamente."];
        } else {
            return ["success" => false, "message" => "Error al actualizar cajón: " . $this->db->error];
        }
    }
}
