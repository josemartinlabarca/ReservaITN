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

## Demostración en la nube (Vercel + Render + Neon)

Para mostrar el sistema al cliente y al docente antes de la puesta en marcha, sin costo. No reemplaza la
infraestructura de producción de arriba.

| Pieza | Servicio (plan gratis) | Configuración en el repositorio |
|---|---|---|
| Web (Next.js) | Vercel | `apps/web/vercel.json` |
| API (NestJS) | Render | `render.yaml` |
| Base de datos (PostgreSQL 16) | Neon | Las migraciones las aplica la API al iniciar |

Limitación del plan gratis de Render: la API se duerme tras 15 minutos sin uso y la primera visita tarda
cerca de un minuto en despertarla. Abrir la web unos minutos antes de una presentación.

### 1. Base de datos en Neon

1. En [neon.tech](https://neon.tech), crear el proyecto `reservaitn` con PostgreSQL 16, región AWS São Paulo
   (`sa-east-1`) o la más cercana.
2. Copiar la cadena de conexión **directa** (sin `-pooler` en el host). Termina en `?sslmode=require`.

### 2. API en Render

1. En [render.com](https://render.com): **New → Blueprint**, elegir el repositorio `ReservaITN`. Render lee
   `render.yaml` y crea el servicio `reservaitn-api`.
2. Completar las variables que pide:
   - `DATABASE_URL`: la cadena de Neon.
   - `CORS_ORIGIN` y `WEB_URL`: la URL de Vercel (se conoce en el paso 3; mientras tanto, cualquier valor).
   - `SMTP_URL`: opcional. Sin ella, los avisos quedan en la web y en el celular, pero no salen correos.
3. Esperar el primer despliegue y abrir `https://<servicio>.onrender.com/api/health`: debe responder
   `{"ok":true}`. El primer inicio crea las tablas y las cuentas de demostración (`MIGRAR_OPCIONES=--demo`).

### 3. Web en Vercel

1. En [vercel.com](https://vercel.com): **Add New → Project**, importar el repositorio `ReservaITN`.
2. **Root Directory**: `apps/web` (Vercel detecta Next.js y usa `vercel.json`).
3. Variables de entorno:
   - `NEXT_PUBLIC_API_URL` = `https://<servicio>.onrender.com/api`
   - `NEXT_PUBLIC_MOSTRAR_DEMO` = `true` (muestra los botones de cuentas de demostración en el login)
4. En **Settings → Git → Production Branch**, poner `feat/api-modelo-v1` mientras no se integre a `main`.
5. Desplegar. Copiar la URL final (por ejemplo `https://reservaitn.vercel.app`), volver a Render y ponerla
   en `CORS_ORIGIN` y `WEB_URL`. Render redespliega solo.

### 4. App móvil apuntando a la nube

En `apps/mobile/.env`: `EXPO_PUBLIC_API_URL=https://<servicio>.onrender.com/api`. Así se prueba desde
cualquier red, sin que el celular esté en el mismo wifi que el computador.

### Seguridad de la demostración

- Las cuentas de demostración usan la contraseña pública `reservaitn`: es solo para mostrar el sistema,
  sin datos reales de personas.
- Para producción: `MIGRAR_OPCIONES=--semillas` (sin datos de demostración), `NEXT_PUBLIC_MOSTRAR_DEMO`
  sin definir y un `JWT_SECRET` propio.
