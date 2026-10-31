# 0. Guía de inicio: levantar ReservaITN en tu computador

Tiempo estimado: **20–30 minutos** la primera vez. Después, solo el paso 7.

Al terminar tendrás corriendo:

| Servicio | Dirección | Para qué |
|---|---|---|
| Base de datos PostgreSQL 16 | `localhost:5434` | Datos (modelo v1, 48 tablas) |
| API (NestJS) | http://localhost:3001/api | Reglas de negocio |
| Web (Next.js) | http://localhost:3000 | Administración, dashboard, aprobaciones |
| App móvil (Expo) | En tu celular, con Expo Go | Docentes, estudiantes, aseo |
| Mailpit (opcional) | http://localhost:8025 | Bandeja de correos de prueba |

---

## Paso 1. Instalar las herramientas (una sola vez)

| Herramienta | Versión | Cómo comprobarla |
|---|---|---|
| Git | cualquiera reciente | `git --version` |
| Node.js | **22** | `node -v` → `v22.x` |
| pnpm | **10.28.0** (la fija el proyecto) | `pnpm -v` |
| Docker Desktop | cualquiera reciente | `docker compose version` |
| Expo Go (celular) | la de la tienda | App Store / Google Play |

**Node.js 22.** Recomendado con un administrador de versiones, para no chocar con otros proyectos:
- macOS / Linux: [nvm](https://github.com/nvm-sh/nvm). En la carpeta del proyecto, `nvm install` lee `.nvmrc`.
- Windows: [nvm-windows](https://github.com/coreybutler/nvm-windows), y luego `nvm install 22` y `nvm use 22`.

**pnpm.** Viene con Node a través de Corepack. Actívalo una vez:

```bash
corepack enable
```

Al entrar al proyecto, Corepack usa automáticamente la versión indicada en `package.json` (10.28.0).

**Docker Desktop.** Ábrelo y espera a que diga *Engine running* antes de seguir. Si no puedes
instalar Docker, usa la opción B del paso 4.

---

## Paso 2. Clonar el repositorio

```bash
git clone https://github.com/josemartinlabarca/ReservaITN.git
```

```bash
cd reservaitn
```

Trabaja en la rama de integración del equipo:

```bash
git checkout develop
```

> Mientras el pull request `feat/api-modelo-v1` no se integre a `develop`, usa esa rama:
> `git checkout feat/api-modelo-v1`.

---

## Paso 3. Instalar dependencias

Desde la raíz del proyecto (instala las de todos los paquetes a la vez):

```bash
pnpm install
```

Debe terminar con `Done in …`. Si aparece *"Ignored build scripts"*, no hagas nada: los paquetes que
necesitan compilarse (Prisma, esbuild, NestJS) ya están autorizados en `package.json`.

---

## Paso 4. Levantar la base de datos

### Opción A: con Docker (recomendada)

```bash
pnpm db:up
```

Comprueba que el contenedor quedó *healthy*:

```bash
docker compose -f infra/docker-compose.yml ps
```

Esto crea un PostgreSQL 16 con usuario, contraseña y base `reservaitn`, y Mailpit para los correos.
En Docker Desktop aparece como el grupo **`reservaitn`**.

> **Puerto 5434.** La base de ReservaITN se publica en el puerto **5434** y no en el 5432 habitual.
> En Windows es común tener un PostgreSQL instalado ocupando el 5432, y ese gana la conexión a
> `localhost` aunque Docker también publique el 5432. Con un puerto propio no chocan.
>
> Si el 5434 también está ocupado (`netstat -ano | findstr :5434` muestra algo), elige otro, por
> ejemplo el 5435, y úsalo al levantar la base:
>
> - CMD: `set DB_PUERTO=5435&& pnpm db:up`
> - PowerShell: `$env:DB_PUERTO=5435; pnpm db:up`
> - macOS / Linux: `DB_PUERTO=5435 pnpm db:up`
>
> y pon el mismo puerto en `DATABASE_URL` de `apps/api/.env` (paso 5).

### Opción B: PostgreSQL instalado en tu computador

Instala PostgreSQL 16 (o 13 o superior) y crea el usuario y la base. Con `psql` como administrador:

```bash
psql -U postgres -c "CREATE ROLE reservaitn LOGIN PASSWORD 'reservaitn';"
```

```bash
psql -U postgres -c "CREATE DATABASE reservaitn OWNER reservaitn;"
```

No hace falta que el usuario sea superusuario: basta con que sea dueño de la base.

**Importante:** tu PostgreSQL usa el puerto **5432**, así que en el paso 5 cambia `5434` por `5432`
en `DATABASE_URL`.

---

## Paso 5. Configurar las variables de entorno

Copia los archivos de ejemplo. En macOS / Linux:

```bash
cp apps/api/.env.example apps/api/.env
```

```bash
cp apps/web/.env.example apps/web/.env.local
```

En Windows (PowerShell o CMD):

```bash
copy apps\api\.env.example apps\api\.env
```

```bash
copy apps\web\.env.example apps\web\.env.local
```

Contenido de `apps/api/.env` (sirve tal cual para desarrollo):

| Variable | Valor por defecto | Qué es |
|---|---|---|
| `DATABASE_URL` | `postgresql://reservaitn:reservaitn@localhost:5434/reservaitn` | Conexión a la base del paso 4 (puerto 5434 con Docker; 5432 con la opción B) |
| `JWT_SECRET` | `cambiar-en-produccion` | Firma de las sesiones. En producción, un valor largo y aleatorio |
| `PORT` | `3001` | Puerto de la API |
| `CORS_ORIGIN` | `http://localhost:3000` | Desde dónde puede llamarla la web |
| `SMTP_URL` | `smtp://localhost:1025` | Servidor de correo. En desarrollo, Mailpit (los correos se ven en http://localhost:8025) |
| `SMTP_FROM` | `ReservaITN <no-responder@itn.cl>` | Remitente de los avisos |
| `WEB_URL` | `http://localhost:3000` | Dirección de la web, para el botón de los correos |
| `TZ` | `America/Santiago` | Las reglas de horario se evalúan en hora de Chile |

Los archivos `.env` **nunca** se suben a GitHub (están en `.gitignore`).

---

## Paso 6. Crear las tablas y cargar los datos de demostración

```bash
pnpm db:seed
```

Salida esperada:

```
✔ V001__esquemas_y_utilidades.sql
  …
✔ V010__funciones_de_aprobacion_y_liberacion.sql
10 migración(es) aplicada(s)
✔ semillas/S001__catalogos.sql
✔ semillas/demo/D001__demo.sql
```

El comando aplica las migraciones pendientes y carga los catálogos (roles, permisos, reglas) y los datos
de demostración (2 sedes, 8 espacios, 2 carreras, 9 usuarios). Se puede ejecutar varias veces sin
duplicar nada. Cuando alguien del equipo agregue una migración nueva, vuelve a ejecutarlo.

---

## Paso 7. Levantar la API y la web

```bash
pnpm dev
```

Espera unos 15 segundos hasta ver estas dos líneas:

```
@reservaitn/api:dev: ReservaITN API escuchando en http://localhost:3001/api
@reservaitn/web:dev:  ✓ Ready in …
```

Compruébalo:
- http://localhost:3001/api/health → `{"ok":true,"servicio":"reservaitn-api"}`
- http://localhost:3000 → pantalla de inicio de sesión

Para detener todo: `Ctrl + C` en esa terminal.

---

## Paso 8. Probar el sistema

Todos los usuarios de demostración usan la contraseña **`reservaitn`**:

| Correo | Roles | Qué permite probar |
|---|---|---|
| `subdireccion@itn.cl` | Subdirección | Control total: se autoaprueba, aprueba y cancela cualquier reserva |
| `dir.inf@itn.cl` | Director de Informática + Docente | Aprueba lo de Informática y el LAB-INF1; también pide salas |
| `dir.enf@itn.cl` | Directora de Enfermería | No ve las solicitudes de Informática |
| `docente@itn.cl` | Docente de Informática | Sus solicitudes van al director de Informática |
| `estudiante@itn.cl` | Estudiante matriculada en Informática | Reserva salas de estudio con autorización |
| `academica@itn.cl` | Dirección Académica | Dashboard, importación del Excel |
| `operaciones@itn.cl` | Operaciones | Daños, órdenes de trabajo |
| `aseo@itn.cl` | Aseo y mantención | Solo reporta daños (no puede reservar) |
| `datd@itn.cl` | DATD (patrocinadora) | Dashboard y usuarios |

**Recorrido sugerido (5 minutos), que muestra el flujo central (todo en la web):**

1. Entra como `docente@itn.cl`: llegas directo a **Reservar**. Elige un día (por ejemplo, el próximo
   martes), **Desde 08:55** y **Hasta 10:10** (las horas se eligen al minuto), el espacio **A-101**,
   la actividad *Clase* y un motivo. Debajo del espacio verás lo que ya está ocupado ese día.
   Presiona **Reservar**: queda *pendiente de aprobación* y aparece en **Mis reservas**.
2. Cambia el horario a 09:30–11:00: la página avisa que se cruza y no deja reservar.
3. **Salir** y entrar como `dir.inf@itn.cl` → **Aprobaciones**. Ahí está la solicitud del docente
   (le corresponde porque el docente es de Informática). Apruébala.
4. Vuelve a entrar como `docente@itn.cl`: en **Mis reservas** ahora dice *Aprobada*.
5. Entra como `subdireccion@itn.cl` → **Dashboard**, elige un rango que incluya ese día y haz clic en
   A-101 para ver el detalle.

Con la app móvil (paso 9) puedes hacer lo mismo como `estudiante@itn.cl`, por ejemplo con una sala
de estudio que se repite cada semana; sus avisos aparecen en la pestaña **Avisos**.

**Contra la API directamente** (útil para probar desde la terminal; macOS / Linux):

```bash
TOKEN=$(curl -s localhost:3001/api/auth/login -H 'content-type: application/json' -d '{"email":"estudiante@itn.cl","password":"reservaitn"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).token')
```

```bash
curl -s "localhost:3001/api/espacios?tipo=SALA_ESTUDIO" -H "authorization: Bearer $TOKEN"
```

Copia el `id` del espacio `EST-1`, cambia la fecha por una de los próximos días (que no sea domingo) y:

```bash
curl -s localhost:3001/api/reservas -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' -d '{"espacioId":"<id>","inicio":"2026-11-05T15:00:00","fin":"2026-11-05T17:00:00","tipoActividad":"ESTUDIO","descripcion":"Grupo de estudio","asistentes":5}'
```

---

## Paso 9. App móvil en tu celular

1. Averigua la **IP de tu computador** en la red WiFi: en Windows `ipconfig` (*Dirección IPv4*); en
   macOS `ipconfig getifaddr en0`; en Linux `hostname -I`. Ejemplo: `192.168.1.10`.
2. Crea `apps/mobile/.env` con esa IP (el celular no puede usar `localhost`, porque `localhost`
   sería el propio celular):

   ```
   EXPO_PUBLIC_API_URL=http://192.168.1.10:3001/api
   ```

3. Con `pnpm dev` corriendo en una terminal, abre **otra terminal** y ejecuta:

   ```bash
   pnpm dev:movil
   ```

4. Escanea el código QR: con la cámara en iPhone, o desde Expo Go en Android.
5. El celular y el computador deben estar en la **misma red WiFi**. Si no conecta, permite el puerto
   3001 en el firewall del computador (en Windows aparece un aviso la primera vez: acepta *redes privadas*).

> **Versión de Expo.** La app usa el SDK 52 de Expo. La app Expo Go de las tiendas solo abre
> proyectos con el SDK más reciente; si Expo Go dice que el proyecto es *incompatible*, hay que
> actualizar el SDK (`npx expo install expo@latest --fix` dentro de `apps/mobile`) o usar una
> *development build*. Avísale al equipo antes de actualizarlo, porque afecta a todos.

---

## Paso 10. Ejecutar las pruebas

| Comando | Qué prueba | Necesita la base |
|---|---|---|
| `pnpm test` | Reglas y validaciones (shared, API) | No |
| `pnpm --filter @reservaitn/db test:db` | 40 restricciones del modelo de datos | Sí |
| `pnpm --filter @reservaitn/api test:db` | Flujo completo: solicitar, aprobar, series, concurrencia, importación | Sí, con `pnpm db:seed` |
| `pnpm typecheck` | Tipos en todo el monorepo | No |

Las pruebas de la API escriben datos de prueba en fechas futuras lejanas (años 2090 y siguientes), que
aparecerán en la bandeja de aprobaciones de `dir.inf`. Si molestan, reinicia la base (sección
*Reiniciar la base desde cero*).

GitHub Actions ejecuta todo esto en cada push y pull request.

---

## Trabajo diario

```bash
git checkout develop && git pull
```

```bash
pnpm install && pnpm db:seed
```

```bash
git checkout -b feat/1.4.7-exportar-reporte
```

```bash
pnpm dev
```

Al terminar: commit con [Conventional Commits](05-flujo-git.md), `git push -u origin <rama>` y pull
request hacia `develop`. Detalle en [05-flujo-git.md](05-flujo-git.md).

**Si cambias la base de datos:** crea `packages/db/migraciones/V011__descripcion.sql` (nunca edites
una migración existente), agrega su prueba en `packages/db/pruebas/`, aplica con `pnpm db:seed` y
regenera el cliente de la API:

```bash
pnpm --filter @reservaitn/api prisma:pull
```

---

## Reiniciar la base desde cero

Con Docker (borra el volumen con todos los datos):

```bash
docker compose -f infra/docker-compose.yml down -v
```

```bash
pnpm db:up && pnpm db:seed
```

Sin Docker:

```bash
psql -U postgres -c "DROP DATABASE reservaitn;" -c "CREATE DATABASE reservaitn OWNER reservaitn;"
```

```bash
pnpm db:seed
```

---

## Problemas frecuentes

| Síntoma | Causa | Solución |
|---|---|---|
| `pnpm: command not found` | Corepack no activado | `corepack enable` y abrir una terminal nueva |
| *No hay ningún PostgreSQL escuchando* (`ECONNREFUSED`, `P1001`) | La base no está corriendo, o corre en otro puerto que el de `DATABASE_URL` | `pnpm db:up` y comparar el puerto de `docker ps --format "table {{.Names}}\t{{.Ports}}"` con el de `apps/api/.env` |
| `password authentication failed for user "reservaitn"` | Respondió otro PostgreSQL (por ejemplo, uno instalado en Windows en el 5432) en vez del de ReservaITN | Verificar que `DATABASE_URL` use el puerto **5434** (el de Docker) y que `docker ps` muestre `reservaitn-db-1` con `5434` |
| `Port 3000 is already in use` (o 3001) | Otra app usa el puerto | Cerrarla, o en macOS / Linux: `npx kill-port 3000 3001` |
| `La migración V00X cambió después de aplicarse` | Alguien editó una migración ya aplicada | No se editan migraciones: revertir el cambio y crear una nueva. En desarrollo, reiniciar la base |
| La web dice *Credenciales inválidas* con los usuarios demo | No se cargaron los datos de demostración | `pnpm db:seed` |
| La API falla con `Unknown field` o `Invalid prisma.… invocation` | Cliente de Prisma desactualizado tras una migración nueva | `pnpm --filter @reservaitn/api prisma:pull` |
| La app móvil dice *Error de conexión* | Usa `localhost` o el firewall bloquea el puerto | Revisar `apps/mobile/.env` (paso 9) y el firewall |
| Expo Go dice que el proyecto es incompatible | SDK de Expo distinto al de Expo Go | Ver la nota del paso 9 |
| Los correos no llegan a Mailpit (http://localhost:8025) | Mailpit no está corriendo, falta `SMTP_URL` en `apps/api/.env`, o el despachador aún no hace su vuelta (cada 15 s) | `docker ps` debe mostrar `reservaitn-mail-1`; revisa `SMTP_URL`. El estado de cada correo está en `comunicacion.envio` (`PENDIENTE`, `ENVIADO`, `FALLIDO` con `ultimo_error`) |
