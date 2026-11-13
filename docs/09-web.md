# 9. Web (`apps/web`)

Aplicación Next.js 16 (App Router, React 19) para reservar, aprobar, administrar y generar reportes
desde el computador. Habla solo con la API v1 (`NEXT_PUBLIC_API_URL`) y reutiliza roles, permisos y
validaciones de `packages/shared`: una regla se escribe una vez para la API, la web y el móvil.

El diseño visual (identidad del ITN, menú lateral por rol, login, inicio, mis reservas, avisos, mi cuenta
e importación) viene del trabajo de Braulio Campos y se integró sobre la API v1 en noviembre de 2026.

## Estructura

```
apps/web/
├── app/
│   ├── layout.tsx           html raíz, título, color de tema y <SoloCliente> (evita errores de hidratación)
│   ├── globals.css          sistema visual ITN: variables, componentes, modo oscuro, celular e impresión
│   ├── page.tsx             redirige a /inicio
│   ├── login/               ingreso (fuera del panel), con su propio login.module.css
│   └── (panel)/             todo lo que exige sesión; el grupo no aparece en la URL
│       ├── layout.tsx       envuelve cada página con <Panel>
│       └── <pantalla>/page.tsx
├── components/
│   ├── Panel.tsx            menú lateral según permisos, barra superior, usePanel(), ConPermiso
│   ├── ui.tsx               Icono, Logo, Cabecera, Badge, EstadoBadge, Modal, Vacio, Cargando, useAviso, useDatos
│   ├── Historial.tsx        línea de tiempo de una reserva (R7)
│   ├── DialogoMotivo.tsx    pide el motivo al rechazar o cancelar una reserva ajena
│   └── Administracion.tsx   AdminEspacios (con QR) y AdminUsuarios (roles con ámbito)
├── lib/
│   ├── api.ts               api(), enviar(), descargar(), mensajeError(), sesión en localStorage
│   ├── formato.ts           nombres de roles y estados, rolPrincipal(), fechas es-CL, descargarCsv()
│   └── tipos.ts             forma de las respuestas JSON de la API que usan varias pantallas
└── public/itn-campus.png    fotografía del campus (login e inicio)
```

## Pantallas

Los permisos los calcula la base de datos al iniciar sesión (`seguridad.permisos_de`) y llegan en
`sesion.usuario.permisos`. El menú solo muestra lo que el usuario puede usar.

| Ruta | Permiso | Requisitos | API que usa |
|---|---|---|---|
| `/login` | público | E4 | `POST /auth/login` |
| `/inicio` | sesión | — | `GET /reservas/mias`, `/notificaciones/mias`, `/solicitudes/pendientes` |
| `/reservar` | `reserva:solicitar` | R1, R2, R10, R11 | `GET /espacios`, `/sedes`, `/catalogos`, `POST /sugerencia`, `POST /reservas` |
| `/calendario` | sesión | R3 | `GET /espacios`, `GET /reservas/ocupacion` |
| `/mis-reservas` | `reserva:solicitar` | R5, R7, R18 | `GET /reservas/mias`, `POST /reservas/:id/cancelar`, `GET /reservas/:id/historial` |
| `/aprobaciones` | `reserva:aprobar` | R4, R6 | `GET /solicitudes/pendientes`, `POST /solicitudes/:id/aprobar` · `rechazar` |
| `/dashboard` | `dashboard:ver` | R7, R12, R13, R14 | `GET /dashboard/ocupacion` · `indicadores` · `reservas` · `reporte.xlsx`, `/proyeccion` |
| `/salas` | `recurso:gestionar` | R8, R18 | `GET /espacios?todos=true`, `POST /espacios`, `PATCH /espacios/:id`, `/espacios/:id/qr` |
| `/importacion` | `planificacion:importar` | R9 (E5) | `GET /catalogos` (períodos), `POST /importaciones` (multipart), `GET /importaciones` |
| `/mantencion` | `danio:gestionar` · `mantencion:planificar` | R15, R17 | `/mantencion/danios`, `/mantencion/ordenes`, `/mantencion/personal` |
| `/usuarios` | `usuario:gestionar` | E4 | `GET /usuarios`, `POST /usuarios`, `PATCH /usuarios/:id` |
| `/notificaciones` | sesión | R6 | `GET /notificaciones/mias`, `PATCH /notificaciones/leidas` · `:id/leida` |
| `/perfil` | sesión | E4 | `POST /auth/cambiar-clave` |

Ocultar una opción en la web es solo comodidad: la API vuelve a validar cada permiso con `@RequierePermiso`.

## Identidad visual

| Token | Valor | Uso |
|---|---|---|
| `--navy-700` | `#1c3f7a` | Azul institucional: botones, enlaces, barras, reservas aprobadas en el calendario |
| `--navy-900` | `#0e2347` | Menú lateral |
| `--orange-500` | `#f2a01e` | Triángulo del logo: acción destacada, menú activo, día de hoy |
| `--ok` / `--warn` / `--danger` | verde / ámbar / rojo | Estados aprobada / pendiente / rechazada o cancelada |

Los colores se usan siempre por variable (`var(--accent)`, `var(--surface)`…), nunca en hexadecimal dentro
de los componentes; así el modo oscuro (`prefers-color-scheme: dark`) funciona sin código extra.

## Cómo agregar una pantalla

1. Crear `app/(panel)/<ruta>/page.tsx` con `'use client'`.
2. Envolver el contenido en `<ConPermiso permiso="…">` si no es para todos los roles.
3. Poner arriba `<Cabecera miga="…" titulo="…" sub="…" />`.
4. Cargar datos con `useDatos<T>('/ruta-api')` (devuelve `datos`, `error`, `cargando`, `recargar`).
5. Escribir con `enviar('/ruta', cuerpo, 'POST' | 'PATCH')` y mostrar el resultado con `useAviso()`;
   para errores de validación, `mensajeError(e)` junta los mensajes por campo.
6. Agregar la entrada a `MENU` en `components/Panel.tsx` con su ícono y permiso.
7. Si la API devuelve una forma que usan varias pantallas, declararla en `lib/tipos.ts`.

Next.js no permite exportar nada más que el componente por defecto desde un `page.tsx`: los componentes
compartidos entre pantallas van en `components/`.
