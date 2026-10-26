<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

if (isset($_SESSION['id_usuario'])) {
    echo json_encode([
        "logueado" => true,
        "nombre" => $_SESSION['nombre'],
        "permisos" => $_SESSION['permisos']
    ]);
} else {
    echo json_encode(["logueado" => false]);
}
?>