import { describe, expect, it } from 'vitest';
import { expandirSemanal, normalizarEncabezado } from './planificacion';
import { rankingJornadas } from './ocupacion';

describe('expandirSemanal', () => {
  const fila = {
    codigoSala: 'A-101', asignatura: 'Redes', diaSemana: 2,
    horaInicio: '08:30', horaFin: '10:00', inscritos: 30,
  };

  it('genera una reserva por cada martes del rango', () => {
    // 02/03/2027 es martes; hasta el 30/03/2027 hay 5 martes
    const r = expandirSemanal(fila, new Date(2027, 2, 1), new Date(2027, 2, 31));
    expect(r).toHaveLength(5);
    expect(r[0].inicio).toEqual(new Date(2027, 2, 2, 8, 30));
    expect(r[0].fin).toEqual(new Date(2027, 2, 2, 10, 0));
    expect(r.every((x) => x.inicio.getDay() === 2)).toBe(true);
  });

  it('no genera nada si el rango no contiene ese día', () => {
    expect(expandirSemanal(fila, new Date(2027, 2, 3), new Date(2027, 2, 6))).toHaveLength(0);
  });
});

describe('normalizarEncabezado', () => {
  it('quita tildes, espacios y mayúsculas', () => {
    expect(normalizarEncabezado('Código Sala')).toBe('codigosala');
    expect(normalizarEncabezado('Hora Término')).toBe('horatermino');
  });
});

describe('rankingJornadas', () => {
  it('ordena de mayor a menor y deja en 0 los bloques sin uso', () => {
    const r = rankingJornadas([
      { inicio: new Date(2027, 2, 2, 9), fin: new Date(2027, 2, 2, 12) }, // martes mañana 3 h
      { inicio: new Date(2027, 2, 3, 19), fin: new Date(2027, 2, 3, 20) }, // miércoles vespertina 1 h
    ]);
    expect(r).toHaveLength(18);
    expect(r[0]).toEqual({ dia: 'Martes', jornada: 'MANANA', horas: 3 });
    expect(r[1]).toEqual({ dia: 'Miércoles', jornada: 'VESPERTINA', horas: 1 });
    expect(r.at(-1)!.horas).toBe(0);
  });
});
