<?php
header('Content-Type: application/json; charset=utf-8');

require_once 'config.php';
$conn = conectarDB();
$conn->set_charset("utf8mb4");

// CONSULTA OPTIMIZADA: Se incluye d.estado AS estado_dep para filtrar los deshabilitados
$sql = "SELECT 
            d.estado AS estado_dep,
            COALESCE(c.nombre_residente, r.nombre_completo) AS nombre,
            c.celular AS telefono,
            c.correo AS correo,
            r.genero,
            d.recamara,
            d.cama,
            d.nomenclatura,
            COALESCE(d.numero_dep, c.numero_departamento, SUBSTRING_INDEX(d.nomenclatura, '-', 1)) AS dep,
            COALESCE(
                d.nivel, 
                lm.nivel, 
                CASE 
                    WHEN LENGTH(COALESCE(d.numero_dep, c.numero_departamento, SUBSTRING_INDEX(d.nomenclatura, '-', 1))) = 4 
                        THEN CONCAT('N', SUBSTRING(COALESCE(d.numero_dep, c.numero_departamento, SUBSTRING_INDEX(d.nomenclatura, '-', 1)), 1, 2))
                    WHEN LENGTH(COALESCE(d.numero_dep, c.numero_departamento, SUBSTRING_INDEX(d.nomenclatura, '-', 1))) = 3 
                        THEN CONCAT('N', SUBSTRING(COALESCE(d.numero_dep, c.numero_departamento, SUBSTRING_INDEX(d.nomenclatura, '-', 1)), 1, 1))
                    ELSE 'PB'
                END
            ) AS nivel,
            COALESCE(d.tipologia, 'twin') AS tipologia,
            COALESCE(c.fecha_move_in, r.fecha_move_in) AS fecha_move_in,
            c.fecha_move_out,
            c.renta,
            e.cajon,
            COALESCE(lm.clave_maestra, CONCAT('KEY-', LPAD(COALESCE(d.numero_dep, c.numero_departamento, SUBSTRING_INDEX(d.nomenclatura, '-', 1)), 4, '0'))) AS clave_maestra,
            DATEDIFF(c.fecha_move_out, CURDATE()) AS dias_restantes,
            CASE 
                WHEN c.fecha_move_out IS NULL THEN 'Sin Contrato'
                WHEN DATEDIFF(c.fecha_move_out, CURDATE()) < 0 THEN 'Vencido'
                WHEN DATEDIFF(c.fecha_move_out, CURDATE()) <= 30 THEN 'Vence pronto'
                WHEN DATEDIFF(c.fecha_move_out, CURDATE()) <= 90 THEN 'Por vencer'
                ELSE 'Vigente'
            END AS status
        FROM departamentos d
        LEFT JOIN residentes r ON d.nomenclatura = r.nomenclatura
        LEFT JOIN contrato c ON d.nomenclatura = c.nomenclatura
        LEFT JOIN estacionamiento e ON d.nomenclatura = e.nomenclatura
        LEFT JOIN llaves_maestras lm ON COALESCE(d.numero_dep, c.numero_departamento, SUBSTRING_INDEX(d.nomenclatura, '-', 1)) = lm.numero_departamento
        ORDER BY CAST(COALESCE(d.numero_dep, c.numero_departamento, SUBSTRING_INDEX(d.nomenclatura, '-', 1)) AS UNSIGNED) ASC, d.nomenclatura ASC";

$result = $conn->query($sql);
$data = [];

if ($result) {
    while($row = $result->fetch_assoc()) {
        $data[] = $row;
    }
}

echo json_encode($data, JSON_UNESCAPED_UNICODE);
$conn->close();
?>