# ADR 0003 — Una sola app móvil con interfaz según el rol

**Estado:** aceptada · **Fecha:** 28/10/2026

## Contexto
La EDT separa la app de docentes/estudiantes (1.4.9) y la de mantención (1.4.10).

## Decisión
Publicar **una** app (ReservaITN) que muestra pestañas según los permisos del usuario:
quien tiene `reserva:solicitar` ve *Reservar*; quien tiene `danio:reportar` ve *Reportar daño*.
Ambos paquetes EDT se siguen midiendo por separado (pantallas distintas).

## Consecuencias
- (+) Un solo proceso de revisión en App Store y Google Play (riesgo RI6), una cuenta de desarrollador.
- (+) Menos código duplicado (login, sesión, avisos).
- (−) Requiere validar con el cliente que el personal de aseo instala la misma app.
