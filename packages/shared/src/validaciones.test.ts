import { describe, expect, it } from 'vitest';
import { rutValido } from './validaciones';
import { reservaCreateSchema, filaPlanificacionSchema } from './schemas';

describe('rutValido', () => {
  it.each(['11.111.111-1', '12345678-5', '7654321-6'])('acepta %s', (r) =>
    expect(rutValido(r)).toBe(true),
  );
  it.each(['12345678-9', '1234-5', 'abc', ''])('rechaza %s', (r) =>
    expect(rutValido(r)).toBe(false),
  );
});

describe('reservaCreateSchema', () => {
  const ahora = () => new Date('2026-11-02T08:00:00');
  const schema = reservaCreateSchema(ahora);
  const base = {
    salaId: '7d6f1f2a-3c1e-4f7a-9a43-2c9f7f3b9e10',
    motivo: 'Clase de recuperación',
    asistentes: 25,
  };

  it('acepta una reserva válida', () => {
    const r = schema.safeParse({ ...base, inicio: '2026-11-03T10:00:00', fin: '2026-11-03T11:30:00' });
    expect(r.success).toBe(true);
  });

  it.each([
    ['fin antes del inicio', '2026-11-03T10:00:00', '2026-11-03T09:00:00'],
    ['menos de 30 min', '2026-11-03T10:00:00', '2026-11-03T10:15:00'],
    ['en el pasado', '2026-11-01T10:00:00', '2026-11-01T11:00:00'],
    ['domingo', '2026-11-08T10:00:00', '2026-11-08T11:00:00'],
    ['fuera de horario', '2026-11-03T22:30:00', '2026-11-03T23:30:00'],
    ['más de 6 horas', '2026-11-03T08:00:00', '2026-11-03T15:00:00'],
  ])('rechaza: %s', (_, inicio, fin) => {
    expect(schema.safeParse({ ...base, inicio, fin }).success).toBe(false);
  });
});

describe('filaPlanificacionSchema', () => {
  it('coerciona números del Excel y valida formato de hora', () => {
    const ok = filaPlanificacionSchema.safeParse({
      codigoSala: 'A-101', asignatura: 'Redes', diaSemana: '2',
      horaInicio: '08:30', horaFin: '10:00', inscritos: '30',
    });
    expect(ok.success).toBe(true);
    const mal = filaPlanificacionSchema.safeParse({
      codigoSala: 'A-101', asignatura: 'Redes', diaSemana: 7,
      horaInicio: '8:30', horaFin: '10:00', inscritos: 30,
    });
    expect(mal.success).toBe(false);
  });
});
