<?php
// models/CargaMasiva.php
// ============================================================
// MODELO: CARGA Y DESCARGA MASIVA DE DATOS (CSV)
// ============================================================

require_once __DIR__ . '/../config/Database.php';
require_once __DIR__ . '/../models/Bitacora.php';

class CargaMasiva {
    private mysqli $db;
    private Bitacora $bitacora;

    public function __construct() {
        $this->db = Database::getInstance()->getConnection();
        $this->bitacora = new Bitacora();
    }

    public static function normalizarFechaMySQL(string $fechaStr): string {
        $fechaStr = trim($fechaStr);
        if (empty($fechaStr) || $fechaStr === '0000-00-00' || strtolower($fechaStr) === 'n/a') {
            return date('Y-m-d');
        }

        if (preg_match('/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/', $fechaStr, $m)) {
            return sprintf('%04d-%02d-%02d', $m[3], $m[2], $m[1]);
        }

        if (preg_match('/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/', $fechaStr, $m)) {
            return sprintf('%04d-%02d-%02d', $m[1], $m[2], $m[3]);
        }

        if (is_numeric($fechaStr) && intval($fechaStr) > 30000) {
            $unixDate = ($fechaStr - 25569) * 86400;
            return gmdate('Y-m-d', $unixDate);
        }

        return date('Y-m-d');
    }

    public function generarPlantillaCsv(string $tipo): void {
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="Plantilla_Masiva_' . ucfirst($tipo) . '_' . date('Y-m-d') . '.csv"');

        $output = fopen('php://output', 'w');
        fputs($output, chr(0xEF) . chr(0xBB) . chr(0xBF)); // BOM UTF-8

        if ($tipo === 'residentes') {
            fputcsv($output, ['Nomenclatura', 'Nombre Completo', 'Genero', 'Fecha Move In']);
            $sql = "SELECT d.nomenclatura, COALESCE(r.nombre_completo, '') AS nombre_completo, COALESCE(r.genero, 'Masculino') AS genero, COALESCE(r.fecha_move_in, CURDATE()) AS fecha_move_in
                    FROM departamentos d
                    LEFT JOIN residentes r ON d.nomenclatura = r.nomenclatura
                    ORDER BY d.nomenclatura ASC";
        } else {
            fputcsv($output, ['Nomenclatura', 'Numero Departamento', 'Recamara', 'Nombre Residente', 'Celular', 'Correo', 'Renta', 'Tiene Carro', 'Fecha Move In', 'Fecha Move Out']);
            $sql = "SELECT d.nomenclatura, d.numero_dep, d.recamara, COALESCE(c.nombre_residente, '') AS nombre_residente, COALESCE(c.celular, '') AS celular, COALESCE(c.correo, '') AS correo, COALESCE(c.renta, 10200) AS renta, COALESCE(c.tiene_carro, 'No') AS tiene_carro, COALESCE(c.fecha_move_in, CURDATE()) AS fecha_move_in, COALESCE(c.fecha_move_out, DATE_ADD(CURDATE(), INTERVAL 1 YEAR)) AS fecha_move_out
                    FROM departamentos d
                    LEFT JOIN contrato c ON d.nomenclatura = c.nomenclatura
                    ORDER BY d.nomenclatura ASC";
        }

        $res = $this->db->query($sql);
        if ($res) {
            while ($row = $res->fetch_assoc()) {
                fputcsv($output, array_values($row));
            }
        }
        fclose($output);
    }

    public function procesarArchivoCsv(string $tipo, $handle, int $idUsuario): array {
        fgetcsv($handle, 1000, ","); // Omitir cabecera
        $this->db->begin_transaction();
        try {
            $this->db->query("SET FOREIGN_KEY_CHECKS = 0");

            if ($tipo === 'residentes') {
                $this->db->query("TRUNCATE TABLE residentes");
                $stmt = $this->db->prepare("INSERT INTO residentes (nomenclatura, nombre_completo, genero, fecha_move_in) VALUES (?, ?, ?, ?)");
                
                $procesados = 0;
                while (($data = fgetcsv($handle, 1000, ",")) !== FALSE) {
                    $nom = trim($data[0] ?? '');
                    $nombre = trim($data[1] ?? '');
                    $genero = trim($data[2] ?? 'Masculino');
                    $moveIn = self::normalizarFechaMySQL($data[3] ?? '');

                    if (empty($nom)) continue;

                    if (!empty($nombre)) {
                        $stmt->bind_param("ssss", $nom, $nombre, $genero, $moveIn);
                        $stmt->execute();
                        $procesados++;
                    }
                }
                $stmt->close();
                $msg = "Carga masiva de Residentes completada. Se actualizaron {$procesados} registros.";
            } else {
                $this->db->query("TRUNCATE TABLE contrato");
                $stmt = $this->db->prepare("INSERT INTO contrato (nomenclatura, numero_departamento, recamara, nombre_residente, celular, correo, renta, tiene_carro, fecha_move_in, fecha_move_out) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
                
                $procesados = 0;
                while (($data = fgetcsv($handle, 1000, ",")) !== FALSE) {
                    $nom = trim($data[0] ?? '');
                    $dep = trim($data[1] ?? '101');
                    $rec = trim($data[2] ?? 'A1');
                    $nombre = trim($data[3] ?? '');
                    $cel = trim($data[4] ?? '');
                    $correo = trim($data[5] ?? '');
                    $renta = floatval($data[6] ?? 0);
                    $carro = trim($data[7] ?? 'No');
                    $moveIn = self::normalizarFechaMySQL($data[8] ?? '');
                    $moveOut = self::normalizarFechaMySQL($data[9] ?? '');

                    if (empty($nom)) continue;

                    if (!empty($nombre)) {
                        $stmt->bind_param("sssssssdss", $nom, $dep, $rec, $nombre, $cel, $correo, $renta, $carro, $moveIn, $moveOut);
                        $stmt->execute();
                        $procesados++;
                    }
                }
                $stmt->close();
                $msg = "Carga masiva de Contratos completada. Se actualizaron {$procesados} registros.";
            }

            $this->db->query("SET FOREIGN_KEY_CHECKS = 1");
            $this->db->commit();

            $this->bitacora->registrar($idUsuario, "Carga Masiva", "{$tipo}: {$procesados} registros cargados.");
            return ["success" => true, "message" => $msg, "procesados" => $procesados];
        } catch (Exception $e) {
            $this->db->rollback();
            return ["success" => false, "message" => "Error en procesamiento masivo: " . $e->getMessage()];
        }
    }
}
