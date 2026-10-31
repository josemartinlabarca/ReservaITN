import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { expect } from 'vitest';

export type Cliente = pg.PoolClient;

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 });

/** Ejecuta la prueba dentro de una transacción que siempre se revierte. */
export async function enTransaccion(fn: (c: Cliente) => Promise<void>) {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    await fn(c);
  } finally {
    await c.query('ROLLBACK');
    c.release();
  }
}

export const cerrar = () => pool.end();

/** Valor de la primera columna de la primera fila. */
export async function uno<T = string>(c: Cliente, sql: string, params: unknown[] = []): Promise<T> {
  const { rows } = await c.query(sql, params);
  return Object.values(rows[0])[0] as T;
}

/**
 * Afirma que la sentencia es rechazada por la base de datos. `motivo` se compara con el nombre
 * de la restricción violada o, si no hay restricción (triggers, NOT NULL), con el mensaje.
 */
export async function rechaza(c: Cliente, sql: string, params: unknown[], motivo: string | RegExp) {
  await c.query('SAVEPOINT prueba');
  let error: (Error & { constraint?: string }) | null = null;
  try {
    await c.query(sql, params);
  } catch (e) {
    error = e as Error & { constraint?: string };
  }
  await c.query('ROLLBACK TO SAVEPOINT prueba');
  expect(error, `se esperaba un rechazo por ${motivo}`).not.toBeNull();
  const texto = `${error!.constraint ?? ''} ${error!.message}`;
  if (typeof motivo === 'string') expect(texto).toContain(motivo);
  else expect(texto).toMatch(motivo);
}

/** Afirma que la sentencia se acepta. */
export async function acepta(c: Cliente, sql: string, params: unknown[] = []) {
  await c.query(sql, params);
}

// Sufijo aleatorio de largo fijo: cumple los formatos de código y documento (≥ 4 caracteres)
const sufijo = () => randomUUID().slice(0, 8).toUpperCase();

/** Datos mínimos para probar: sede, edificio, dos espacios, carrera, oferta, período y usuarios. */
export async function mundo(c: Cliente) {
  const s = sufijo();
  const institucion = await uno(c, 'SELECT id FROM institucion.institucion');
  const sede = await uno(c, `INSERT INTO institucion.sede (institucion_id, codigo, nombre) VALUES ($1, $2, 'Sede prueba') RETURNING id`, [institucion, `S-${s}`]);
  const edificio = await uno(c, `INSERT INTO institucion.edificio (sede_id, codigo, nombre) VALUES ($1, 'A', 'Edificio A') RETURNING id`, [sede]);
  const tipoSala = await uno(c, `SELECT id FROM institucion.tipo_espacio WHERE codigo = 'SALA'`);
  const tipoLab = await uno(c, `SELECT id FROM institucion.tipo_espacio WHERE codigo = 'LABORATORIO'`);
  const sala = await uno(c, `INSERT INTO institucion.espacio (edificio_id, tipo_espacio_id, codigo, nombre, capacidad) VALUES ($1, $2, 'A-101', 'Sala A-101', 30) RETURNING id`, [edificio, tipoSala]);
  const lab = await uno(c, `INSERT INTO institucion.espacio (edificio_id, tipo_espacio_id, codigo, nombre, capacidad) VALUES ($1, $2, 'LAB-1', 'Laboratorio 1', 20) RETURNING id`, [edificio, tipoLab]);
  const carrera = await uno(c, `INSERT INTO academico.carrera (codigo, nombre) VALUES ($1, 'Informática') RETURNING id`, [`INF-${s}`]);
  const oferta = await uno(c, `INSERT INTO academico.oferta_carrera (carrera_id, sede_id, jornada) VALUES ($1, $2, 'DIURNA') RETURNING id`, [carrera, sede]);

  const usuario = async (nombre: string, pasaporte: string) => {
    const persona = await uno(c, `INSERT INTO seguridad.persona (tipo_documento, numero_documento, nombres, apellido_paterno) VALUES ('PAS', $1, $2, 'Prueba') RETURNING id`, [pasaporte, nombre]);
    const id = await uno(c, `INSERT INTO seguridad.usuario (persona_id, password_hash) VALUES ($1, 'hash-secreto') RETURNING id`, [persona]);
    return { persona, id };
  };
  const docente = await usuario('Docente', `D${s}`);
  const director = await usuario('Director', `R${s}`);
  const clase = await uno(c, `SELECT id FROM reservas.tipo_actividad WHERE codigo = 'CLASE'`);
  return { institucion, sede, edificio, sala, lab, carrera, oferta, docente, director, clase, tipoSala };
}

/** Crea una solicitud del docente y devuelve su id. */
export async function solicitud(c: Cliente, m: Awaited<ReturnType<typeof mundo>>) {
  return uno(c, `INSERT INTO reservas.solicitud (solicitante_usuario_id, tipo_actividad_id, descripcion, asistentes)
                 VALUES ($1, $2, 'Clase de prueba', 20) RETURNING id`, [m.docente.id, m.clase]);
}

/** Inserta una reserva; por defecto pendiente con plazo de 1 día. */
export async function reserva(
  c: Cliente,
  solicitudId: string,
  espacio: string,
  inicio: string,
  fin: string,
  estado = 'PENDIENTE',
) {
  return uno(c, `INSERT INTO reservas.reserva (solicitud_id, espacio_id, inicio, fin, estado, expira_en)
                 VALUES ($1, $2, $3, $4, $5::reservas.estado_reserva,
                         CASE WHEN $5::text = 'PENDIENTE' THEN now() + interval '1 day' END) RETURNING id`,
    [solicitudId, espacio, inicio, fin, estado]);
}

/** Asigna un rol vigente (con ámbito opcional de carrera o sede). */
export async function asignarRol(c: Cliente, usuarioId: string, rol: string, ambito: { carrera?: string; sede?: string } = {}) {
  await c.query(`INSERT INTO seguridad.usuario_rol (usuario_id, rol_id, carrera_id, sede_id)
                 SELECT $1, id, $3, $4 FROM seguridad.rol WHERE codigo = $2`,
    [usuarioId, rol, ambito.carrera ?? null, ambito.sede ?? null]);
}

/** Crea un usuario adicional con los roles indicados. */
export async function usuarioCon(c: Cliente, roles: [string, { carrera?: string; sede?: string }?][]) {
  const s = randomUUID().slice(0, 8).toUpperCase();
  const persona = await uno(c, `INSERT INTO seguridad.persona (tipo_documento, numero_documento, nombres, apellido_paterno)
                                VALUES ('PAS', $1, 'Usuario', 'Prueba') RETURNING id`, [`U${s}`]);
  const id = await uno(c, 'INSERT INTO seguridad.usuario (persona_id) VALUES ($1) RETURNING id', [persona]);
  for (const [rol, ambito] of roles) await asignarRol(c, id, rol, ambito);
  return id;
}
