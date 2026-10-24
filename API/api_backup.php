<?php
header('Content-Type: application/sql; charset=utf-8');
header('Content-Disposition: attachment; filename="respaldo_utower_' . date('Y-m-d_H-i-s') . '.sql"');

$conn = new mysqli("localhost", "root", "", "estado_de_casa_utower");
if ($conn->connect_error) { exit("Error de conexión"); }
$conn->set_charset("utf8mb4");

$tables = [];
$result = $conn->query("SHOW TABLES");
while ($row = $result->fetch_row()) { $tables[] = $row[0]; }

$output = "-- Respaldo U-Tower Database\n-- Fecha: " . date('Y-m-d H:i:s') . "\n\n";

foreach ($tables as $table) {
    $output .= "DROP TABLE IF EXISTS `$table`;\n";
    $row2 = $conn->query("SHOW CREATE TABLE `$table`")->fetch_row();
    $output .= $row2[1] . ";\n\n";

    $rows = $conn->query("SELECT * FROM `$table`");
    while ($row = $rows->fetch_assoc()) {
        $fields = array_keys($row);
        $values = array_values($row);
        $escapedValues = array_map(function($val) use ($conn) {
            if ($val === null) return "NULL";
            return "'" . $conn->real_escape_string($val) . "'";
        }, $values);
        $output .= "INSERT INTO `$table` (`" . implode("`, `", $fields) . "`) VALUES (" . implode(", ", $escapedValues) . ");\n";
    }
    $output .= "\n\n";
}

echo $output;
$conn->close();
?>