# ADR 0004 — El esquema de la base de datos se escribe en SQL

**Estado:** aceptada · **Fecha:** 29/10/2026

## Contexto
El modelo v1 (48 tablas, 7 esquemas) depende de capacidades de PostgreSQL que Prisma no puede
declarar: restricciones `EXCLUDE` (anti-choques, períodos y bloques sin solaparse),
`UNIQUE NULLS NOT DISTINCT`, tipos de rango propios, triggers (transiciones de estado,
aprobación, check-in, auditoría) y vistas.

## Decisión
- El esquema vive en `packages/db/migraciones` como **SQL versionado** (`V001…`), aplicado por un
  ejecutor propio que verifica checksums.
- Cada restricción tiene una prueba en `packages/db/pruebas` que intenta romperla.
- La API seguirá usando Prisma **solo como cliente**: el `schema.prisma` se generará desde la base
  con `prisma db pull` (característica `multiSchema`), nunca a la inversa.

## Consecuencias
- (+) Las reglas críticas (R1, R7, estados) las garantiza la base, sin importar qué cliente escriba.
- (+) El esquema se revisa en los PR como SQL legible, y las pruebas demuestran cada restricción.
- (−) El equipo debe saber SQL de PostgreSQL. Se compensa con las pruebas y los comentarios.
- (−) **Transición:** la API actual (`apps/api`) usa todavía el modelo v0 de `apps/api/prisma`.
  Migrar la API al modelo v1 es el siguiente paso (ver roadmap).
