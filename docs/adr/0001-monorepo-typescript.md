# ADR 0001 — Monorepo TypeScript (pnpm + Turborepo)

**Estado:** aceptada · **Fecha:** 28/10/2026

## Contexto
El sistema tiene web, app móvil (Android/iOS) y API, con un equipo de 4 personas y 4 semanas de
desarrollo. Las mismas reglas (roles, validación de reservas, choques) se necesitan en los tres.

## Decisión
Un único repositorio con `pnpm workspaces` y `turbo`. Todo en TypeScript:
NestJS (API), Next.js (web), Expo/React Native (móvil) y un paquete `shared` con Zod.

## Consecuencias
- (+) Una regla se escribe y se prueba una vez; un cambio de API rompe la compilación del cliente al instante.
- (+) Todo el equipo trabaja en un solo lenguaje; un PR puede cambiar API y web juntos.
- (+) Un solo código para Android e iOS (respuesta al riesgo RI6).
- (−) Expo requiere `node-linker=hoisted` en pnpm.
