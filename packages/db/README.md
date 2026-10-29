# @reservaitn/db: modelo de datos v1

Modelo físico de la base de datos, escrito en SQL. Es la fuente de verdad del esquema (ver
[ADR 0004](../../docs/adr/0004-sql-como-fuente-de-verdad.md)). El diseño y su justificación están en
[docs/modelo-datos](../../docs/modelo-datos/).

```
migraciones/   V001…V009: un archivo por esquema, se aplican en orden y no se editan una vez aplicados
semillas/      catálogos iniciales (idempotentes: se pueden ejecutar varias veces)
pruebas/       36 pruebas que intentan romper cada restricción
scripts/       migrar.mjs: aplica migraciones pendientes y verifica su checksum
```

| Comando | Qué hace |
|---|---|
| `pnpm --filter @reservaitn/db migrar` | Aplica las migraciones pendientes |
| `pnpm --filter @reservaitn/db semillas` | Migra y carga los catálogos |
| `pnpm --filter @reservaitn/db test:db` | Ejecuta las pruebas (cada una en una transacción que se revierte) |

Todos requieren `DATABASE_URL`. Para crear una base local:

```bash
createdb -h localhost -U reservaitn reservaitn_modelo
```

```bash
DATABASE_URL=postgresql://reservaitn:reservaitn@localhost:5432/reservaitn_modelo pnpm --filter @reservaitn/db semillas
```

## Reglas para cambiar el esquema

1. **Nunca** se edita una migración ya aplicada; el ejecutor lo detecta por checksum y se detiene.
   Se crea `V010__descripcion.sql`.
2. Toda restricción nueva lleva **nombre explícito** (`CONSTRAINT nombre CHECK …`) y una prueba en `pruebas/`.
3. Un CHECK sobre una columna que admite nulos debe considerar el nulo (`coalesce` o `IS NOT NULL`):
   en PostgreSQL, un CHECK que evalúa a NULL **se considera cumplido**.
4. Los cambios de modelo se registran en `docs/modelo-datos/decisiones.md`.

## Contenido

| Esquema | Tablas | Triggers y vistas |
|---|---|---|
| `seguridad` | 8 | Validación de RUT (función `rut_valido`) |
| `institucion` | 12 | — |
| `academico` | 7 | — |
| `reservas` | 9 | Transiciones de estado, aprobación → reservas, check-in, `expirar_pendientes()`, `v_importacion_resumen`, `v_reserva_trazabilidad` |
| `mantencion` | 5 | `v_diferencia_inventario` |
| `comunicacion` | 6 | Avisos obligatorios |
| `auditoria` | 1 | Bitácora inmutable en todas las tablas de negocio, `actualizado_en` automático |
