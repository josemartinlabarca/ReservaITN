# 8. Despliegue (EDT 1.6)

| Entorno | Rama | API + BD | Web | Móvil |
|---|---|---|---|---|
| Local | cualquiera | Docker (`infra/docker-compose.yml`) | `pnpm dev` | Expo Go |
| Staging | `develop` | Servicio PaaS (p. ej. Render/Railway) + PostgreSQL gestionado | Vercel (preview) | EAS Build, canal `preview` |
| Producción | `main` | Ídem, plan pagado con respaldos diarios | Vercel (producción) | App Store / Google Play |

La elección del proveedor final la toma GP con el encargado de informática (I8), dentro del ítem
"Infraestructura año 1" del presupuesto ($1.100.000). Requisito: PostgreSQL ≥ 13 con la extensión `btree_gist`.

## Pasos de despliegue

1. `pnpm --filter @reservaitn/api prisma:deploy` (aplica migraciones; nunca `migrate dev` en producción).
2. `pnpm --filter @reservaitn/api build && pnpm --filter @reservaitn/api start`.
3. Web: variable `NEXT_PUBLIC_API_URL` apuntando a la API pública.
4. Móvil: `EXPO_PUBLIC_API_URL`, luego `eas build --platform all` y `eas submit`.

## Variables de entorno

| Variable | Dónde | Descripción |
|---|---|---|
| `DATABASE_URL` | API | Cadena de conexión PostgreSQL |
| `JWT_SECRET` | API | Secreto largo y aleatorio |
| `TZ` | API | `America/Santiago` |
| `CORS_ORIGIN` | API | URL de la web |
| `SMTP_URL` | API | Servidor de correo para notificaciones |
| `NEXT_PUBLIC_API_URL` | Web | URL pública de la API |
| `EXPO_PUBLIC_API_URL` | Móvil | URL pública de la API |
