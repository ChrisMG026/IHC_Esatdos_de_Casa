<?php
// models/Contrato.php
// ============================================================
// MODELO: GESTIÓN DE CONTRATOS, RENOVACIONES Y VEHÍCULOS
// ============================================================

require_once __DIR__ . '/../config/Database.php';
require_once __DIR__ . '/../models/Bitacora.php';
require_once __DIR__ . '/../models/Bloqueo.php';

class Contrato {
    private mysqli $db;
    private Bitacora $bitacora;
    private Bloqueo $bloqueo;

    public function __construct() {
        $this->db = Database::getInstance()->getConnection();
        $this->bitacora = new Bitacora();
        $this->bloqueo = new Bloqueo();
    }

    public function listar(): array {
        $sql = "SELECT 
                    c.numero_departamento, 
                    c.recamara, 
                    c.nomenclatura, 
                    c.nombre_residente, 
                    c.celular, 
                    c.correo, 
                    c.renta, 
                    CASE WHEN e.nomenclatura IS NOT NULL THEN 'Si' ELSE 'No' END as tiene_carro, 
                    c.fecha_move_in, 
                    c.fecha_move_out,
                    IF(TIMESTAMPDIFF(MONTH, c.fecha_move_in, c.fecha_move_out) > 9, '12 meses', '6 meses') AS tipo_contrato,
                    DATEDIFF(c.fecha_move_out, CURDATE()) AS dias_restantes,
                    CASE 
                        WHEN DATEDIFF(c.fecha_move_out, CURDATE()) < 0 THEN 'Vencido'
                        WHEN DATEDIFF(c.fecha_move_out, CURDATE()) <= 30 THEN 'Por vencer'
                        ELSE 'Vigente'
                    END AS estado_vencimiento
                FROM contrato c
                LEFT JOIN estacionamiento e ON c.nomenclatura = e.nomenclatura
                ORDER BY CAST(c.numero_departamento AS UNSIGNED) ASC, c.nomenclatura ASC";

        $result = $this->db->query($sql);
        $data = [];
        if ($result) {
            while ($row = $result->fetch_assoc()) {
                $data[] = $row;
            }
        }
        return $data;
    }

    public function obtenerAuto(string $nomenclatura): ?array {
        $stmt = $this->db->prepare("SELECT * FROM estacionamiento WHERE nomenclatura = ? LIMIT 1");
        $stmt->bind_param("s", $nomenclatura);
        $stmt->execute();
        $res = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        return $res;
    }

    public function obtenerHistorico(string $nomenclatura, string $residente): array {
        $paramRes = "%" . $residente . "%";

        $stmt1 = $this->db->prepare("SELECT * FROM renovacion_contrato WHERE nomenclatura_anterior = ? OR nomenclatura_nueva = ? OR residente LIKE ? ORDER BY fecha_registro DESC");
        $stmt1->bind_param("sss", $nomenclatura, $nomenclatura, $paramRes);
        $stmt1->execute();
        $renovaciones = $stmt1->get_result()->fetch_all(MYSQLI_ASSOC);
        $stmt1->close();

        $stmt2 = $this->db->prepare("SELECT * FROM cambio_unidad WHERE nomenclatura_inicial = ? OR nomenclatura_nueva = ? OR residente LIKE ? ORDER BY fecha_cambio DESC");
        $stmt2->bind_param("sss", $nomenclatura, $nomenclatura, $paramRes);
        $stmt2->execute();
        $cambios = $stmt2->get_result()->fetch_all(MYSQLI_ASSOC);
        $stmt2->close();

        return [
            "renovaciones" => $renovaciones ?: [],
            "cambios"      => $cambios ?: []
        ];
    }

