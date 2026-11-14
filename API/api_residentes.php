<?php
// API/api_residentes.php
// Consulta optimizada de residentes y departamentos con soporte para bloqueos concurrentes

header('Content-Type: application/json; charset=utf-8');

require_once 'config.php';
require_once 'auth_middleware.php';

// Liberar bloqueo de sesión de inmediato para permitir concurrencia de múltiples usuarios
liberar_bloqueo_sesion();

$conn = conectarDB();
$conn->set_charset("utf8mb4");

// Si solicitan catálogo de deshabilitados (cajones/departamentos) para el frontend sin requerir permisos de admin
if (isset($_GET['catalogo']) && $_GET['catalogo'] === 'deshabilitados') {
    try {
        $resCajonesDesh = $conn->query("SELECT nombre_cajon FROM cajones_estacionamiento WHERE estado = 'Deshabilitado'");
        $cajonesDesh = [];
        if ($resCajonesDesh) {
            while ($r = $resCajonesDesh->fetch_assoc()) {
                $cajonesDesh[] = $r['nombre_cajon'];
            }
        }
        
        $resDepsDesh = $conn->query("SELECT nomenclatura, numero_dep FROM departamentos WHERE estado = 'Deshabilitado'");
        $depsDesh = [];
        if ($resDepsDesh) {
            while ($r = $resDepsDesh->fetch_assoc()) {
                $depsDesh[] = $r;
            }
        }

        echo json_encode([
            "status" => "success",
            "cajones_deshabilitados" => $cajonesDesh,
            "departamentos_deshabilitados" => $depsDesh
        ], JSON_UNESCAPED_UNICODE);
    } catch (Throwable $e) {
        http_response_code(500);
        echo json_encode([
            "status" => "error",
            "message" => "Error al obtener catalogo de deshabilitados: " . $e->getMessage()
        ], JSON_UNESCAPED_UNICODE);
    }
    $conn->close();
    exit;
}

// Limpiar bloqueos vencidos de más de 60 segundos
$conn->query("DELETE FROM bloqueos_expedientes WHERE ultimo_latido < DATE_SUB(NOW(), INTERVAL 60 SECOND)");

// CONSULTA DE ALTO RENDIMIENTO:
// - Index lookup directo a llaves_maestras convirtiendo d.numero_dep a UNSIGNED
// - JOIN con bloqueos_expedientes para reflejar en tiempo real qué usuario está editando cada expediente
$sql = "SELECT 
            d.estado AS estado_dep,
            COALESCE(c.nombre_residente, r.nombre_completo) AS nombre,
            c.celular AS telefono,
            c.correo AS correo,
            r.genero,
            d.recamara,
            d.cama,
            d.nomenclatura,
            d.numero_dep AS dep,
            d.nivel AS nivel,
            d.tipologia AS tipologia,
            COALESCE(c.fecha_move_in, r.fecha_move_in) AS fecha_move_in,
            c.fecha_move_out,
            c.renta,
            e.cajon,
            COALESCE(lm.clave_maestra, CONCAT('KEY-', LPAD(d.numero_dep, 4, '0'))) AS clave_maestra,
            DATEDIFF(c.fecha_move_out, CURDATE()) AS dias_restantes,
            CASE 
                WHEN c.fecha_move_out IS NULL THEN 'Sin Contrato'
                WHEN DATEDIFF(c.fecha_move_out, CURDATE()) < 0 THEN 'Vencido'
                WHEN DATEDIFF(c.fecha_move_out, CURDATE()) <= 30 THEN 'Vence pronto'
                WHEN DATEDIFF(c.fecha_move_out, CURDATE()) <= 90 THEN 'Por vencer'
                ELSE 'Vigente'
            END AS status,
            b.nombre_usuario AS bloqueado_por,
            b.id_usuario AS bloqueado_por_id,
            b.fecha_bloqueo AS bloqueado_fecha
        FROM departamentos d
        LEFT JOIN residentes r ON d.nomenclatura = r.nomenclatura
        LEFT JOIN contrato c ON d.nomenclatura = c.nomenclatura
        LEFT JOIN estacionamiento e ON d.nomenclatura = e.nomenclatura
        LEFT JOIN llaves_maestras lm ON lm.numero_departamento = CAST(d.numero_dep AS UNSIGNED)
        LEFT JOIN bloqueos_expedientes b ON d.nomenclatura = b.nomenclatura COLLATE utf8mb4_general_ci AND b.ultimo_latido >= DATE_SUB(NOW(), INTERVAL 60 SECOND)
        ORDER BY CAST(d.numero_dep AS UNSIGNED) ASC, d.nomenclatura ASC";

try {
    $result = $conn->query($sql);
    $data = [];

    if ($result) {
        while($row = $result->fetch_assoc()) {
            $data[] = $row;
        }
    }

    echo json_encode($data, JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "Error al consultar residentes: " . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}
$conn->close();
?>
