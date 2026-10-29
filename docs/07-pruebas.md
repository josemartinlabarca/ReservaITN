# 7. Estrategia de pruebas (E13 / EDT 1.5)

| Nivel | Herramienta | Dónde | Cuándo corre | Responsable |
|---|---|---|---|---|
| Unitarias (reglas, validaciones) | Vitest | `packages/shared/src/**/*.test.ts`, `apps/api/src/**/*.test.ts` | Cada push (CI) | Quien escribe la regla |
| Integración con BD | Vitest + PostgreSQL | `apps/api/test/*.db.test.ts` | Cada push (CI, con servicio Postgres) | JL |
| Extremo a extremo web | Playwright (a agregar en sprint 2) | `apps/web/e2e` | PR a `main` | BC |
| Dispositivos | Expo Go / builds internas | Android + iOS reales | Sprint 4 | BC |
| Aceptación (UAT) | Casos manuales con usuarios del ITN | Staging | Semana 9 | BC |

## Criterios ligados a entregables

| Entregable | Criterio | Cómo se demuestra |
|---|---|---|
| E5 | ≥ 98 % del Excel importado sin intervención | `porcentajeOk` en la respuesta de `POST /importaciones` y en la tabla `importaciones`; prueba `importacion.db.test.ts` |
| E6 | 0 reservas dobles en ≥ 200 casos | `pnpm --filter @reservaitn/api test:db` (200 aprobaciones concurrentes) |
| E7 | Sugerencia en < 5 s | Medir tiempo de `POST /reservas/sugerencia` con datos reales |
| E13 | ≥ 90 % de casos UAT aprobados, 0 críticos | Reporte de UAT + issues `bug` + `critico` cerrados |

## Clasificación de bugs

- `critico`: impide reservar o permite una reserva doble → se corrige el mismo día; bloquea la aceptación.
- `alto`: un rol no puede completar su flujo principal.
- `medio` / `bajo`: el resto.
