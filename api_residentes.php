<?php
header('Content-Type: application/json; charset=utf-8');

$host = "localhost";
$user = "root";
$pass = "";
$db   = "estado_de_casa_utower";

$conn = new mysqli($host,$user, $pass,$db);
if ($conn->connect_error) {
    die(json_encode(["error" => "Conexión fallida: " . $conn->connect_error]));
}

$conn->set_charset("utf8mb4");

// Traemos los datos priorizando la información completa de la tabla `contrato`
$sql = "SELECT 
            COALESCE(c.nombre_residente, r.nombre_completo) AS nombre,
            COALESCE(c.celular, r.telefono) AS telefono,
            COALESCE(c.correo, r.correo) AS correo,
            r.genero,
            d.recamara,
            d.cama,
            d.nomenclatura,
            COALESCE(d.numero_dep, c.numero_departamento, SUBSTRING_INDEX(d.nomenclatura, '-', 1)) AS dep,
            COALESCE(d.nivel, lm.nivel) AS nivel_db,
            d.tipologia AS tipologia_db,
            COALESCE(c.fecha_move_in, r.fecha_move_in) AS fecha_move_in,
            c.fecha_move_out,
            c.renta,
            e.cajon,
            lm.clave_maestra
        FROM departamentos d
        LEFT JOIN residentes r ON d.nomenclatura = r.nomenclatura
        LEFT JOIN contrato c ON d.nomenclatura = c.nomenclatura
        LEFT JOIN estacionamiento e ON d.nomenclatura = e.nomenclatura
        LEFT JOIN llaves_maestras lm ON COALESCE(d.numero_dep, c.numero_departamento, SUBSTRING_INDEX(d.nomenclatura, '-', 1)) = lm.numero_departamento
        ORDER BY CAST(COALESCE(d.numero_dep, c.numero_departamento, SUBSTRING_INDEX(d.nomenclatura, '-', 1)) AS UNSIGNED) ASC, d.nomenclatura ASC";

$result =$conn->query($sql);$data = [];

if ($result) {
    while($row =$result->fetch_assoc()) {
        $depNum = trim($row['dep'] ?? '');

        // --- Nivel inteligente de respaldo ---
        if (empty($row['nivel_db'])) {
            if (strlen($depNum) === 4) {
                $row['nivel'] = "N" . substr($depNum, 0, 2);
            } elseif (strlen($depNum) === 3) {$row['nivel'] = "N" . substr($depNum, 0, 1); } else {$row['nivel'] = "PB";
            }
        } else {
            $row['nivel'] =$row['nivel_db'];
        }

        // --- Tipología real desde BD ---
        $row['tipologia'] = !empty($row['tipologia_db']) ?$row['tipologia_db'] : 'twin';

        // --- Clave Maestra real desde BD ---
        if (empty($row['clave_maestra'])) {
            $row['clave_maestra'] = "KEY-" . str_pad($depNum, 4, "0", STR_PAD_LEFT);
        }

        $data[] =$row;
    }
}

echo json_encode($data, JSON_UNESCAPED_UNICODE);$conn->close();
?>