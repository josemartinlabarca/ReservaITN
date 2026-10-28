import type { Intervalo } from './choques';

/** Índice de ocupación y proyección por jornada (R12, R14 / E9, E10). */
export type Jornada = 'MANANA' | 'TARDE' | 'VESPERTINA';

export function jornadaDe(fecha: Date): Jornada {
  const h = fecha.getHours();
  if (h < 13) return 'MANANA';
  if (h < 18) return 'TARDE';
  return 'VESPERTINA';
}

/** Horas que ocupan las reservas dentro del rango, recortando lo que cae fuera. */
export function horasOcupadas(reservas: Intervalo[], rango: Intervalo): number {
  let ms = 0;
  for (const r of reservas) {
    const ini = Math.max(r.inicio.getTime(), rango.inicio.getTime());
    const fin = Math.min(r.fin.getTime(), rango.fin.getTime());
    if (fin > ini) ms += fin - ini;
  }
  return ms / 3_600_000;
}

/**
 * Índice de ocupación = horas reservadas ÷ horas disponibles (indicador B3).
 * `horasDisponibles` se calcula fuera (días hábiles × horario institucional × salas).
 */
export function indiceOcupacion(horasReservadas: number, horasDisponibles: number): number {
  if (horasDisponibles <= 0) return 0;
  return Math.min(1, horasReservadas / horasDisponibles);
}

/** Distribución de horas ocupadas por día de la semana y jornada (base de la proyección de uso). */
export function distribucionPorJornada(
  reservas: Intervalo[],
): Record<number, Record<Jornada, number>> {
  const out: Record<number, Record<Jornada, number>> = {};
  for (const r of reservas) {
    const dia = r.inicio.getDay();
    out[dia] ??= { MANANA: 0, TARDE: 0, VESPERTINA: 0 };
    out[dia][jornadaDe(r.inicio)] += (r.fin.getTime() - r.inicio.getTime()) / 3_600_000;
  }
  return out;
}
