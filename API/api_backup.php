<?php

require_once 'auth_middleware.php';
requerir_permiso('backup_sql');

require_once 'config.php';
$conn = conectarDB();

header('Content-Type: application/sql; charset=utf-8');
header('Content-Disposition: attachment; filename="respaldo_utower_' . date('Y-m-d_H-i-s') . '.sql"');


$output = "-- Respaldo U-Tower Database\n-- Fecha: " . date('Y-m-d H:i:s') . "\n\n";
$output .= "SET FOREIGN_KEY_CHECKS = 0;\n\n";

$tables = [];
$result = $conn->query("SHOW TABLES");
while ($row = $result->fetch_row()) { $tables[] = $row[0]; }

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

$output .= "SET FOREIGN_KEY_CHECKS = 1;\n";
echo $output;
$conn->close();
?>