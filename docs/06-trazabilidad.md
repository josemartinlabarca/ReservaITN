# 6. Matriz de trazabilidad

Requisito (Acta §5) → entregable (Plan de Alcance, Tabla 1) → dónde está implementado → cómo se prueba.
Actualizar en cada PR que avance un requisito.

| ID | Requisito | Prioridad | Entregable | Implementación | Prueba | Estado |
|---|---|---|---|---|---|---|
| R1 | Impedir reservas dobles | Debe | E6 | `migration.sql` (EXCLUDE), `shared/reglas/choques.ts` | `test/anti-choques.db.test.ts`, `reglas.test.ts` | ✅ |
| R2 | Centralizar solicitudes | Debe | E6 | `api/reservas` | — | 🟡 |
| R3 | Disponibilidad visible | Debe | E11 | `GET /reservas/ocupacion`, móvil `Disponibilidad` | — | 🟡 |
| R4 | Aprobación por rol | Debe | E6 | `shared/reglas/estados.ts` (`puedeAprobar`), web `aprobaciones` | `reglas.test.ts` | ✅ |
| R5 | Cancelación por Subdirección + aviso | Debe | E6 | `reservas.service.ts` (`autorizar`) | `reglas.test.ts` (permisos) | ✅ |
| R6 | Notificaciones | Debe | E8 | `notificaciones.module.ts` (in-app) | — | 🟡 falta correo/push |
| R7 | Trazabilidad | Debe | E9 | `EventoReserva` + trigger inmutable | manual | ✅ |
| R8 | Laboratorios exclusivos y préstamo | Debe | E5/E6 | `Sala.carreraExclusivaId`, `puedeAprobar` | `reglas.test.ts` | 🟡 |
| R9 | Importar planificación | Debe | E5 | `filaPlanificacionSchema`, modelo `Importacion` | `validaciones.test.ts` | 🟡 falta carga |
| R10 | Sugerencia + alternativas ≤ 30 min | Debe | E7 | `shared/reglas/sugerencia.ts`, `POST /reservas/sugerencia` | `reglas.test.ts` | ✅ |
| R11 | Estudiantes reservan con autorización | Debe | E6 | rol `ESTUDIANTE` → `PENDIENTE` | — | 🟡 |
| R12 | Dashboard de ocupación con detalle | Debe | E9 | `dashboard.module.ts`, web `dashboard` | `dashboard.test.ts` | 🟡 |
| R13 | Reportes desde–hasta | Debe | E9 | `rangoFechasSchema`, filtro web | — | 🟡 falta exportar |
| R14 | Proyección de uso | Debería | E10 | `distribucionPorJornada` | `reglas.test.ts` | 🟡 |
| R15 | Mantención sin interferir clases | Debería | E12 | `OrigenReserva.MANTENCION` + EXCLUDE | — | 🟡 |
| R16 | App móvil + web | Debe | E11 | `apps/mobile`, `apps/web` | — | 🟡 |
| R17 | Inventario y daños desde el celular | Debería | E12 | `mantencion.module.ts`, móvil `ReporteDanio` | — | 🟡 |
| R18 | Liberar reservas no usadas | Debería | E8 | `Reserva.checkInEn`, transición `LIBERAR` | `reglas.test.ts` | 🟡 falta job |
| R19 | Datos de cada reserva | Debe | E2 | `schema.prisma` + `reservaCreateSchema` | `validaciones.test.ts` | 🟡 validar campos |
