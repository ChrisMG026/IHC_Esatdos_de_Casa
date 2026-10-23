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

        // Verificamos si ya existe el registro en la tabla estacionamiento
        $chk = $conn->prepare("SELECT cajon FROM estacionamiento WHERE cajon = ?");
        $chk->bind_param("s", $cajon);
        $chk->execute();
        $resChk = $chk->get_result();

        if ($resChk->num_rows > 0) {
            $stmt = $conn->prepare("UPDATE estacionamiento SET numero_tag = ?, nombre_completo = ?, modelo_auto = ?, color_auto = ?, placas = ? WHERE cajon = ?");
            $stmt->bind_param("ssssss", $tag, $nombre, $modelo, $color, $placas, $cajon);
        } else {
            $stmt = $conn->prepare("INSERT INTO estacionamiento (cajon, numero_tag, nombre_completo, nomenclatura, modelo_auto, color_auto, placas) VALUES (?, ?, ?, '---', ?, ?, ?)");
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
        ORDER BY 
            CASE WHEN c.nombre_cajon REGEXP '^[0-9]+$' THEN 0 ELSE 1 END,
            CAST(c.nombre_cajon AS UNSIGNED) ASC, 
            c.nombre_cajon ASC";

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