<?php
require_once 'config/Database.php';
$db = Database::getInstance()->getConnection();
foreach (['residentes', 'contrato', 'departamentos', 'estacionamiento', 'bloqueos_expedientes'] as $t) {
    echo "=== TABLE $t ===\n";
    $r = $db->query("DESCRIBE $t");
    if ($r) {
        while ($row = $r->fetch_assoc()) {
            echo "  " . $row['Field'] . " (" . $row['Type'] . ")\n";
        }
    } else {
        echo "  Error: " . $db->error . "\n";
    }
}
unlink(__FILE__);
