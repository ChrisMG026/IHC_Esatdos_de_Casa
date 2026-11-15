<?php
// models/Reporte.php
// ============================================================
// MODELO: REPORTES DEL SISTEMA Y MÉTRICAS (KPIS) DE DASHBOARD
// ============================================================

require_once __DIR__ . '/../config/Database.php';

class Reporte {
    private mysqli $db;

    public function __construct() {
        $this->db = Database::getInstance()->getConnection();
    }

    public function obtenerDatosReportes(): array {
        // 1. Cambios de Cajón
        $sqlCambiosCajon = "SELECT nombre_completo, numero_tag, nomenclatura, cajon_anterior, cajon_nuevo, modelo_auto, color_auto, placas, motivo, fecha_cambio 
                            FROM cambios_cajon 
                            ORDER BY fecha_cambio DESC";
        $res1 = $this->db->query($sqlCambiosCajon);
        $cambiosCajon = $res1 ? $res1->fetch_all(MYSQLI_ASSOC) : [];

        // 2. Cambio de Unidad
        $sqlCambioUnidad = "SELECT residente, nomenclatura_inicial, nomenclatura_nueva, motivo_cambio, fecha_cambio 
                            FROM cambio_unidad 
                            ORDER BY fecha_cambio DESC";
        $res2 = $this->db->query($sqlCambioUnidad);
        $cambioUnidad = $res2 ? $res2->fetch_all(MYSQLI_ASSOC) : [];

        // 3. Move-In
        $sqlMoveIn = "SELECT numero_departamento, tipologia, recamara, cama, nomenclatura, nombre_residente, move_in 
                      FROM move_in 
                      ORDER BY move_in DESC";
        $res3 = $this->db->query($sqlMoveIn);
        $moveIn = $res3 ? $res3->fetch_all(MYSQLI_ASSOC) : [];

        // 4. Move-Out
        $sqlMoveOut = "SELECT nomenclatura, nombre_residente, move_in, move_out, motivo_salida 
                       FROM move_out 
                       ORDER BY move_out DESC";
        $res4 = $this->db->query($sqlMoveOut);
        $moveOut = $res4 ? $res4->fetch_all(MYSQLI_ASSOC) : [];

        // 5. Renovación de Contrato
        $sqlRenovacion = "SELECT residente, nomenclatura_anterior, nomenclatura_nueva, fecha_out_anterior, fecha_out_nueva, renta_anterior, renta_nueva, plazo_extension, fecha_registro 
                          FROM renovacion_contrato 
                          ORDER BY fecha_registro DESC";
        $res5 = $this->db->query($sqlRenovacion);
        $renovacionContrato = $res5 ? $res5->fetch_all(MYSQLI_ASSOC) : [];

        // 6. Departamentos Deshabilitados
        $sqlDepsDesh = "SELECT nomenclatura, numero_dep, razon, fecha_deshabilitacion 
                        FROM departamentos_deshabilitados 
                        ORDER BY fecha_deshabilitacion DESC";
        $res6 = $this->db->query($sqlDepsDesh);
        $departamentosDeshabilitados = $res6 ? $res6->fetch_all(MYSQLI_ASSOC) : [];

        // 7. Cajones Deshabilitados
        $sqlCajonesDesh = "SELECT nombre_cajon, razon, fecha_deshabilitacion 
                          FROM cajones_deshabilitados 
                          ORDER BY fecha_deshabilitacion DESC";
        $res7 = $this->db->query($sqlCajonesDesh);
        $cajonesDeshabilitados = $res7 ? $res7->fetch_all(MYSQLI_ASSOC) : [];

        return [
            "cambios_cajon" => $cambiosCajon,
            "cambio_unidad" => $cambioUnidad,
            "move_in" => $moveIn,
            "move_out" => $moveOut,
            "renovacion_contrato" => $renovacionContrato,
            "departamentos_deshabilitados" => $departamentosDeshabilitados,
            "cajones_deshabilitados" => $cajonesDeshabilitados
        ];
    }

