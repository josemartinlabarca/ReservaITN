// Aplica las migraciones pendientes de packages/db/migraciones, en orden y cada una en su transacción.
// Guarda un checksum por archivo: si alguien edita una migración ya aplicada, se detiene con error
// (las migraciones aplicadas no se editan; se crea una nueva).
// Uso: DATABASE_URL=... node scripts/migrar.mjs [--semillas | --demo]
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
// Usa DATABASE_URL; si no está definida, la toma de apps/api/.env (misma base que la API)
function urlDesdeEnvDeLaApi() {
  try {
    const env = readFileSync(join(raiz, '..', '..', 'apps', 'api', '.env'), 'utf8');
    return /^DATABASE_URL\s*=\s*"?([^"\n]+)"?/m.exec(env)?.[1];
  } catch {
    return undefined;
  }
}
const url = process.env.DATABASE_URL ?? urlDesdeEnvDeLaApi();
if (!url) {
  console.error('Falta DATABASE_URL');
  process.exit(1);
}

const cliente = new pg.Client({ connectionString: url });
await cliente.connect();
try {
  await cliente.query(`CREATE TABLE IF NOT EXISTS public.migracion_aplicada (
    version    text PRIMARY KEY,
    archivo    text NOT NULL,
    checksum   text NOT NULL,
    aplicada_en timestamptz NOT NULL DEFAULT now())`);
  const { rows } = await cliente.query('SELECT version, checksum FROM public.migracion_aplicada');
  const aplicadas = new Map(rows.map((r) => [r.version, r.checksum]));

  const dir = join(raiz, 'migraciones');
  const archivos = readdirSync(dir).filter((f) => /^V\d{3}__.+\.sql$/.test(f)).sort();
  let nuevas = 0;
  for (const archivo of archivos) {
    const version = archivo.slice(0, 4);
    const sql = readFileSync(join(dir, archivo), 'utf8');
    const checksum = createHash('sha256').update(sql).digest('hex');
    if (aplicadas.has(version)) {
      if (aplicadas.get(version) !== checksum) {
        throw new Error(`La migración ${archivo} cambió después de aplicarse. Cree una migración nueva.`);
      }
      continue;
    }
    await cliente.query('BEGIN');
    try {
      await cliente.query(sql);
      await cliente.query(
        'INSERT INTO public.migracion_aplicada (version, archivo, checksum) VALUES ($1, $2, $3)',
        [version, archivo, checksum],
      );
      await cliente.query('COMMIT');
      console.log(`✔ ${archivo}`);
      nuevas++;
    } catch (e) {
      await cliente.query('ROLLBACK');
      throw new Error(`${archivo}: ${e.message}`);
    }
  }
  console.log(nuevas ? `${nuevas} migración(es) aplicada(s)` : 'Base de datos al día');

  const cargar = async (sub) => {
    const dirSem = join(raiz, sub);
    for (const archivo of readdirSync(dirSem).filter((f) => f.endsWith('.sql')).sort()) {
      await cliente.query(readFileSync(join(dirSem, archivo), 'utf8'));
      console.log(`✔ ${sub}/${archivo}`);
    }
  };
  if (process.argv.includes('--semillas') || process.argv.includes('--demo')) await cargar('semillas');
  // Datos de demostración: solo desarrollo y pruebas, nunca producción
  if (process.argv.includes('--demo')) await cargar('semillas/demo');
} catch (e) {
  console.error(`✘ ${e.message}`);
  process.exitCode = 1;
} finally {
  await cliente.end();
}
