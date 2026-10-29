import { defineConfig } from 'vitest/config';
// Requiere DATABASE_URL apuntando a una base con migraciones y semillas aplicadas.
// Cada prueba corre dentro de una transacción que se revierte: no deja datos.
export default defineConfig({ test: { include: ['pruebas/**/*.test.ts'], fileParallelism: false } });
