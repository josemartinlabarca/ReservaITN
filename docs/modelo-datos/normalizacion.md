# Normalización formal del modelo

Para cada tabla se listan sus **claves candidatas** y sus **dependencias funcionales (DF) no triviales**.
Una tabla está en **forma normal de Boyce-Codd (FNBC)** si cada determinante de una DF es superclave;
FNBC implica 3FN, 2FN y 1FN. Notación: `A → B` significa "A determina B".

Supuesto común a todas las tablas: los atributos son atómicos (1FN). Los casos donde antes no lo
eran se corrigieron en el diseño (D4/D19 equipamiento, D13 días de la recurrencia).

## Resultado

**Las 48 tablas cumplen FNBC.** Además, ninguna mezcla dos hechos multivaluados independientes, por
lo que cumplen 4FN. Las únicas redundancias que quedan son **intencionales y controladas**
(sección "Redundancias controladas") y la base de datos las mantiene consistentes.

## Esquema `seguridad`

| Tabla | Claves candidatas | DF no triviales | FN |
|---|---|---|---|
| tipo_documento | {codigo} | codigo → nombre, valida_digito | FNBC |
| persona | {id}, {tipo_documento, numero_documento}, {email} | cada clave → resto | FNBC |
| usuario | {id}, {persona_id} | id → persona_id, password_hash, estado, ultimo_acceso; persona_id → id | FNBC |
| identidad_externa | {proveedor, sujeto} | proveedor, sujeto → usuario_id | FNBC |
| rol | {id}, {codigo} | id → codigo, nombre, descripcion, es_sistema | FNBC |
| permiso | {id}, {codigo} | id → codigo, modulo, descripcion | FNBC |
| rol_permiso | {rol_id, permiso_id} | (solo la clave) | FNBC, 4FN |
| usuario_rol | {id}, {usuario_id, rol_id, sede_id, carrera_id} | clave → vigente_desde, vigente_hasta | FNBC |

`persona.email` es clave candidata solo entre los valores no nulos (UNIQUE admite varios nulos).

## Esquema `institucion`

| Tabla | Claves candidatas | DF no triviales | FN |
|---|---|---|---|
| institucion | {id}, {unica} | id → nombre, rut, zona_horaria | FNBC |
| parametro | {clave} | clave → valor, tipo, descripcion | FNBC |
| sede | {id}, {codigo} | id → institucion_id, codigo, nombre, direccion, comuna, activo | FNBC |
| horario_sede | {sede_id, dia_semana} | clave → apertura, cierre | FNBC |
| edificio | {id}, {sede_id, codigo} | id → sede_id, codigo, nombre | FNBC |
| tipo_espacio | {id}, {codigo} | id → nombre, requiere_aprobacion, reservable_por_estudiantes | FNBC |
| espacio | {id}, {edificio_id, codigo}, {token_qr} | id → edificio_id, tipo_espacio_id, codigo, nombre, piso, capacidad, accesible, reservable, token_qr | FNBC |
| item | {id}, {codigo} | id → nombre, categoria, filtrable | FNBC |
| espacio_item | {espacio_id, item_id} | clave → cantidad_esperada | FNBC |
| espacio_carrera | {espacio_id, carrera_id} | clave → prioridad | FNBC |
| bloque_horario | {id}, {codigo}, {hora_inicio}, {orden} | id → codigo, jornada, hora_inicio, hora_fin, orden | FNBC |
| dia_no_habil | {id}, {fecha, sede_id} | clave → tipo, motivo | FNBC |

- `espacio` **no guarda la sede**: `edificio_id → sede_id` haría que `id → edificio_id → sede_id`
  fuera una dependencia transitiva (violación de 3FN). La sede se obtiene uniendo con `edificio`.
- `bloque_horario.hora_inicio` también es clave candidata porque los bloques no se solapan
  (restricción EXCLUDE). Como sigue siendo clave, no rompe FNBC.
- **4FN:** `espacio_item` y `espacio_carrera` son tablas separadas. Si se unieran en
  `espacio_item_carrera`, los ítems y las carreras de un espacio serían dos hechos multivaluados
  independientes (`espacio ↠ item` y `espacio ↠ carrera`), lo que viola 4FN y obliga a guardar
  todas las combinaciones.

