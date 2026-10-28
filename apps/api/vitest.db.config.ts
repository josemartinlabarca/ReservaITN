import { defineConfig } from 'vitest/config';
// Pruebas de integración contra PostgreSQL real (requiere DATABASE_URL y migraciones aplicadas).
export default defineConfig({ test: { include: ['test/**/*.db.test.ts'], fileParallelism: false } });
