import { describe, expect, it } from 'vitest';
import { rutValido } from './validaciones';
import { reservaCreateSchema, filaPlanificacionSchema, usuarioCreateSchema } from './schemas';

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
    espacioId: '7d6f1f2a-3c1e-4f7a-9a43-2c9f7f3b9e10',
    descripcion: 'Clase de recuperación',
    asistentes: 25,
  };

  it('acepta una reserva válida y usa CLASE como actividad por defecto', () => {
    const r = schema.safeParse({ ...base, inicio: '2026-11-03T10:00:00', fin: '2026-11-03T11:30:00' });
    expect(r.success && r.data.tipoActividad).toBe('CLASE');
  });

  it('valida el fin de una serie semanal', () => {
    const fechas = { inicio: '2026-11-03T10:00:00', fin: '2026-11-03T11:30:00' };
    expect(schema.safeParse({ ...base, ...fechas, repetirHasta: '2026-12-15' }).success).toBe(true);
    expect(schema.safeParse({ ...base, ...fechas, repetirHasta: '2026-11-01' }).success).toBe(false);
    expect(schema.safeParse({ ...base, ...fechas, repetirHasta: '2027-12-01' }).success).toBe(false);
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

describe('usuarioCreateSchema', () => {
  const base = { nombres: 'Ana', apellidoPaterno: 'Rojas', email: 'ANA@ITN.CL', roles: [{ rol: 'DOCENTE' }] };
  it('normaliza el RUT y el correo', () => {
    const r = usuarioCreateSchema.parse({ ...base, tipoDocumento: 'RUT', numeroDocumento: '12.345.678-5' });
    expect(r.numeroDocumento).toBe('12345678-5');
    expect(r.email).toBe('ana@itn.cl');
  });
  it('rechaza un RUT inválido, pero no valida pasaportes', () => {
    expect(usuarioCreateSchema.safeParse({ ...base, tipoDocumento: 'RUT', numeroDocumento: '12345678-9' }).success).toBe(false);
    expect(usuarioCreateSchema.safeParse({ ...base, tipoDocumento: 'PAS', numeroDocumento: 'X123456' }).success).toBe(true);
  });
  it('exige al menos un rol', () => {
    expect(usuarioCreateSchema.safeParse({ ...base, roles: [], tipoDocumento: 'PAS', numeroDocumento: 'X1234' }).success).toBe(false);
  });
});

describe('mensajes en español', () => {
  it('traduce los errores genéricos de Zod', async () => {
    const { reservaCreateSchema: esquema } = await import('./index');
    const r = esquema().safeParse({ asistentes: 'muchos' });
    const mensajes = r.success ? [] : r.error.issues.map((i) => `${i.path[0]}: ${i.message}`);
    expect(mensajes).toContain('espacioId: Campo obligatorio');
    expect(mensajes).toContain('asistentes: Debe ser un número');
  });
});
