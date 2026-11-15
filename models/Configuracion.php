<?php
// models/Configuracion.php
// ============================================================
// MODELO: CONFIGURACIONES DEL SISTEMA, LLAVES Y DESHABILITACIÓN
// ============================================================

require_once __DIR__ . '/../config/Database.php';
require_once __DIR__ . '/../models/Bitacora.php';

class Configuracion {
    private mysqli $db;
    private Bitacora $bitacora;

    public function __construct() {
        $this->db = Database::getInstance()->getConnection();
        $this->bitacora = new Bitacora();
    }

    public function obtenerTodo(): array {
        // 1. Llaves Maestras
        $sqlLlaves = "SELECT numero_departamento, nivel, tipologia, clave_maestra 
                      FROM llaves_maestras 
                      ORDER BY CAST(numero_departamento AS UNSIGNED) ASC";
        $resLlaves = $this->db->query($sqlLlaves);
        $llaves = [];
        if ($resLlaves) {
            while ($row = $resLlaves->fetch_assoc()) { $llaves[] = $row; }
        }

        // 2. Departamentos
        $sqlDeps = "SELECT nivel, numero_dep, tipologia, recamara, cama, nomenclatura, estado 
                    FROM departamentos 
                    ORDER BY FIELD(nivel, 'PB', 'N1', 'N2', 'N3', 'N4', 'N5', 'N6', 'N7', 'N8', 'N9', 'N10'), CAST(numero_dep AS UNSIGNED) ASC";
        $resDeps = $this->db->query($sqlDeps);
        $departamentos = [];
        if ($resDeps) {
            while ($row = $resDeps->fetch_assoc()) { $departamentos[] = $row; }
        }

        // 3. Cajones
        $sqlCajones = "SELECT nombre_cajon, estado 
                       FROM cajones_estacionamiento 
                       ORDER BY CAST(REGEXP_REPLACE(nombre_cajon, '[^0-9]', '') AS UNSIGNED) ASC";
        $resCajones = $this->db->query($sqlCajones);
        $cajones = [];
        if ($resCajones) {
            while ($row = $resCajones->fetch_assoc()) { $cajones[] = $row; }
        }

        return [
            "llaves" => $llaves,
            "departamentos" => $departamentos,
            "cajones" => $cajones
        ];
    }

    public function guardarClaveMaestra(string $numeroDep, string $clave, int $idUsuario): array {
        $stmt = $this->db->prepare("UPDATE llaves_maestras SET clave_maestra = ? WHERE numero_departamento = ?");
        $stmt->bind_param("ss", $clave, $numeroDep);
        $ok = $stmt->execute();
        $stmt->close();

        if ($ok) {
            $this->bitacora->registrar($idUsuario, "Actualización Clave", "Dep: {$numeroDep}");
            return ["success" => true, "message" => "Clave actualizada exitosamente."];
        }
        return ["success" => false, "message" => "Error al actualizar la clave maestra."];
    }

    public function procesarCsvClaves($handle, int $idUsuario): array {
        fgetcsv($handle, 1000, ","); // Omitir cabecera
        $this->db->begin_transaction();
        try {
            $stmt = $this->db->prepare("UPDATE llaves_maestras SET clave_maestra = ? WHERE numero_departamento = ?");
            $procesados = 0;
            while (($data = fgetcsv($handle, 1000, ",")) !== FALSE) {
                $numDep = trim($data[0] ?? '');
                $clave  = trim($data[3] ?? '');
                if (!empty($numDep) && !empty($clave)) {
                    $stmt->bind_param("ss", $clave, $numDep);
                    $stmt->execute();
                    $procesados++;
                }
            }
            $stmt->close();
            $this->db->commit();

            $this->bitacora->registrar($idUsuario, "Carga Masiva Claves", "Se actualizaron {$procesados} claves desde CSV.");
            return ["success" => true, "message" => "Carga masiva completada. Se actualizaron {$procesados} claves.", "procesados" => $procesados];
        } catch (Exception $e) {
            $this->db->rollback();
            return ["success" => false, "message" => "Error en la base de datos: " . $e->getMessage()];
        }
    }

    public function toggleEstadoDepartamento(string $nomenclatura, string $nuevoEstado, string $razon, int $idUsuario): array {
        if (empty($nomenclatura) || empty($razon)) {
            return ["success" => false, "message" => "Nomenclatura y motivo son obligatorios."];
        }

        $stmt = $this->db->prepare("UPDATE departamentos SET estado = ? WHERE nomenclatura = ?");
        $stmt->bind_param("ss", $nuevoEstado, $nomenclatura);
        if ($stmt->execute()) {
            $stmt->close();
            $numDep = explode('-', $nomenclatura)[0];
            $razonRegistro = "[$nuevoEstado] " . $razon;

            $stmtIns = $this->db->prepare("INSERT INTO departamentos_deshabilitados (nomenclatura, numero_dep, razon) VALUES (?, ?, ?)");
            $stmtIns->bind_param("sss", $nomenclatura, $numDep, $razonRegistro);
            $stmtIns->execute();
            $stmtIns->close();

            $this->bitacora->registrar($idUsuario, "Estado Departamento", "{$nomenclatura} -> {$nuevoEstado}. Razón: {$razon}");
            return ["success" => true, "message" => "Estado de departamento actualizado correctamente."];
        }
        $stmt->close();
        return ["success" => false, "message" => "Error al actualizar departamento."];
    }

    public function toggleEstadoCajon(string $nombreCajon, string $nuevoEstado, string $razon, int $idUsuario): array {
        if (empty($nombreCajon) || empty($razon)) {
            return ["success" => false, "message" => "Nombre de cajón y motivo son obligatorios."];
        }

        $stmt = $this->db->prepare("UPDATE cajones_estacionamiento SET estado = ? WHERE nombre_cajon = ?");
        $stmt->bind_param("ss", $nuevoEstado, $nombreCajon);
        if ($stmt->execute()) {
            $stmt->close();
            $razonRegistro = "[$nuevoEstado] " . $razon;

            $stmtIns = $this->db->prepare("INSERT INTO cajones_deshabilitados (nombre_cajon, razon) VALUES (?, ?)");
            $stmtIns->bind_param("ss", $nombreCajon, $razonRegistro);
            $stmtIns->execute();
            $stmtIns->close();

            $this->bitacora->registrar($idUsuario, "Estado Cajón", "{$nombreCajon} -> {$nuevoEstado}. Razón: {$razon}");
            return ["success" => true, "message" => "Estado de cajón actualizado correctamente."];
        }
        $stmt->close();
        return ["success" => false, "message" => "Error al actualizar cajón."];
    }
}
