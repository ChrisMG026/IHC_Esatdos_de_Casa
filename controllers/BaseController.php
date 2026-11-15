<?php
// controllers/BaseController.php
// ============================================================
// CONTROLADOR BASE: MÉTODOS Y RESPUESTAS ESTANDARIZADAS
// ============================================================

require_once __DIR__ . '/../config/AuthMiddleware.php';

abstract class BaseController {

    protected function jsonResponse(array $data, int $statusCode = 200): void {
        http_response_code($statusCode);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($data, JSON_UNESCAPED_UNICODE);
        exit;
    }

    protected function errorResponse(string $message, int $statusCode = 400): void {
        $this->jsonResponse(["status" => "error", "message" => $message], $statusCode);
    }

    protected function successResponse(string $message, array $extra = [], int $statusCode = 200): void {
        $payload = array_merge(["status" => "success", "message" => $message], $extra);
        $this->jsonResponse($payload, $statusCode);
    }

    protected function getJsonInput(): array {
        $raw = file_get_contents('php://input');
        if (empty($raw)) return [];
        $decoded = json_decode($raw, true);
        return is_array($decoded) ? $decoded : [];
    }

    protected function getIdUsuario(): int {
        return (int)($_SESSION['id_usuario'] ?? 0);
    }

    protected function getNombreUsuario(): string {
        return $_SESSION['nombre'] ?? 'Usuario del Sistema';
    }

    abstract public function handleRequest(): void;
}
