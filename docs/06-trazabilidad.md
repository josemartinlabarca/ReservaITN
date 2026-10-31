# 6. Matriz de trazabilidad

Requisito (Acta §5) → entregable (Plan de Alcance, Tabla 1) → dónde está implementado → cómo se prueba.
Actualizar en cada PR que avance un requisito.

| ID | Requisito | Prioridad | Entregable | Implementación | Prueba | Estado |
|---|---|---|---|---|---|---|
| R1 | Impedir reservas dobles | Debe | E6 | `reserva_sin_choque` (EXCLUDE, incluye pendientes), V006 | `packages/db/pruebas/reservas.test.ts` (200 casos), `flujo-reservas.db.test.ts` (20 simultáneas) | ✅ |
| R2 | Centralizar solicitudes | Debe | E6 | `reservas.solicitud` + `POST /reservas`, web `reservar/` (precisión al minuto), app móvil | `flujo-reservas.db.test.ts` | ✅ |
| R3 | Disponibilidad visible | Debe | E11 | `GET /reservas/ocupacion`, web `reservar/` (ocupación del día), móvil `Disponibilidad` | — | 🟡 falta vista calendario |
| R4 | Aprobación por rol | Debe | E6 | `regla_aprobacion` + `reservas.puede_aprobar` (V010), web `aprobaciones` | `aprobacion_reglas.test.ts`, `flujo-reservas.db.test.ts` | ✅ |
| R5 | Cancelación por Subdirección + aviso | Debe | E6 | `reservas.cancelacion` (V011, motivo obligatorio para reservas ajenas), botón Cancelar en el dashboard | `reservas.test.ts` (V011), `flujo-reservas.db.test.ts` | ✅ |
| R6 | Notificaciones | Debe | E8 | Bandeja en la app + cola `envio` (outbox) con preferencias + despachador de correo con reintentos (V012) | `flujo-reservas.db.test.ts`, `correos.db.test.ts` (servidor SMTP de prueba) | ✅ correo · 🟡 push (requiere registrar dispositivos en la app) |
| R7 | Trazabilidad | Debe | E9 | `v_reserva_trazabilidad` + `auditoria.evento` con actor (`conActor`) | `flujo-reservas.db.test.ts`, `operacion.test.ts` | ✅ |
| R8 | Laboratorios exclusivos y préstamo | Debe | E5/E6 | `espacio_carrera` + regla `CARRERA_ESPACIO` | `aprobacion_reglas.test.ts` | ✅ |
| R9 | Importar planificación | Debe | E5 | `api/importacion` (solicitud + patrón + reservas aprobadas), `v_importacion_resumen` | `importacion.db.test.ts` | 🟡 ajustar al Excel real |
| R10 | Sugerencia + alternativas ≤ 30 min | Debe | E7 | `shared/reglas/sugerencia.ts`, `api/sugerencia` | `reglas.test.ts` | ✅ |
| R11 | Estudiantes reservan con autorización | Debe | E6 | regla `ESTUDIANTE → DIRECTOR_CARRERA`, matrícula por período | `aprobacion_reglas.test.ts` | ✅ |
| R12 | Dashboard de ocupación con detalle | Debe | E9 | `dashboard.module.ts`, web `dashboard` | `dashboard.test.ts` | 🟡 |
| R13 | Reportes desde–hasta | Debe | E9 | `rangoFechasSchema`, dashboard por días completos, `GET /dashboard/reporte.xlsx` (Excel de 4 hojas) | `reporte.db.test.ts` | ✅ |
| R14 | Proyección de uso | Debería | E10 | `rankingJornadas`, `api/proyeccion`, web dashboard | `planificacion.test.ts` | 🟡 |
| R15 | Mantención sin interferir clases | Debería | E12 | orden de trabajo con bloqueo (`origen MANTENCION`, respeta el anti-choques) | — | 🟡 falta interfaz |
| R16 | App móvil + web | Debe | E11 | `apps/mobile`, `apps/web` | — | 🟡 |
| R17 | Inventario y daños desde el celular | Debería | E12 | `mantencion/` (inspecciones con diferencias, daños, órdenes), móvil `ReporteDanio` | `operacion.test.ts` | 🟡 falta inventario en la app |
| R18 | Liberar reservas no usadas | Debería | E8 | check-in por QR + `reservas.liberar_sin_check_in()` + tarea cada minuto | `aprobacion_reglas.test.ts` | ✅ API · 🟡 lector QR en la app |
| R19 | Datos de cada reserva | Debe | E2 | `schema.prisma` + `reservaCreateSchema` | `validaciones.test.ts` | 🟡 validar campos |