## Esquema `academico`

| Tabla | Claves candidatas | DF no triviales | FN |
|---|---|---|---|
| periodo_academico | {id}, {codigo} | id → nombre, fecha_inicio, fecha_fin, estado | FNBC |
| carrera | {id}, {codigo} | id → nombre, activo | FNBC |
| oferta_carrera | {id}, {carrera_id, sede_id, jornada} | id → carrera_id, sede_id, jornada, activo | FNBC |
| asignatura | {id}, {codigo} | id → nombre, horas_semanales, tipo_espacio_requerido_id | FNBC |
| carrera_asignatura | {carrera_id, asignatura_id} | clave → nivel | FNBC |
| seccion | {id}, {periodo_id, asignatura_id, oferta_carrera_id, codigo} | id → resto; docente, cupo, inscritos dependen de la clave completa | FNBC |
| matricula | {id}, {persona_id, oferta_carrera_id, periodo_id} | clave → estado | FNBC |

`seccion` no guarda la sede ni la carrera, porque ambas se obtienen de `oferta_carrera`
(evita la dependencia transitiva `id → oferta → sede`).

## Esquema `reservas`

| Tabla | Claves candidatas | DF no triviales | FN |
|---|---|---|---|
| tipo_actividad | {id}, {codigo} | id → nombre, activo | FNBC |
| solicitud | {id} | id → solicitante, tipo_actividad, seccion, origen, descripcion, asistentes, fecha_desde, fecha_hasta, importacion | FNBC |
| patron_recurrencia | {solicitud_id, dia_semana, hora_inicio} | clave → hora_fin | FNBC |
| reserva | {id} | id → solicitud_id, espacio_id, inicio, fin, estado, expira_en | FNBC |
| regla_aprobacion | {id}, {tipo_espacio_id, rol_solicitante_id, tipo_actividad_id} | clave → accion, rol_aprobador, ambito, prioridad | FNBC |
| aprobacion | {id}, {solicitud_id} | solicitud_id → regla, decision, decidido_por, decidido_en, comentario | FNBC |
| check_in | {reserva_id} | reserva_id → usuario_id, metodo, registrado_en | FNBC |
| importacion | {id} | id → archivo_nombre, periodo_id, usuario_id, total_filas | FNBC |
| importacion_error | {id}, {importacion_id, fila, columna} | clave → mensaje | FNBC |

- `reserva` no repite el solicitante, la actividad ni los asistentes: los obtiene de su `solicitud`.
- Entre reservas **activas** (`PENDIENTE` o `APROBADA`) también se cumple que (espacio, instante) determina
  la reserva. Es una DF parcial que garantiza la restricción EXCLUDE, no una clave de toda la tabla.

## Esquema `mantencion`

| Tabla | Claves candidatas | DF no triviales | FN |
|---|---|---|---|
| inspeccion | {id} | id → espacio_id, usuario_id, realizada_en, observacion | FNBC |
| inspeccion_detalle | {inspeccion_id, item_id} | clave → cantidad_contada, cantidad_esperada | FNBC |
| reporte_danio | {id} | id → espacio_id, item_id, reportado_por, descripcion, severidad, orden_trabajo_id, creado_en | FNBC (ver N3) |
| reporte_danio_foto | {id}, {clave_almacenamiento} | id → reporte_danio_id, tipo_mime, tamano_bytes | FNBC |
| orden_trabajo | {id}, {solicitud_bloqueo_id} | id → espacio_id, tipo, prioridad, estado, asignada_a, solucion, fechas | FNBC |

## Esquema `comunicacion`

| Tabla | Claves candidatas | DF no triviales | FN |
|---|---|---|---|
| evento_notificacion | {codigo} | codigo → descripcion, obligatorio | FNBC |
| plantilla | {evento_codigo, canal} | clave → asunto, cuerpo | FNBC |
| preferencia | {usuario_id, evento_codigo, canal} | clave → activo | FNBC |
| dispositivo | {id}, {token_push} | id → usuario_id, plataforma, ultimo_uso | FNBC |
| notificacion | {id} | id → usuario, evento, titulo, cuerpo, referencias, leida_en | FNBC |
| envio | {id}, {notificacion_id, canal} | clave → estado, intentos, ultimo_error, enviado_en | FNBC |

