# ADR 0002 — Garantizar el anti-choques en la base de datos

**Estado:** aceptada · **Fecha:** 28/10/2026

## Contexto
R1 es el requisito más importante y el criterio de aceptación de E6 exige 0 reservas dobles en ≥ 200 casos.
Una validación solo en código falla cuando dos aprobadores aprueban a la vez (condición de carrera).

## Decisión
Restricción `EXCLUDE USING gist` de PostgreSQL sobre `(sala_id, tstzrange(inicio, fin))` para reservas
`APROBADA`. La API además valida antes, para devolver un mensaje claro; si dos operaciones compiten, la
BD rechaza la segunda (error 23P01) y la API responde **409**.

## Consecuencias
- (+) Garantía absoluta incluso con importaciones masivas o accesos concurrentes. Verificado con 200 inserciones concurrentes.
- (+) Las reservas de mantención usan la misma tabla y quedan protegidas igual (R15).
- (−) Requiere PostgreSQL con `btree_gist` (disponible en todos los proveedores gestionados habituales).
- (−) La restricción vive en SQL manual dentro de la migración inicial; documentado aquí.