    public function obtenerKpisDashboard(): array {
        // 1. Métricas Totales
        $totalEspacios = (int)($this->db->query("SELECT COUNT(*) as total FROM departamentos")->fetch_assoc()['total'] ?? 0);
        $ocupados = (int)($this->db->query("SELECT COUNT(*) as total FROM residentes WHERE nombre_completo IS NOT NULL AND TRIM(nombre_completo) != ''")->fetch_assoc()['total'] ?? 0);
        $porcentajeOcupacion = $totalEspacios > 0 ? round(($ocupados / $totalEspacios) * 100, 1) : 0.0;

        $resIngreso = $this->db->query("SELECT SUM(renta) as total FROM contrato");
        $ingresoTotal = 0.0;
        if ($resIngreso && $rowIngreso = $resIngreso->fetch_assoc()) {
            $ingresoTotal = (float)($rowIngreso['total'] ?? 0);
        }

        $porVencer = (int)($this->db->query("SELECT COUNT(*) as total FROM contrato WHERE DATEDIFF(fecha_move_out, CURDATE()) BETWEEN 0 AND 30")->fetch_assoc()['total'] ?? 0);
        $vencidos = (int)($this->db->query("SELECT COUNT(*) as total FROM contrato WHERE DATEDIFF(fecha_move_out, CURDATE()) < 0")->fetch_assoc()['total'] ?? 0);

        // 2. Ocupación por Nivel
        $sqlNiveles = "SELECT COALESCE(d.nivel, 'PB') as nivel, COUNT(*) as total, 
                       SUM(CASE WHEN r.nombre_completo IS NOT NULL AND TRIM(r.nombre_completo) != '' THEN 1 ELSE 0 END) as ocupados
                       FROM departamentos d
                       LEFT JOIN residentes r ON d.nomenclatura = r.nomenclatura
                       GROUP BY COALESCE(d.nivel, 'PB')
                       ORDER BY 
                           CASE 
                               WHEN COALESCE(d.nivel, 'PB') = 'PB' THEN 0 
                               ELSE CAST(REGEXP_REPLACE(d.nivel, '[^0-9]', '') AS UNSIGNED) 
                           END ASC";
        $resNiveles = $this->db->query($sqlNiveles);
        $nivelesData = $resNiveles ? $resNiveles->fetch_all(MYSQLI_ASSOC) : [];

        // 3. Estacionamiento
        $totalCajones = (int)($this->db->query("SELECT COUNT(*) as total FROM cajones_estacionamiento WHERE nombre_cajon LIKE 'Cajón%'")->fetch_assoc()['total'] ?? 0);
        $cajonesOcupados = (int)($this->db->query("SELECT COUNT(*) as total FROM estacionamiento WHERE cajon LIKE 'Cajón%' AND nombre_completo IS NOT NULL AND nombre_completo != ''")->fetch_assoc()['total'] ?? 0);

        // 4. Demografía por Género General
        $sqlGenero = "SELECT 
                        SUM(CASE WHEN genero = 'Masculino' OR genero = 'H' THEN 1 ELSE 0 END) as hombres,
                        SUM(CASE WHEN genero = 'Femenino' OR genero = 'M' THEN 1 ELSE 0 END) as mujeres
                      FROM residentes 
                      WHERE nombre_completo IS NOT NULL AND TRIM(nombre_completo) != ''";
        $resGenero = $this->db->query($sqlGenero)->fetch_assoc();

        // 5. Demografía por Nivel
        $sqlGeneroNivel = "SELECT 
                            COALESCE(d.nivel, 'PB') as nivel,
                            SUM(CASE WHEN r.genero = 'Masculino' OR r.genero = 'H' THEN 1 ELSE 0 END) as hombres,
                            SUM(CASE WHEN r.genero = 'Femenino' OR r.genero = 'M' THEN 1 ELSE 0 END) as mujeres
                           FROM departamentos d
                           LEFT JOIN residentes r ON d.nomenclatura = r.nomenclatura
                           GROUP BY COALESCE(d.nivel, 'PB')
                           ORDER BY 
                               CASE 
                                   WHEN COALESCE(d.nivel, 'PB') = 'PB' THEN 0 
                                   ELSE CAST(REGEXP_REPLACE(d.nivel, '[^0-9]', '') AS UNSIGNED) 
                               END ASC";
        $resGeneroNivel = $this->db->query($sqlGeneroNivel);
        $generoNivelData = $resGeneroNivel ? $resGeneroNivel->fetch_all(MYSQLI_ASSOC) : [];

        // 6. Últimos 5 movimientos combinados
        $sqlUltimos = "SELECT 'Move-In' as tipo, nombre_residente as residente, nomenclatura, move_in as fecha FROM move_in
                       UNION ALL
                       SELECT 'Move-Out' as tipo, nombre_residente as residente, nomenclatura, move_out as fecha FROM move_out
                       ORDER BY fecha DESC LIMIT 5";
        $resUltimos = $this->db->query($sqlUltimos);
        $ultimosMovimientos = $resUltimos ? $resUltimos->fetch_all(MYSQLI_ASSOC) : [];

        return [
            "kpis" => [
                "total_espacios"       => $totalEspacios,
                "ocupados"             => $ocupados,
                "disponibles"          => max(0, $totalEspacios - $ocupados),
                "porcentaje_ocupacion" => $porcentajeOcupacion,
                "ingreso_total"        => $ingresoTotal,
                "por_vencer"           => $porVencer,
                "vencidos"             => $vencidos,
                "total_cajones"        => $totalCajones,
                "cajones_ocupados"     => $cajonesOcupados
            ],
            "niveles"              => $nivelesData,
            "genero_general"       => [
                "hombres" => (int)($resGenero['hombres'] ?? 0),
                "mujeres" => (int)($resGenero['mujeres'] ?? 0)
            ],
            "genero_nivel"         => $generoNivelData,
            "ultimos_movimientos"  => $ultimosMovimientos
        ];
    }
}