## Esquema `auditoria`

| Tabla | Claves candidatas | DF no triviales | FN |
|---|---|---|---|
| evento | {id} | id → esquema, tabla, registro_id, operacion, actor, datos_antes, datos_despues, ocurrido_en | FNBC |

Las columnas `jsonb` no violan 1FN en el sentido práctico: son una foto opaca del registro que se
guarda y se muestra entera, y nunca se filtra ni se actualiza por sus campos internos.

---

## Correcciones que salieron del análisis

| # | Hallazgo | Problema | Corrección |
|---|---|---|---|
| N1 | `importacion.filas_ok` | Es derivable: `total_filas − filas distintas con error` | **Se elimina.** Se calcula en la vista `reservas.v_importacion_resumen` |
| N2 | `creado_por` y `actualizado_por` en las tablas maestras | Repiten lo que ya registra `auditoria.evento` (actor de cada cambio) | **Se eliminan.** Quedan `creado_en` y `actualizado_en`, que son útiles para ordenar y sincronizar |
| N3 | `reporte_danio.espacio_id` y `orden_trabajo.espacio_id` | Un reporte podría quedar asociado a la orden de otra sala | **Clave foránea compuesta** `(orden_trabajo_id, espacio_id) → orden_trabajo(id, espacio_id)`: la base rechaza la inconsistencia |
| N4 | La aprobación automática no dejaba registro | "Sin fila en `aprobacion` = pendiente" se contradecía con las solicitudes autoaprobadas | La aprobación automática **también inserta una fila**, con `decidido_por` nulo y la regla aplicada |
| N5 | `importacion_error` con clave (importacion, fila, columna) | `columna` puede ser nula (errores de la fila completa, como un choque), y una clave primaria no admite nulos | Clave sustituta `id` + UNIQUE NULLS NOT DISTINCT(importacion, fila, columna) |
| N6 | `auditoria.evento` copiaba `usuario.password_hash` | Un dato sensible quedaba copiado en la bitácora | El trigger de auditoría excluye las columnas sensibles |

## Redundancias controladas (intencionales)

| Dato | Por qué se guarda | Cómo se mantiene consistente |
|---|---|---|
| `reserva.estado` (`PENDIENTE`/`APROBADA`/`RECHAZADA`) refleja `aprobacion.decision` | La restricción EXCLUDE necesita el estado **en la misma fila** de la reserva; además, cada fecha de una serie puede cambiar sola (cancelar, liberar) | Trigger: al insertar la aprobación se actualizan las reservas pendientes de la solicitud, en la misma transacción |
| `inspeccion_detalle.cantidad_esperada` | Foto de lo esperado **al momento** de inspeccionar | No se actualiza nunca (dato histórico) |
| `notificacion.titulo` y `cuerpo` | El texto que recibió el usuario no debe cambiar si se edita la plantilla | Dato histórico |
| `seccion.inscritos` | La inscripción por estudiante está fuera del alcance; el dato viene del Excel | Se reemplaza en cada importación |
| `aprobacion.regla_aprobacion_id` | Registra qué regla se aplicó, aunque luego cambien las reglas | Dato histórico |

## Reglas entre tablas que no son dependencias funcionales

No se pueden expresar como DF ni con restricciones simples. Quedan a cargo de **triggers** (T) o
de la **API** (A):

| Regla | Dónde |
|---|---|
| Al aprobar o rechazar una solicitud, sus reservas pendientes cambian de estado | T |
| Solo se hace check-in en una reserva aprobada y dentro de su horario | T |
| Una preferencia no puede desactivar un evento obligatorio | T |
| La bitácora de auditoría no se modifica ni se borra | T |
| Una sección debe dictar una asignatura que pertenezca a la carrera de su oferta | A |
| La serie no genera reservas en días no hábiles | A |
| Solo una solicitud recurrente tiene patrón de recurrencia | A |
| La solicitud que bloquea una sala por mantención debe tener origen `MANTENCION` | A |
