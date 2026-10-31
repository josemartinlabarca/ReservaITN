import { defineConfig } from 'vitest/config';
// Pruebas de integración contra la base v1 con datos de demostración:
//   pnpm --filter @reservaitn/db demo && pnpm --filter @reservaitn/api test:db
export default defineConfig({
  test: {
    include: ['test/**/*.db.test.ts'],
    fileParallelism: false,
    env: { TZ: 'America/Santiago', TAREAS: 'off' },
  },
});
