# ReservaITN

Sistema de reservas de salas y laboratorios para el **Instituto Técnico del Norte (ITN), Arica**.
Proyecto P05 de **JBG Tech**: Benjamín Naveas (director y frontend), José Labarca (full stack),
Gonzalo Pino (ingeniero de sistemas) y Braulio Campos (tester UA).

| | |
|---|---|
| Plazo | 07/10/2026 → 17/12/2026 (11 semanas) |
| Web de administración + dashboard | `apps/web` (Next.js) |
| App móvil Android/iOS | `apps/mobile` (Expo / React Native) |
| API y reglas de negocio | `apps/api` (NestJS + Prisma) |
| Base de datos | PostgreSQL 16, modelo v1 en `packages/db` (SQL) |
| Validaciones y reglas compartidas | `packages/shared` (Zod + TypeScript) |

## Estructura

```
reservaitn/
├── apps/
│   ├── api/                 API REST (NestJS). Un módulo por paquete de la EDT 1.4
│   │   ├── prisma/          schema.prisma, migraciones SQL, seed
│   │   ├── src/
│   │   │   ├── usuarios/        1.4.1  login, usuarios, roles (guard de permisos)
│   │   │   ├── recursos/        1.4.2  sedes, salas, laboratorios
│   │   │   ├── importacion/     1.4.3  carga del Excel de planificación
│   │   │   ├── reservas/        1.4.4  reservas, aprobación, cancelación, anti-choques
│   │   │   ├── sugerencia/      1.4.5  sala sugerida + alternativas
│   │   │   ├── notificaciones/  1.4.6  avisos (liberación: pendiente)
│   │   │   ├── dashboard/       1.4.7  ocupación, reportes desde–hasta, indicadores
│   │   │   ├── proyeccion/      1.4.8  días y jornadas de mayor/menor uso
│   │   │   ├── mantencion/      1.4.10 daños e inventario
│   │   │   └── comun/           Prisma, validación Zod, guard, manejo de errores
│   │   └── test/            pruebas de integración contra PostgreSQL
│   ├── web/                 Next.js: login, dashboard (1.4.7–1.4.8), aprobaciones (1.4.4)
│   └── mobile/src/
│       ├── docentes/        1.4.9  app de docentes y estudiantes
│       ├── mantencion/      1.4.10 app de aseo y mantención
│       └── comun/           login y avisos
├── packages/
│   ├── db/                  modelo de datos v1: migraciones SQL, semillas, pruebas de restricciones
│   └── shared/              roles y permisos, esquemas Zod, reglas (choques, sugerencia, ocupación)
├── docs/                    metodología, roadmap, arquitectura, trazabilidad, ADR
├── infra/                   docker-compose (PostgreSQL + Mailpit)
├── scripts/                 configuración del repositorio en GitHub (labels, hitos, backlog)
└── .github/                 CI, plantillas de issues y de PR
```

## Puesta en marcha local

Requisitos: Node 22, pnpm 10, Docker.

```bash
pnpm install
```

```bash
pnpm db:up
```

```bash
cp apps/api/.env.example apps/api/.env && cp apps/web/.env.example apps/web/.env.local
```

```bash
pnpm db:seed
```

`db:seed` aplica las migraciones de `packages/db` y carga catálogos y datos de demostración.

```bash
pnpm dev
```

- API: http://localhost:3001/api/health
- Web: http://localhost:3000 (usuario `subdireccion@itn.cl`, contraseña `reservaitn`)
- Móvil: `pnpm --filter @reservaitn/mobile dev` y escanear el QR con Expo Go
- Correos de prueba: http://localhost:8025

Usuarios demo (contraseña `reservaitn`), todos `@itn.cl`:

| Usuario | Roles | Para probar |
|---|---|---|
| `subdireccion` | Subdirección | Control total: se autoaprueba, aprueba y cancela cualquier reserva |
| `dir.inf` | Director de Informática + Docente | Aprueba lo de Informática (y el LAB-INF1); también pide salas |
| `dir.enf` | Directora de Enfermería | No ve las solicitudes de Informática |
| `docente` | Docente de Informática | Sus solicitudes de sala van al director de Informática |
| `estudiante` | Estudiante matriculada en Informática | Reserva salas de estudio con autorización |
| `academica`, `datd`, `operaciones`, `aseo` | Un rol cada uno | Dashboard, importación, mantención, reporte de daños |

## Comandos

| Comando | Qué hace |
|---|---|
| `pnpm dev` | Levanta API, web y compila `shared` en modo watch |
| `pnpm build` | Compila todo |
| `pnpm test` | Pruebas unitarias (reglas, validaciones) |
| `pnpm --filter @reservaitn/db test:db` | 40 pruebas de restricciones del modelo de datos |
| `pnpm --filter @reservaitn/api test:db` | Pruebas de integración de la API (flujo de reservas, series, importación, concurrencia) |
| `pnpm --filter @reservaitn/api prisma:pull` | Regenera `schema.prisma` desde la base tras una migración nueva (ADR 0004) |
| `pnpm typecheck` | Verificación de tipos en todo el monorepo |

## Documentación

1. [Metodología de trabajo](docs/01-metodologia.md)
2. [Roadmap paso a paso por sprint](docs/02-roadmap.md)
3. [Arquitectura](docs/03-arquitectura.md)
4. [Modelo de datos](docs/04-modelo-datos.md): [decisiones](docs/modelo-datos/decisiones.md) y [normalización](docs/modelo-datos/normalizacion.md)
5. [Flujo Git y GitHub](docs/05-flujo-git.md)
6. [Matriz de trazabilidad R1–R19](docs/06-trazabilidad.md)
7. [Estrategia de pruebas](docs/07-pruebas.md)
8. [Despliegue](docs/08-despliegue.md)
9. [Decisiones de arquitectura (ADR)](docs/adr/)