    public function renovar(array $data, int $idUsuario): array {
        $this->db->begin_transaction();
        try {
            $nomAnterior     = $data['nomenclatura_anterior'] ?? '';
            $nomNueva        = $data['nomenclatura_nueva'] ?? '';
            $residente       = $data['residente'] ?? '';
            $nuevaFechaOut   = $data['nueva_fecha_out'] ?? '';
            $fechaOutAnt     = $data['fecha_out_anterior'] ?? '';
            $nuevaRenta      = floatval($data['nueva_renta'] ?? 0);
            $rentaAnt        = floatval($data['renta_anterior'] ?? 0);
            $plazo           = $data['plazo_extension'] ?? '';
            $depNuevo        = $data['dep_nuevo'] ?? '';
            $recamaraNueva   = $data['recamara_nueva'] ?? '';

            if (empty($nomAnterior) || empty($nomNueva) || empty($nuevaFechaOut)) {
                throw new Exception("Datos obligatorios incompletos para renovar el contrato.");
            }

            if ($nomAnterior !== $nomNueva) {
                $stmtU1 = $this->db->prepare("UPDATE residentes SET nomenclatura = ? WHERE nomenclatura = ?");
                $stmtU1->bind_param("ss", $nomNueva, $nomAnterior);
                $stmtU1->execute();
                $stmtU1->close();

                $stmtU2 = $this->db->prepare("UPDATE estacionamiento SET nomenclatura = ? WHERE nomenclatura = ?");
                $stmtU2->bind_param("ss", $nomNueva, $nomAnterior);
                $stmtU2->execute();
                $stmtU2->close();

                $stmtU3 = $this->db->prepare("UPDATE contrato SET numero_departamento = ?, recamara = ?, fecha_move_out = ?, renta = ? WHERE nomenclatura = ?");
                $stmtU3->bind_param("sssds", $depNuevo, $recamaraNueva, $nuevaFechaOut, $nuevaRenta, $nomAnterior);
                $stmtU3->execute();
                $stmtU3->close();

                $stmtB = $this->db->prepare("INSERT INTO cambio_unidad (residente, nomenclatura_inicial, nomenclatura_nueva, motivo_cambio, fecha_cambio) VALUES (?, ?, ?, 'Renovación con cambio de unidad', CURDATE())");
                $stmtB->bind_param("sss", $residente, $nomAnterior, $nomNueva);
                $stmtB->execute();
                $stmtB->close();
            } else {
                $stmtR = $this->db->prepare("UPDATE contrato SET fecha_move_out = ?, renta = ? WHERE nomenclatura = ?");
                $stmtR->bind_param("sds", $nuevaFechaOut, $nuevaRenta, $nomAnterior);
                $stmtR->execute();
                $stmtR->close();
            }

            $stmtRen = $this->db->prepare("INSERT INTO renovacion_contrato (residente, nomenclatura_anterior, nomenclatura_nueva, fecha_out_anterior, fecha_out_nueva, renta_anterior, renta_nueva, plazo_extension) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
            $stmtRen->bind_param("sssssdds", $residente, $nomAnterior, $nomNueva, $fechaOutAnt, $nuevaFechaOut, $rentaAnt, $nuevaRenta, $plazo);
            $stmtRen->execute();
            $stmtRen->close();

            $this->bloqueo->liberar($nomAnterior, $idUsuario);
            $this->bloqueo->liberar($nomNueva, $idUsuario);

            $this->bitacora->registrar($idUsuario, "Renovación Contrato", "{$residente} ({$nomAnterior} -> {$nomNueva}). Plazo: {$plazo}. Nueva Renta: \${$nuevaRenta}");

            $this->db->commit();
            return ["success" => true, "message" => "Renovación procesada y registrada exitosamente."];
        } catch (Exception $e) {
            $this->db->rollback();
            return ["success" => false, "message" => $e->getMessage()];
        }
    }

    public function guardarAuto(array $data, int $idUsuario): array {
        $nomenclatura = trim($data['nomenclatura'] ?? '');
        $residente    = trim($data['residente'] ?? '');
        $opcion       = $data['opcion_auto'] ?? '';
        $motivo       = trim($data['motivo'] ?? '');

        if (empty($motivo)) {
            return ["success" => false, "message" => "El motivo del cambio de cajón/vehículo es obligatorio."];
        }

        $this->db->begin_transaction();
        try {
            $chkAnt = $this->db->prepare("SELECT cajon, numero_tag, modelo_auto, color_auto, placas FROM estacionamiento WHERE nomenclatura = ?");
            $chkAnt->bind_param("s", $nomenclatura);
            $chkAnt->execute();
            $resAnt = $chkAnt->get_result();
            $cajonAnterior = 'Ninguno';
            $tagAnterior = '';

            if ($rowAnt = $resAnt->fetch_assoc()) {
                $cajonAnterior = $rowAnt['cajon'] ?? 'Ninguno';
                $tagAnterior = $rowAnt['numero_tag'] ?? '';
            }
            $chkAnt->close();

            if ($opcion === 'RETIRAR') {
                $stmtD1 = $this->db->prepare("DELETE FROM estacionamiento WHERE nomenclatura = ?");
                $stmtD1->bind_param("s", $nomenclatura);
                $stmtD1->execute();
                $stmtD1->close();

                $stmtBit = $this->db->prepare("INSERT INTO cambios_cajon (nombre_completo, numero_tag, nomenclatura, cajon_anterior, cajon_nuevo, modelo_auto, color_auto, placas, motivo) VALUES (?, ?, ?, ?, 'Libre', '---', '---', '---', ?)");
                $stmtBit->bind_param("sssss", $residente, $tagAnterior, $nomenclatura, $cajonAnterior, $motivo);
                $stmtBit->execute();
                $stmtBit->close();

                $msg = "Vehículo retirado y cajón liberado correctamente.";
            } else {
                $cajonNuevo = $data['cajon'] ?? '';
                $modelo     = $data['modelo'] ?? '';
                $color      = $data['color'] ?? '';
                $tag        = $data['tag'] ?? '';
                $placas     = $data['placas'] ?? '';

                $chk = $this->db->prepare("SELECT nomenclatura FROM estacionamiento WHERE nomenclatura = ?");
                $chk->bind_param("s", $nomenclatura);
                $chk->execute();
                $resChk = $chk->get_result();
                $chk->close();

                if ($resChk->num_rows > 0) {
                    $stmtE = $this->db->prepare("UPDATE estacionamiento SET cajon = ?, numero_tag = ?, nombre_completo = ?, modelo_auto = ?, color_auto = ?, placas = ? WHERE nomenclatura = ?");
                    $stmtE->bind_param("sssssss", $cajonNuevo, $tag, $residente, $modelo, $color, $placas, $nomenclatura);
                } else {
                    $stmtE = $this->db->prepare("INSERT INTO estacionamiento (cajon, numero_tag, nombre_completo, nomenclatura, modelo_auto, color_auto, placas) VALUES (?, ?, ?, ?, ?, ?, ?)");
                    $stmtE->bind_param("sssssss", $cajonNuevo, $tag, $residente, $nomenclatura, $modelo, $color, $placas);
                }
                $stmtE->execute();
                $stmtE->close();

                $stmtBit = $this->db->prepare("INSERT INTO cambios_cajon (nombre_completo, numero_tag, nomenclatura, cajon_anterior, cajon_nuevo, modelo_auto, color_auto, placas, motivo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
                $stmtBit->bind_param("sssssssss", $residente, $tag, $nomenclatura, $cajonAnterior, $cajonNuevo, $modelo, $color, $placas, $motivo);
                $stmtBit->execute();
                $stmtBit->close();

                $msg = "Vehículo y cajón asignados correctamente.";
            }

            $this->bloqueo->liberar($nomenclatura, $idUsuario);
            $this->bitacora->registrar($idUsuario, "Gestión Vehículo/Cajón", "{$residente} ({$nomenclatura}): {$msg}. Motivo: {$motivo}");

            $this->db->commit();
            return ["success" => true, "message" => $msg];
        } catch (Exception $e) {
            $this->db->rollback();
            return ["success" => false, "message" => $e->getMessage()];
        }
    }
}
