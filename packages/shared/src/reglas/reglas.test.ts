import { describe, expect, it } from 'vitest';
import { seSolapan, buscarChoques } from './choques';
import { sugerirSalas, type SalaCandidata } from './sugerencia';
import { horasOcupadas, indiceOcupacion, jornadaDe } from './ocupacion';
import { MATRIZ_PERMISOS, tienePermiso } from '../roles';

const d = (h: string) => new Date(`2026-11-03T${h}:00`);

describe('seSolapan', () => {
  it('bordes contiguos no chocan', () => {
    expect(seSolapan({ inicio: d('08:00'), fin: d('10:00') }, { inicio: d('10:00'), fin: d('11:00') })).toBe(false);
  });
  it('solape parcial y contenido chocan', () => {
    expect(seSolapan({ inicio: d('08:00'), fin: d('10:00') }, { inicio: d('09:00'), fin: d('11:00') })).toBe(true);
    expect(seSolapan({ inicio: d('08:00'), fin: d('12:00') }, { inicio: d('09:00'), fin: d('10:00') })).toBe(true);
  });

  // Criterio de aceptación E6: ≥200 casos sin ninguna reserva doble confirmada.
  it('200 casos aleatorios: el filtro nunca deja pasar un choque', () => {
    let semilla = 42;
    const rnd = () => ((semilla = (semilla * 16807) % 2147483647) / 2147483647);
    const confirmadas: { inicio: Date; fin: Date }[] = [];
    for (let i = 0; i < 200; i++) {
      const ini = 8 * 60 + Math.floor(rnd() * 28) * 30; // 08:00–22:00 en bloques de 30 min
      const dur = 30 * (1 + Math.floor(rnd() * 4));
      const nueva = {
        inicio: new Date(Date.UTC(2026, 10, 3, 0, ini)),
        fin: new Date(Date.UTC(2026, 10, 3, 0, ini + dur)),
      };
      if (buscarChoques(nueva, confirmadas).length === 0) confirmadas.push(nueva);
    }
    for (let i = 0; i < confirmadas.length; i++)
      for (let j = i + 1; j < confirmadas.length; j++)
        expect(seSolapan(confirmadas[i], confirmadas[j])).toBe(false);
  });
});

describe('sugerirSalas', () => {
  const sala = (id: string, capacidad: number, extra: Partial<SalaCandidata> = {}): SalaCandidata => ({
    id, codigo: id, sedeId: 'S1', capacidad, equipamiento: [], carreraExclusivaId: null, ...extra,
  });
  const salas = [sala('A', 100), sala('B', 30), sala('C', 35), sala('LAB', 30, { carreraExclusivaId: 'INF' })];

  it('sugiere la sala libre con mejor ajuste de capacidad', () => {
    const r = sugerirSalas({ inicio: d('10:00'), fin: d('11:00'), asistentes: 28 }, salas, []);
    expect(r.sugerida?.sala.id).toBe('B');
    expect(r.alternativas.length).toBeLessThanOrEqual(3);
  });

  it('ofrece como alternativa una sala que se libera en ≤30 min', () => {
    const ocup = [
      { salaId: 'B', inicio: d('09:00'), fin: d('10:20') },
      { salaId: 'C', inicio: d('09:00'), fin: d('12:00') },
      { salaId: 'LAB', inicio: d('09:00'), fin: d('12:00') },
      { salaId: 'A', inicio: d('09:00'), fin: d('12:00') },
    ];
    const r = sugerirSalas({ inicio: d('10:00'), fin: d('11:00'), asistentes: 28 }, salas, ocup);
    expect(r.sugerida).toBeNull();
    expect(r.alternativas[0]).toMatchObject({ sala: { id: 'B' }, esperaMin: 20 });
  });

  it('respeta capacidad y equipamiento requerido', () => {
    const r = sugerirSalas(
      { inicio: d('10:00'), fin: d('11:00'), asistentes: 50, equipamientoRequerido: ['proyector'] },
      [sala('A', 100, { equipamiento: ['proyector'] }), sala('B', 100)],
      [],
    );
    expect(r.sugerida?.sala.id).toBe('A');
    expect(r.alternativas).toHaveLength(0);
  });
});

describe('ocupación', () => {
  it('recorta las horas al rango consultado', () => {
    const h = horasOcupadas([{ inicio: d('07:00'), fin: d('10:00') }], { inicio: d('08:00'), fin: d('23:00') });
    expect(h).toBe(2);
    expect(indiceOcupacion(h, 15)).toBeCloseTo(0.1333, 3);
  });
  it('clasifica jornadas', () => {
    expect(jornadaDe(d('09:00'))).toBe('MANANA');
    expect(jornadaDe(d('15:00'))).toBe('TARDE');
    expect(jornadaDe(d('19:00'))).toBe('VESPERTINA');
  });
});

describe('roles', () => {
  it('solo Subdirección puede cancelar cualquier reserva (R5)', () => {
    const conPermiso = Object.keys(MATRIZ_PERMISOS).filter((r) =>
      tienePermiso(r as keyof typeof MATRIZ_PERMISOS, 'reserva:cancelar_cualquiera'),
    );
    expect(conPermiso).toEqual(['SUBDIRECCION']);
  });
});

import { puedeAprobar, siguienteEstado } from './estados';

describe('estados y aprobación', () => {
  it('no se puede aprobar una reserva ya rechazada', () => {
    expect(siguienteEstado('RECHAZADA', 'APROBAR')).toBeNull();
    expect(siguienteEstado('PENDIENTE', 'APROBAR')).toBe('APROBADA');
    expect(siguienteEstado('APROBADA', 'CANCELAR')).toBe('CANCELADA');
  });
  it('director de carrera solo aprueba lo de su carrera', () => {
    const base = { rolActor: 'DIRECTOR_CARRERA' as const, carreraActor: 'INF', carreraExclusivaSala: null };
    expect(puedeAprobar({ ...base, carreraSolicitante: 'INF' })).toBe(true);
    expect(puedeAprobar({ ...base, carreraSolicitante: 'ENF' })).toBe(false);
    expect(puedeAprobar({ ...base, carreraSolicitante: 'ENF', carreraExclusivaSala: 'INF' })).toBe(true);
    expect(puedeAprobar({ ...base, rolActor: 'DOCENTE', carreraSolicitante: 'INF' })).toBe(false);
  });
});
