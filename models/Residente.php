<?php
// models/Residente.php
// ============================================================
// MODELO: GESTIÓN INTEGRAL DE RESIDENTES, UNIDADES Y ESTADOS
// ============================================================

require_once __DIR__ . '/../config/Database.php';
require_once __DIR__ . '/../models/Bitacora.php';
require_once __DIR__ . '/../models/Bloqueo.php';

class Residente {
    private mysqli $db;
    private Bitacora $bitacora;
    private Bloqueo $bloqueo;

    public function __construct() {
        $this->db = Database::getInstance()->getConnection();
        $this->bitacora = new Bitacora();
        $this->bloqueo = new Bloqueo();
    }

    public function obtenerTodos(): array {
        $this->bloqueo->limpiarExpirados();
        $ttl = LOCK_TTL_SECONDS;

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
                LEFT JOIN bloqueos_expedientes b ON d.nomenclatura = b.nomenclatura COLLATE utf8mb4_general_ci AND b.ultimo_latido >= DATE_SUB(NOW(), INTERVAL {$ttl} SECOND)
                ORDER BY CAST(d.numero_dep AS UNSIGNED) ASC, d.nomenclatura ASC";

        $result = $this->db->query($sql);
        $data = [];
        if ($result) {
            while ($row = $result->fetch_assoc()) {
                $data[] = $row;
            }
        }
        return $data;
    }

    public function obtenerCatalogoDeshabilitados(): array {
        $resCajonesDesh = $this->db->query("SELECT nombre_cajon FROM cajones_estacionamiento WHERE estado = 'Deshabilitado'");
        $cajonesDesh = [];
        if ($resCajonesDesh) {
            while ($r = $resCajonesDesh->fetch_assoc()) {
                $cajonesDesh[] = $r['nombre_cajon'];
            }
        }

        $resDepsDesh = $this->db->query("SELECT nomenclatura, numero_dep FROM departamentos WHERE estado = 'Deshabilitado'");
        $depsDesh = [];
        if ($resDepsDesh) {
            while ($r = $resDepsDesh->fetch_assoc()) {
                $depsDesh[] = $r;
            }
        }

        return [
            "cajones_deshabilitados" => $cajonesDesh,
            "departamentos_deshabilitados" => $depsDesh
        ];
    }

