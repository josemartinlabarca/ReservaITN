# Registro de cambios

Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versiones según el roadmap
(`v0.4.0` = H4, `v0.5.0` = H5). Cada entrada indica el requisito (R), entregable (E) o paquete de la EDT.

## [Sin publicar] — hacia H4 (13/11/2026) y H5 (27/11/2026)

### Agregado
- **Web con la identidad del ITN** (diseño de Braulio Campos, integrado sobre la API v1): menú lateral según
  permisos, modo oscuro, vista de celular, impresión, login con fotografía del campus y avisos flotantes
  ([docs/09-web.md](docs/09-web.md)).
- Pantallas nuevas: inicio con accesos y resumen personal, mis reservas con historial (R5, R7, R18),
  notificaciones (R6), mi cuenta con cambio de contraseña (E4) e importación de la planificación desde la
  web (R9, criterio E5).
- Administración separada en **Salas y laboratorios** (con QR de check-in) y **Usuarios** (roles con ámbito).
- API: `POST /auth/cambiar-clave`, `PATCH /notificaciones/leidas`, períodos abiertos en `GET /catalogos`,
  responsable y período en `GET /importaciones`, línea de tiempo legible (`linea`) en
  `GET /reservas/:id/historial` y sede, asistentes y origen en `GET /reservas/mias`.
- App móvil completa para docentes, estudiantes y aseo: reservar, mis reservas, check-in por QR, avisos
  push, inventario y reporte de daños (E11, E12).
- Mantención en la web: órdenes de trabajo, asignación de personal y bloqueo del espacio (R15, R17).
- Calendario semanal por espacio con clic para reservar (R3).
- Envío real de correos con cola, reintentos y plantilla HTML (R6).
- Cancelación de cualquier reserva por Subdirección con motivo obligatorio y reporte Excel profesional (R5, R13).
- Reservas al minuto, únicas o semanales (R1, R2).
- Documentación de infraestructura de producción dimensionada y presupuestada ([docs/08-despliegue.md](docs/08-despliegue.md)).

### Cambiado
- La API usa el modelo de datos v1 normalizado (FNBC): roles y permisos desde la base, reglas de
  aprobación configurables, anti-choques con `EXCLUDE` (incluye pendientes).
- PostgreSQL local publicado en el puerto 5434 por defecto para no chocar con instalaciones de Windows.

### Corregido
- El rango del dashboard incluye el último día y muestra todas las reservas del período.
- Mensajes claros cuando la base de datos no está disponible.

## [0.1.0] — 04/11/2026 · Incremento 1

### Agregado
- Login y roles (M1), CRUD de salas y laboratorios (M2), reserva con anti-choques (M3) y dashboard de
  ocupación (M4), aprobados en el acta ACT-P05-REV-01.
