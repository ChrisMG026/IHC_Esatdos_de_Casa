<?php
require_once 'auth_middleware.php';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    requerir_permiso('editar_admin_parking');
}
header('Content-Type: application/json; charset=utf-8');

require_once 'config.php';
$conn = conectarDB();

// PROCESAR ACTUALIZACIÓN DE CAJÓN ADMINISTRATIVO
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    $action = $data['action'] ?? '';

    if ($action === 'actualizar_admin') {
        $cajon       = $data['cajon'];
        $tag         = $data['numero_tag'];
        $nombre      = $data['nombre_completo'];
        $modelo      = $data['modelo_auto'];
        $color       = $data['color_auto'];
        $placas      = $data['placas'];

        // Verificamos si ya existe el registro
        $chk = $conn->prepare("SELECT cajon FROM estacionamiento WHERE cajon = ?");
        $chk->bind_param("s", $cajon);
        $chk->execute();
        $resChk = $chk->get_result();

        if ($resChk->num_rows > 0) {
            $stmt = $conn->prepare("UPDATE estacionamiento SET numero_tag = ?, nombre_completo = ?, modelo_auto = ?, color_auto = ?, placas = ? WHERE cajon = ?");
            $stmt->bind_param("ssssss", $tag, $nombre, $modelo, $color, $placas, $cajon);
        } else {
            // IMPORTANTE: Aquí usamos NULL en lugar de '---'
            $stmt = $conn->prepare("INSERT INTO estacionamiento (cajon, numero_tag, nombre_completo, nomenclatura, modelo_auto, color_auto, placas) VALUES (?, ?, ?, NULL, ?, ?, ?)");
            $stmt->bind_param("ssssss", $cajon, $tag, $nombre, $modelo, $color, $placas);
        }

        if ($stmt->execute()) {
            echo json_encode(["status" => "success", "message" => "Cajón administrativo actualizado correctamente."]);
        } else {
            echo json_encode(["status" => "error", "message" => "Error al actualizar: " . $conn->error]);
        }
        $conn->close();
        exit;
    }
}


// OBTENER TODOS LOS CAJONES
$sql = "SELECT 
            c.nombre_cajon AS cajon,
            e.numero_tag,
            e.nombre_completo,
            e.nomenclatura,
            e.modelo_auto,
            e.color_auto,
            e.placas,
            CASE WHEN e.cajon IS NOT NULL THEN 'Ocupado' ELSE 'Disponible' END AS estado
        FROM cajones_estacionamiento c
        LEFT JOIN estacionamiento e ON c.nombre_cajon = e.cajon
        
        UNION ALL
        
        SELECT 
            e.cajon AS cajon,
            e.numero_tag,
            e.nombre_completo,
            e.nomenclatura,
            e.modelo_auto,
            e.color_auto,
            e.placas,
            'Ocupado' AS estado
        FROM estacionamiento e
        LEFT JOIN cajones_estacionamiento c ON e.cajon = c.nombre_cajon
        WHERE c.nombre_cajon IS NULL
        
        ORDER BY 
            CASE WHEN cajon LIKE '%Cajón%' THEN 0 ELSE 1 END,
            CAST(REGEXP_REPLACE(cajon, '[^0-9]', '') AS UNSIGNED) ASC,
            cajon ASC";
$result = $conn->query($sql);
$data = [];

if ($result) {
    while ($row = $result->fetch_assoc()) {
        $data[] = $row;
    }
}

echo json_encode($data, JSON_UNESCAPED_UNICODE);
$conn->close();
?>