    public function guardar(array $data, int $idUsuario): array {
        $this->db->begin_transaction();
        try {
            $nombreCompleto = trim($data['nombre_completo'] ?? '');
            $genero         = trim($data['genero'] ?? '');
            $correo         = trim($data['correo'] ?? '');
            $tieneCarro     = $data['tiene_carro'] ?? 'No';
            $deseaRegistrar = $data['desea_registrar_auto'] ?? 'NO';

            $dep            = trim($data['dep'] ?? '');
            $recamara       = trim($data['recamara'] ?? '');
            $cama           = trim($data['cama'] ?? '');
            $nomenclatura   = trim($data['nomenclatura'] ?? '');
            $tipologia      = trim($data['tipologia'] ?? 'twin');
            $renta          = floatval($data['renta'] ?? 0);
            $fechaMoveIn    = trim($data['fecha_move_in'] ?? '');
            $fechaMoveOut   = trim($data['fecha_move_out'] ?? '');
            $esEdicion      = !empty($data['es_edicion']);

            $telefonoRaw = trim($data['telefono'] ?? '');
            $telefono = preg_replace('/[^0-9]/', '', $telefonoRaw);
            if (strlen($telefono) < 10) {
                throw new Exception("El teléfono debe contener al menos 10 dígitos numéricos.");
            }

            if ($esEdicion) {
                if (empty($dep) || empty($nomenclatura) || empty($fechaMoveIn) || empty($fechaMoveOut) || $renta <= 0) {
                    $stmtBusq = $this->db->prepare("SELECT numero_departamento, nomenclatura, recamara, fecha_move_in, fecha_move_out, renta, tipologia FROM contrato WHERE nombre_residente = ? LIMIT 1");
                    $stmtBusq->bind_param("s", $nombreCompleto);
                    $stmtBusq->execute();
                    $resBusq = $stmtBusq->get_result()->fetch_assoc();
                    $stmtBusq->close();

                    if ($resBusq) {
                        $dep = $resBusq['numero_departamento'];
                        $nomenclatura = $resBusq['nomenclatura'];
                        $recamara = $resBusq['recamara'];
                        $fechaMoveIn = $resBusq['fecha_move_in'];
                        $fechaMoveOut = $resBusq['fecha_move_out'];
                        $renta = floatval($resBusq['renta']);
                        $tipologia = $resBusq['tipologia'];
                    }
                }
            }

            if (empty($nombreCompleto) || empty($dep) || empty($recamara) || empty($nomenclatura) || empty($fechaMoveIn) || empty($fechaMoveOut) || $renta <= 0) {
                throw new Exception("Faltan datos obligatorios para registrar al residente o su contrato.");
            }

            // Validar bloqueo por otro usuario
            $ttl = LOCK_TTL_SECONDS;
            $stmtLock = $this->db->prepare("SELECT nombre_usuario FROM bloqueos_expedientes 
                                           WHERE nomenclatura = ? AND id_usuario != ? AND ultimo_latido >= DATE_SUB(NOW(), INTERVAL {$ttl} SECOND) LIMIT 1");
            $stmtLock->bind_param("si", $nomenclatura, $idUsuario);
            $stmtLock->execute();
            $lockRes = $stmtLock->get_result()->fetch_assoc();
            $stmtLock->close();

            if ($lockRes) {
                throw new Exception("No puedes guardar: la unidad {$nomenclatura} está siendo editada por {$lockRes['nombre_usuario']}.");
            }

            // 4. Validar existencia del residente
            $chk = $this->db->prepare("SELECT id_residente FROM residentes WHERE nomenclatura = ?");
            $chk->bind_param("s", $nomenclatura);
            $chk->execute();
            $existeResidente = $chk->get_result()->num_rows > 0;
            $chk->close();

            if ($esEdicion || $existeResidente) {
                // Actualizar residente existente (la tabla residentes no tiene recamara ni cama)
                $stmt1 = $this->db->prepare("UPDATE residentes SET nombre_completo = ?, genero = ? WHERE nomenclatura = ?");
                $stmt1->bind_param("sss", $nombreCompleto, $genero, $nomenclatura);
                $stmt1->execute();
                $stmt1->close();

                // Verificar si existe contrato
                $chkC = $this->db->prepare("SELECT id_contrato FROM contrato WHERE nomenclatura = ?");
                $chkC->bind_param("s", $nomenclatura);
                $chkC->execute();
                $existeContrato = $chkC->get_result()->num_rows > 0;
                $chkC->close();

                if ($existeContrato) {
                    $stmt2 = $this->db->prepare("UPDATE contrato SET nombre_residente = ?, celular = ?, correo = ?, tiene_carro = ? WHERE nomenclatura = ?");
                    $stmt2->bind_param("sssss", $nombreCompleto, $telefono, $correo, $tieneCarro, $nomenclatura);
                    $stmt2->execute();
                    $stmt2->close();
                } else {
                    $depVal = !empty($dep) ? intval($dep) : intval(explode('-', $nomenclatura)[0]);
                    $recVal = !empty($recamara) ? $recamara : 'A1';
                    $rentaVal = $renta > 0 ? $renta : 10200.00;
                    $fechaInVal = !empty($fechaMoveIn) ? $fechaMoveIn : date('Y-m-d');
                    $fechaOutVal = !empty($fechaMoveOut) ? $fechaMoveOut : date('Y-m-d', strtotime('+1 year'));

                    $stmt2 = $this->db->prepare("INSERT INTO contrato (numero_departamento, recamara, nombre_residente, celular, correo, renta, tiene_carro, fecha_move_in, fecha_move_out) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
                    $stmt2->bind_param("issssdsss", $depVal, $recVal, $nombreCompleto, $telefono, $correo, $rentaVal, $tieneCarro, $fechaInVal, $fechaOutVal);
                    $stmt2->execute();
                    $stmt2->close();
                }

                // Estacionamiento en modo edición
                $stmtDelEst = $this->db->prepare("DELETE FROM estacionamiento WHERE nomenclatura = ?");
                $stmtDelEst->bind_param("s", $nomenclatura);
                $stmtDelEst->execute();
                $stmtDelEst->close();

                if (!empty($data['cajon']) && $data['cajon'] !== '') {
                    $cajonRaw = $data['cajon'];
                    preg_match('/\d+/', $cajonRaw, $matches);
                    $numeroCajon = isset($matches[0]) ? (int)$matches[0] : 0;
                    if ($numeroCajon > 0) {
                        $stmtEst = $this->db->prepare("INSERT INTO estacionamiento (cajon, numero_tag, nombre_completo, nomenclatura, modelo_auto, color_auto, placas) VALUES (?, ?, ?, ?, ?, ?, ?)");
                        $tagVal = $data['numero_tag'] ?? '---';
                        $modVal = $data['modelo_auto'] ?? '---';
                        $colVal = $data['color_auto'] ?? '---';
                        $plaVal = $data['placas'] ?? '---';
                        $stmtEst->bind_param("issssss", $numeroCajon, $tagVal, $nombreCompleto, $nomenclatura, $modVal, $colVal, $plaVal);
                        $stmtEst->execute();
                        $stmtEst->close();
                    }
                }

                $msg = "Expediente actualizado correctamente.";
            } else {
                // Nuevo residente y contrato
                $stmt1 = $this->db->prepare("INSERT INTO residentes (nombre_completo, genero, fecha_move_in, nomenclatura) VALUES (?, ?, ?, ?)");
                $stmt1->bind_param("ssss", $nombreCompleto, $genero, $fechaMoveIn, $nomenclatura);
                $stmt1->execute();
                $stmt1->close();

                $depInt = intval($dep);
                $stmt2 = $this->db->prepare("INSERT INTO contrato (numero_departamento, recamara, nombre_residente, celular, correo, renta, tiene_carro, fecha_move_in, fecha_move_out) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
                $stmt2->bind_param("issssdsss", $depInt, $recamara, $nombreCompleto, $telefono, $correo, $renta, $tieneCarro, $fechaMoveIn, $fechaMoveOut);
                $stmt2->execute();
                $stmt2->close();

                if ($deseaRegistrar === 'SI' && !empty($data['cajon'])) {
                    $nombreCajon = $data['cajon'];
                    $stmt3 = $this->db->prepare("INSERT INTO estacionamiento (cajon, numero_tag, nombre_completo, nomenclatura, modelo_auto, color_auto, placas) VALUES (?, ?, ?, ?, ?, ?, ?)");
                    $tagVal = $data['numero_tag'] ?? '';
                    $modVal = $data['modelo_auto'] ?? '';
                    $colVal = $data['color_auto'] ?? '';
                    $plaVal = $data['placas'] ?? '';
                    $stmt3->bind_param("sssssss", $nombreCajon, $tagVal, $nombreCompleto, $nomenclatura, $modVal, $colVal, $plaVal);
                    $stmt3->execute();
                    $stmt3->close();
                }

                $stmt4 = $this->db->prepare("INSERT INTO move_in (numero_departamento, tipologia, recamara, cama, nomenclatura, nombre_residente, move_in) VALUES (?, ?, ?, ?, ?, ?, ?)");
                $stmt4->bind_param("sssssss", $dep, $tipologia, $recamara, $cama, $nomenclatura, $nombreCompleto, $fechaMoveIn);
                $stmt4->execute();
                $stmt4->close();

                $msg = "Residente registrado correctamente.";
            }

            // Liberar bloqueo al guardar
            $this->bloqueo->liberar($nomenclatura, $idUsuario);

            // Registrar en auditoría
            $accionAudit = $esEdicion ? "Edición Residente" : "Alta Residente";
            $this->bitacora->registrar($idUsuario, $accionAudit, "{$nombreCompleto} ({$nomenclatura})");

            $this->db->commit();
            return ["success" => true, "message" => $msg];
        } catch (Exception $e) {
            $this->db->rollback();
            return ["success" => false, "message" => $e->getMessage()];
        }
    }

    public function cambiarUnidad(array $data, int $idUsuario): array {
        $this->db->begin_transaction();
        try {
            $nomAnterior     = trim($data['nomenclatura_anterior'] ?? '');
            $nomNueva        = trim($data['nomenclatura_nueva'] ?? '');
            $residente       = trim($data['residente'] ?? '');
            $motivo          = trim($data['motivo_cambio'] ?? 'Cambio de unidad');
            $fechaCambio     = date('Y-m-d');
            $depNuevo        = trim($data['dep_nuevo'] ?? '');
            $recamaraNueva   = trim($data['recamara_nueva'] ?? '');
            $cambiaContrato  = $data['cambia_contrato'] ?? 'NO';
            $rentaNueva      = isset($data['renta_nueva']) ? floatval($data['renta_nueva']) : null;

            if (empty($nomAnterior) || empty($nomNueva)) {
                throw new Exception("Las nomenclaturas anterior y nueva son requeridas.");
            }

            // Verificar bloqueos
            $ttl = LOCK_TTL_SECONDS;
            $stmtLock = $this->db->prepare("SELECT nomenclatura, nombre_usuario FROM bloqueos_expedientes 
                                           WHERE (nomenclatura = ? OR nomenclatura = ?) AND id_usuario != ? AND ultimo_latido >= DATE_SUB(NOW(), INTERVAL {$ttl} SECOND) LIMIT 1");
            $stmtLock->bind_param("ssi", $nomAnterior, $nomNueva, $idUsuario);
            $stmtLock->execute();
            $bloqueo = $stmtLock->get_result()->fetch_assoc();
            $stmtLock->close();

            if ($bloqueo) {
                throw new Exception("No es posible procesar el cambio: la unidad {$bloqueo['nomenclatura']} está siendo modificada por {$bloqueo['nombre_usuario']}.");
            }

            // Verificar disponibilidad con FOR UPDATE
            $stmtChkDest = $this->db->prepare("SELECT nombre_completo FROM residentes WHERE nomenclatura = ? FOR UPDATE");
            $stmtChkDest->bind_param("s", $nomNueva);
            $stmtChkDest->execute();
            $resDest = $stmtChkDest->get_result();
            if ($resDest->num_rows > 0) {
                $ocupante = $resDest->fetch_assoc()['nombre_completo'];
                if ($ocupante !== $residente && !empty(trim($ocupante))) {
                    throw new Exception("La unidad destino {$nomNueva} ya está ocupada por {$ocupante}.");
                }
            }
            $stmtChkDest->close();

            // Mover en residentes
            $stmtMoveRes = $this->db->prepare("UPDATE residentes SET nomenclatura = ? WHERE nomenclatura = ?");
            $stmtMoveRes->bind_param("ss", $nomNueva, $nomAnterior);
            $stmtMoveRes->execute();
            $stmtMoveRes->close();

            // Mover en contrato (NO tocar nomenclatura ya que es GENERATED ALWAYS STORED)
            if ($cambiaContrato === 'SI' && $rentaNueva !== null) {
                $stmtMoveCont = $this->db->prepare("UPDATE contrato SET numero_departamento = ?, recamara = ?, renta = ? WHERE nomenclatura = ?");
                $stmtMoveCont->bind_param("ssds", $depNuevo, $recamaraNueva, $rentaNueva, $nomAnterior);
            } else {
                $stmtMoveCont = $this->db->prepare("UPDATE contrato SET numero_departamento = ?, recamara = ? WHERE nomenclatura = ?");
                $stmtMoveCont->bind_param("sss", $depNuevo, $recamaraNueva, $nomAnterior);
            }
            $stmtMoveCont->execute();
            $stmtMoveCont->close();

            // Mover en estacionamiento si existe
            $stmtMovePark = $this->db->prepare("UPDATE estacionamiento SET nomenclatura = ? WHERE nomenclatura = ?");
            $stmtMovePark->bind_param("ss", $nomNueva, $nomAnterior);
            $stmtMovePark->execute();
            $stmtMovePark->close();

            // Registrar en historial cambio_unidad
            $stmtHist = $this->db->prepare("INSERT INTO cambio_unidad (residente, nomenclatura_inicial, nomenclatura_nueva, motivo_cambio, fecha_cambio) VALUES (?, ?, ?, ?, ?)");
            $stmtHist->bind_param("sssss", $residente, $nomAnterior, $nomNueva, $motivo, $fechaCambio);
            $stmtHist->execute();
            $stmtHist->close();

            // Liberar bloqueos anteriores
            $this->bloqueo->liberar($nomAnterior, $idUsuario);
            $this->bloqueo->liberar($nomNueva, $idUsuario);

            // Auditoría
            $this->bitacora->registrar($idUsuario, "Cambio de Unidad", "{$residente}: {$nomAnterior} -> {$nomNueva}. Motivo: {$motivo}");

            $this->db->commit();
            return ["success" => true, "message" => "Cambio de unidad procesado exitosamente."];
        } catch (Exception $e) {
            $this->db->rollback();
            return ["success" => false, "message" => $e->getMessage()];
        }
    }

    public function moveOut(array $registros, int $idUsuario): array {
        $this->db->begin_transaction();
        try {
            $stmtSelect = $this->db->prepare("SELECT COALESCE(c.nombre_residente, r.nombre_completo) as nombre, COALESCE(c.fecha_move_in, r.fecha_move_in) as move_in FROM residentes r LEFT JOIN contrato c ON r.nomenclatura = c.nomenclatura WHERE r.nomenclatura = ?");
            $stmtInsertHist = $this->db->prepare("INSERT INTO move_out (nomenclatura, nombre_residente, move_in, move_out, motivo_salida) VALUES (?, ?, ?, ?, ?)");
            
            $stmtDel1 = $this->db->prepare("DELETE FROM residentes WHERE nomenclatura = ?");
            $stmtDel2 = $this->db->prepare("DELETE FROM contrato WHERE nomenclatura = ?");
            $stmtDel3 = $this->db->prepare("DELETE FROM estacionamiento WHERE nomenclatura = ?");

            $fechaHoy = date('Y-m-d');
            $nombresBorrados = [];
            $ttl = LOCK_TTL_SECONDS;

            $stmtLock = $this->db->prepare("SELECT nombre_usuario FROM bloqueos_expedientes WHERE nomenclatura = ? AND id_usuario != ? AND ultimo_latido >= DATE_SUB(NOW(), INTERVAL {$ttl} SECOND) LIMIT 1");

            foreach ($registros as $item) {
                $nom = trim($item['nomenclatura'] ?? '');
                $motivo = trim($item['motivo_salida'] ?? 'Fin de contrato / Salida regular');

                if (!empty($nom)) {
                    $stmtLock->bind_param("si", $nom, $idUsuario);
                    $stmtLock->execute();
                    $lockRes = $stmtLock->get_result()->fetch_assoc();
                    if ($lockRes) {
                        throw new Exception("No es posible procesar salida: la unidad {$nom} está siendo modificada por {$lockRes['nombre_usuario']}.");
                    }

                    $stmtSelect->bind_param("s", $nom);
                    $stmtSelect->execute();
                    $res = $stmtSelect->get_result()->fetch_assoc();

                    $nombreRes = $res['nombre'] ?? 'Desconocido';
                    $moveInDate = $res['move_in'] ?? $fechaHoy;
                    $nombresBorrados[] = $nombreRes;

                    $stmtInsertHist->bind_param("sssss", $nom, $nombreRes, $moveInDate, $fechaHoy, $motivo);
                    $stmtInsertHist->execute();

                    $stmtDel1->bind_param("s", $nom);
                    $stmtDel1->execute();

                    $stmtDel2->bind_param("s", $nom);
                    $stmtDel2->execute();

                    $stmtDel3->bind_param("s", $nom);
                    $stmtDel3->execute();

                    $this->bloqueo->liberar($nom, $idUsuario);
                }
            }

            $stmtSelect->close();
            $stmtInsertHist->close();
            $stmtDel1->close();
            $stmtDel2->close();
            $stmtDel3->close();
            $stmtLock->close();

            if (!empty($nombresBorrados)) {
                $this->bitacora->registrar($idUsuario, "Baja / Move-Out", "Se dio de baja a: " . implode(", ", $nombresBorrados));
            }

            $this->db->commit();
            return ["success" => true, "message" => "Salida(s) procesada(s) correctamente."];
        } catch (Exception $e) {
            $this->db->rollback();
            return ["success" => false, "message" => $e->getMessage()];
        }
    }
}
