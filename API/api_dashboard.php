<?php
header('Content-Type: application/json; charset=utf-8');

$host = "localhost";
$user = "root";
$pass = "";
$db   = "estado_de_casa_utower";

$conn = new mysqli($host, $user, $pass, $db);
if ($conn->connect_error) {
    die(json_encode(["status" => "error", "message" => "Conexión fallida: " . $conn->connect_error]));
}

$conn->set_charset("utf8mb4");

// 1. MÉTRICAS TOTALES (KPIs)
$totalEspacios = $conn->query("SELECT COUNT(*) as total FROM departamentos")->fetch_assoc()['total'];
$ocupados = $conn->query("SELECT COUNT(*) as total FROM residentes WHERE nombre_completo IS NOT NULL AND TRIM(nombre_completo) != ''")->fetch_assoc()['total'];
$porcentajeOcupacion = $totalEspacios > 0 ? round(($ocupados / $totalEspacios) * 100, 1) : 0;

$ingresoTotal = $conn->query("SELECT SUM(renta) as total FROM contrato")->fetch_assoc()['total'] ?? 0;

$porVencer = $conn->query("SELECT COUNT(*) as total FROM contrato WHERE DATEDIFF(fecha_move_out, CURDATE()) BETWEEN 0 AND 30")->fetch_assoc()['total'];
$vencidos = $conn->query("SELECT COUNT(*) as total FROM contrato WHERE DATEDIFF(fecha_move_out, CURDATE()) < 0")->fetch_assoc()['total'];

// 2. OCUPACIÓN POR NIVEL / PISO
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
$resNiveles = $conn->query($sqlNiveles);
$nivelesData = $resNiveles ? $resNiveles->fetch_all(MYSQLI_ASSOC) : [];

// 3. DATOS DE ESTACIONAMIENTO
$totalCajones = $conn->query("SELECT COUNT(*) as total FROM cajones_estacionamiento WHERE nombre_cajon REGEXP '^[0-9]+$'")->fetch_assoc()['total'];
$cajonesOcupados = $conn->query("SELECT COUNT(*) as total FROM estacionamiento WHERE cajon REGEXP '^[0-9]+$'")->fetch_assoc()['total'];

// 4. DEMOGRAFÍA: HOMBRES VS MUJERES GENERAL
$sqlGenero = "SELECT 
                SUM(CASE WHEN genero = 'Masculino' OR genero = 'H' THEN 1 ELSE 0 END) as hombres,
                SUM(CASE WHEN genero = 'Femenino' OR genero = 'M' THEN 1 ELSE 0 END) as mujeres
              FROM residentes 
              WHERE nombre_completo IS NOT NULL AND TRIM(nombre_completo) != ''";
$resGenero = $conn->query($sqlGenero)->fetch_assoc();

// 5. DEMOGRAFÍA: HOMBRES Y MUJERES POR NIVEL / PISO
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
$resGeneroNivel = $conn->query($sqlGeneroNivel);
$generoNivelData = $resGeneroNivel ? $resGeneroNivel->fetch_all(MYSQLI_ASSOC) : [];

// 6. ÚLTIMOS 5 MOVIMIENTOS COMBINADOS (MOVE-IN Y MOVE-OUT)
$sqlUltimos = "SELECT 'Move-In' as tipo, nombre_residente as residente, nomenclatura, move_in as fecha FROM move_in
               UNION ALL
               SELECT 'Move-Out' as tipo, nombre_residente as residente, nomenclatura, move_out as fecha FROM move_out
               ORDER BY fecha DESC LIMIT 5";
$resUltimos = $conn->query($sqlUltimos);
$ultimosMovimientos = $resUltimos ? $resUltimos->fetch_all(MYSQLI_ASSOC) : [];

echo json_encode([
    "status" => "success",
    "kpis" => [
        "total_espacios" => intval($totalEspacios),
        "ocupados" => intval($ocupados),
        "disponibles" => intval($totalEspacios - $ocupados),
        "porcentaje_ocupacion" => floatval($porcentajeOcupacion),
        "ingreso_total" => floatval($ingresoTotal),
        "por_vencer" => intval($porVencer),
        "vencidos" => intval($vencidos),
        "total_cajones" => intval($totalCajones),
        "cajones_ocupados" => intval($cajonesOcupados)
    ],
    "niveles" => $nivelesData,
    "genero_general" => [
        "hombres" => intval($resGenero['hombres'] ?? 0),
        "mujeres" => intval($resGenero['mujeres'] ?? 0)
    ],
    "genero_nivel" => $generoNivelData,
    "ultimos_movimientos" => $ultimosMovimientos
], JSON_UNESCAPED_UNICODE);

$conn->close();
?>