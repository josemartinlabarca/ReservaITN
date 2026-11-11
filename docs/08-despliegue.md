# 8. Despliegue e infraestructura (EDT 1.6)

## Entornos

| Entorno | Rama | Dónde corre | Móvil |
|---|---|---|---|
| Local | cualquiera | Docker (`infra/docker-compose.yml`) + `pnpm dev` | Expo Go |
| Producción | `main` | Servidor en la nube + PostgreSQL gestionado (abajo) | App Store / Google Play (EAS Build) |

Staging: en el mismo servidor de producción, con otra base de datos y el subdominio
`pruebas.reservas.itn.cl`, para no sumar costo. Se usa para la UAT (semana 9).

## Infraestructura elegida (presupuesto "Infraestructura año 1": $1.100.000)

Proveedor de referencia: DigitalOcean (precios en USD, verificados en noviembre de 2026). Cualquier
proveedor equivalente sirve; la decisión final la toma GP con el encargado de informática (I8).

| Componente | Especificación | USD/mes | Año 1 (CLP) |
|---|---|---|---|
| Servidor de aplicación | 2 vCPU · 4 GB RAM · 80 GB SSD · 4 TB de transferencia | 24,00 | $335.866 |
| Respaldo diario del servidor | Copia automática diaria (30 % del valor del servidor) | 7,20 | $100.760 |
| Base de datos PostgreSQL 16 gestionada | 1 vCPU · 1 GB RAM · 10 GB SSD · respaldo diario con 7 días de recuperación | 15,00 | $209.916 |
| Almacenamiento de archivos | 250 GB: fotos de daños, reportes y copia mensual de la base fuera del servidor | 5,00 | $69.972 |
| Cuenta Apple Developer | Publicación en App Store (USD 99/año) | — | $115.454 |
| Cuenta Google Play | Publicación en Google Play (USD 25, pago único) | — | $29.155 |
| Dominio | `reservas.itn.cl` (subdominio del ITN, $0) o `reservaitn.cl` en NIC Chile | — | $9.990 |
| Correo de avisos | Cuenta institucional `no-responder@itn.cl` (alternativa: Brevo, gratis hasta 300/día) | — | $0 |
| Push, HTTPS y compilación de la app | Expo Push, certificado Let's Encrypt, EAS plan gratuito | — | $0 |
| **Subtotal** | | **51,20** | **$871.113** |
| Reserva por tipo de cambio y crecimiento | 20,8 % | | $228.887 |
| **Total** | | | **$1.100.000** |

Supuestos: dólar $980 e IVA 19 % sobre servicios digitales extranjeros (Ley 21.210). La reserva cubre
un dólar de hasta ≈ $1.237 o un aumento de recursos durante el año.

**Año 2 en adelante** (lo paga el ITN; el soporte posterior a la garantía es un contrato aparte):
≈ $842.000 al año (≈ $70.000 al mes), con los mismos supuestos.

### Por qué este tamaño

| Recurso | Necesidad estimada | Elegido | Margen |
|---|---|---|---|
| CPU y RAM del servidor | API (NestJS) ≈ 250 MB, web (Next.js) ≈ 250 MB, proxy HTTPS ≈ 30 MB; uso pico estimado de 200 personas simultáneas (10 % de 1.920 usuarios) al inicio de semestre | 2 vCPU · 4 GB | Holgado: deja espacio para staging y para actualizar sin cortar el servicio |
| Disco del servidor | Sistema, imágenes Docker y registros < 20 GB | 80 GB | 4× |
| Base de datos | Medido: ≈ 4 KB por reserva con su auditoría; ≈ 30.000 reservas/año → ≈ 120 MB/año | 10 GB · 1 GB RAM | > 50 años de datos; se amplía con un clic si hiciera falta |
| Archivos | Fotos de daños (≈ 300 KB c/u) y respaldos mensuales | 250 GB | Holgado |

Se eligió **base de datos gestionada** y no instalada en el servidor: el proveedor la actualiza, la
respalda a diario y permite recuperar cualquier momento de los últimos 7 días. Protege lo más crítico
(reservas y trazabilidad, R7) sin depender de que alguien del equipo administre PostgreSQL.

Requisito técnico: PostgreSQL ≥ 13 con las extensiones `btree_gist` y `citext` (disponibles en los
servicios gestionados habituales).

## Trámites del ITN antes de publicar (hito H7, 7–11 de diciembre)

- **Número D-U-N-S** del ITN: Apple y Google lo exigen para publicar como institución. Es gratuito,
  pero puede tardar días o semanas.
- Tarjeta institucional para pagos en dólares (nube, Apple, Google).
- Acceso a la configuración DNS de `itn.cl` (registro para `reservas.itn.cl`).
- Cuenta de correo `no-responder@itn.cl` con acceso SMTP.

## Pasos de despliegue

1. Migraciones y catálogos (sin datos de demostración): `DATABASE_URL=… pnpm --filter @reservaitn/db semillas`.
2. API: `pnpm --filter @reservaitn/api build && pnpm --filter @reservaitn/api start` (o su imagen Docker).
3. Web: `NEXT_PUBLIC_API_URL` apuntando a la API pública; `pnpm --filter @reservaitn/web build && … start`.
4. Proxy con HTTPS automático (Caddy) delante de la web y la API.
5. Móvil: `EXPO_PUBLIC_API_URL` con la URL pública; `eas build --platform all` y `eas submit`.
6. Carga inicial: importar el Excel del semestre desde la web (Operaciones) y crear los usuarios.

## Variables de entorno

| Variable | Dónde | Descripción |
|---|---|---|
| `DATABASE_URL` | API, migraciones | Cadena de conexión PostgreSQL (con `sslmode=require` en la base gestionada) |
| `JWT_SECRET` | API | Secreto largo y aleatorio |
| `TZ` | API | `America/Santiago` |
| `CORS_ORIGIN` | API | URL pública de la web |
| `SMTP_URL`, `SMTP_FROM` | API | Servidor y remitente de los avisos |
| `WEB_URL` | API | URL pública de la web (botones de los correos) |
| `NEXT_PUBLIC_API_URL` | Web | URL pública de la API |
| `EXPO_PUBLIC_API_URL` | Móvil | URL pública de la API |
