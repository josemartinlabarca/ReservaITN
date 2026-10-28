import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';

/**
 * Criterio de aceptación E6: con al menos 200 casos no se confirma ninguna reserva doble.
 * Se prueba la restricción de la base de datos directamente, incluso con aprobaciones concurrentes.
 */
const prisma = new PrismaClient();
let salaId: string;
let usuarioId: string;

beforeAll(async () => {
  const sede = await prisma.sede.create({ data: { nombre: `Sede test ${Date.now()}` } });
  const sala = await prisma.sala.create({
    data: { sedeId: sede.id, codigo: 'T-1', nombre: 'Sala test', tipo: 'SALA', capacidad: 30 },
  });
  const u = await prisma.usuario.create({
    data: { rut: `9${Date.now() % 10_000_000}-0`, email: `t${Date.now()}@itn.cl`, nombre: 'Test', rol: 'SUBDIRECCION', passwordHash: 'x' },
  });
  salaId = sala.id;
  usuarioId = u.id;
});

afterAll(() => prisma.$disconnect());

const reservar = (inicio: Date, fin: Date) =>
  prisma.reserva.create({
    data: { salaId, solicitanteId: usuarioId, inicio, fin, motivo: 'test', asistentes: 1, estado: 'APROBADA' },
  });

describe('restricción reservas_sin_choque', () => {
  it('rechaza un solape y acepta horarios contiguos', async () => {
    const base = new Date('2027-03-01T10:00:00Z');
    const h = (n: number) => new Date(base.getTime() + n * 3_600_000);
    await reservar(h(0), h(2));
    await expect(reservar(h(1), h(3))).rejects.toThrow(/reservas_sin_choque/);
    await expect(reservar(h(2), h(3))).resolves.toBeTruthy();
  });

  it('200 intentos concurrentes: ninguna reserva doble queda aprobada', async () => {
    let semilla = 7;
    const rnd = () => ((semilla = (semilla * 16807) % 2147483647) / 2147483647);
    const dia = new Date('2027-03-02T08:00:00Z').getTime();
    const intentos = Array.from({ length: 200 }, () => {
      const ini = dia + Math.floor(rnd() * 28) * 30 * 60_000;
      return reservar(new Date(ini), new Date(ini + (1 + Math.floor(rnd() * 4)) * 30 * 60_000));
    });
    const resultados = await Promise.allSettled(intentos);
    expect(resultados.some((r) => r.status === 'rejected')).toBe(true);

    const choques = await prisma.$queryRaw<{ n: bigint }[]>`
      SELECT count(*) AS n FROM reservas a JOIN reservas b
        ON a.sala_id = b.sala_id AND a.id < b.id
       AND a.estado = 'APROBADA' AND b.estado = 'APROBADA'
       AND tstzrange(a.inicio, a.fin, '[)') && tstzrange(b.inicio, b.fin, '[)')`;
    expect(Number(choques[0].n)).toBe(0);
  });
});
