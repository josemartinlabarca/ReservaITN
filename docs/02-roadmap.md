# 2. Roadmap paso a paso

Fechas según el Acta de Constitución (semanas desde el 07/10/2026). Hoy: **semana 4**.

Leyenda: ✅ incluido en la base del repositorio · 🟡 parcial · ⬜ pendiente

## Paso 0 — Preparar el repositorio (semana 4, 28–30/10) · responsable GP

1. Crear el repositorio en GitHub y subir esta base (ver [05-flujo-git.md](05-flujo-git.md#primer-push)).
2. Ejecutar `scripts/github-setup.sh` → labels, milestones H1–H8 y épicas de la EDT.
3. Crear el GitHub Project (tablero) y agregar los issues.
4. Proteger `main` y `develop` (PR obligatorio + CI verde).
5. Cada integrante clona, corre `pnpm install && pnpm db:up && pnpm db:migrate && pnpm db:seed && pnpm dev`.
6. Revisar el modelo de datos con el encargado de informática (E2) y ajustar `schema.prisma`.
7. **H3 (30/10)**: prototipo validado → las observaciones se transforman en issues.

## Sprint 1 — Fundamentos (semana 5, 02–06/11)

| EDT | Trabajo | Resp. | Estado |
|---|---|---|---|
| 1.4.1 | Login con correo institucional, gestión de usuarios y roles (CRUD), cambio de contraseña | JL | 🟡 login + guard de permisos |
| 1.4.2 | CRUD de sedes, salas, laboratorios, equipamiento, exclusividad por carrera, ítems de inventario | JL | 🟡 listar/crear salas |
| 1.4.3 | Importación del Excel: subir archivo, validar fila por fila con `filaPlanificacionSchema`, informe de errores, generar reservas `PLANIFICACION` | JL | 🟡 esquema de validación + tabla `importaciones` |
| — | Web: layout, login, pantallas de administración de salas y usuarios | BN | 🟡 login |
| — | Staging desplegado (API + BD + web) | GP | ⬜ |
| 1.5.1 | Plan y casos de prueba (incluye los 200 casos anti-choques) | BC | ⬜ |

**Criterio de salida:** 98 % del Excel real importado sin intervención (E5). *Riesgo RI3: pedir el Excel ya.*

## Sprint 2 — Núcleo de reservas (semana 6, 09–13/11) → **H4**

| EDT | Trabajo | Resp. | Estado |
|---|---|---|---|
| 1.4.4 | Solicitud, aprobación por rol, rechazo, cancelación por Subdirección, anti-choques | JL | ✅ API + BD |
| 1.4.4 | Préstamo de laboratorios exclusivos (R8) y reserva de estudiantes con autorización (R11) | JL | 🟡 regla `puedeAprobar` |
| — | Web: calendario de disponibilidad por sala/sede, formulario de solicitud, bandeja de aprobación, historial | BN | 🟡 bandeja de aprobación |
| 1.5.2 | Pruebas funcionales del núcleo | BC | 🟡 pruebas automáticas |

**H4 (13/11):** demo del núcleo web; 0 reservas dobles en ≥ 200 casos (ya automatizado en `test:db`).

## Sprint 3 — Inteligencia y móvil (semana 7, 16–20/11)

| EDT | Trabajo | Resp. | Estado |
|---|---|---|---|
| 1.4.5 | Sugerencia de sala + alternativas que se liberan en ≤ 30 min (< 5 s) | JL | ✅ regla + endpoint |
| 1.4.6 | Envío real de correo (SMTP) y push (Expo); job que libera reservas sin check-in (R18) | JL | 🟡 bandeja in-app |
| 1.4.7 | Dashboard completo: filtros por sede/tipo, gráficos, exportar reporte (CSV/PDF) | BN | 🟡 KPIs, tabla por sala, detalle, desde–hasta |
| 1.4.9 | App docentes/estudiantes: selector de fecha nativo, mis reservas, push | BN | 🟡 buscar, sugerir, solicitar, avisos |
| 1.6.2 | **Enviar build a TestFlight y Play Console (pista interna)** — la revisión de tiendas tarda (RI6) | GP | ⬜ |

## Sprint 4 — Análisis y mantención (semana 8, 23–27/11) → **H5**

| EDT | Trabajo | Resp. | Estado |
|---|---|---|---|
| 1.4.8 | Proyección de uso: días y jornadas de mayor/menor ocupación con historial | JL | 🟡 distribución por día y jornada |
| 1.4.10 | App mantención: conteo de inventario, foto del daño, historial | BN | 🟡 reporte de daños |
| R15 | Planificación de mantención: bloqueos `MANTENCION` que respetan el anti-choques | JL | 🟡 soportado por el modelo |
| 1.5.3 / 1.5.4 | Usabilidad y pruebas en dispositivos Android e iOS | BC | ⬜ |

**H5 (27/11):** web y móvil completas; 100 % de requisitos *Debe* (OE4).
**Congelamiento de funcionalidades**: desde aquí solo se corrigen errores.

## Semana 9 (30/11–04/12) → **H6** · UAT
- BC conduce las pruebas de aceptación con usuarios reales en staging; meta ≥ 90 % aprobados (E13).
- Bugs críticos se corrigen en ramas `fix/*` el mismo día.

## Semana 10 (07–11/12, feriado 08/12) → **H7** · Puesta en marcha
- GP: `prisma migrate deploy` en producción, carga inicial del semestre (1.6.3), publicación de apps.
- BC: capacitación a usuarios clave (1.6.4); BC/GP: manuales de usuario y técnico (1.7).
- Tag `v1.0.0` en `main`.

## Semana 11 (14–17/12) → **H8** · Cierre
- Holgura para imprevistos, acta de entrega, lecciones aprendidas.
- Soporte de 30 días hasta el 10/01/2027 en ramas `hotfix/*`.
