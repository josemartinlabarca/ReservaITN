import { seSolapan, type Intervalo } from './choques';

/** Sugerencia de sala y alternativas (R10 / E7 / WBS 1.4.5). */
export interface SalaCandidata {
  id: string;
  codigo: string;
  sedeId: string;
  capacidad: number;
  equipamiento: string[];
  carreraExclusivaId: string | null;
}

export interface OcupacionSala extends Intervalo {
  salaId: string;
}

export interface SolicitudSugerencia extends Intervalo {
  asistentes: number;
  sedeId?: string;
  equipamientoRequerido?: string[];
  carreraSolicitanteId?: string | null;
}

export interface Sugerencia {
  sala: SalaCandidata;
  /** 0 = libre en el horario pedido; >0 = minutos de espera hasta que se libera. */
  esperaMin: number;
  puntaje: number;
}

const VENTANA_LIBERACION_MIN = 30;

export function sugerirSalas(
  solicitud: SolicitudSugerencia,
  salas: SalaCandidata[],
  ocupaciones: OcupacionSala[],
  maxAlternativas = 3,
): { sugerida: Sugerencia | null; alternativas: Sugerencia[] } {
  const duracion = solicitud.fin.getTime() - solicitud.inicio.getTime();
  const requeridos = solicitud.equipamientoRequerido ?? [];

  const aptas = salas.filter(
    (s) =>
      s.capacidad >= solicitud.asistentes &&
      (!solicitud.sedeId || s.sedeId === solicitud.sedeId) &&
      requeridos.every((e) => s.equipamiento.includes(e)),
  );

  const resultados: Sugerencia[] = [];
  for (const sala of aptas) {
    const ocup = ocupaciones.filter((o) => o.salaId === sala.id);
    const espera = minutosHastaLibre(solicitud, duracion, ocup);
    if (espera === null) continue;
    resultados.push({ sala, esperaMin: espera, puntaje: puntuar(sala, solicitud, espera) });
  }
  resultados.sort((a, b) => b.puntaje - a.puntaje);

  const libres = resultados.filter((r) => r.esperaMin === 0);
  const sugerida = libres[0] ?? null;
  const alternativas = resultados.filter((r) => r !== sugerida).slice(0, maxAlternativas);
  return { sugerida, alternativas };
}

/** Busca, en pasos de 5 min, si la sala queda libre dentro de la ventana de 30 min. */
function minutosHastaLibre(
  sol: Intervalo,
  duracionMs: number,
  ocup: Intervalo[],
): number | null {
  for (let m = 0; m <= VENTANA_LIBERACION_MIN; m += 5) {
    const inicio = new Date(sol.inicio.getTime() + m * 60_000);
    const fin = new Date(inicio.getTime() + duracionMs);
    if (!ocup.some((o) => seSolapan({ inicio, fin }, o))) return m;
  }
  return null;
}

function puntuar(sala: SalaCandidata, sol: SolicitudSugerencia, espera: number): number {
  // Preferir: ajuste de capacidad (no desperdiciar salas grandes), sin espera,
  // y laboratorios de la propia carrera; penalizar labs exclusivos de otra carrera (préstamo, R8).
  const holgura = (sala.capacidad - sol.asistentes) / sala.capacidad; // 0..1
  let p = 100 - holgura * 50 - espera;
  if (sala.carreraExclusivaId) {
    p += sala.carreraExclusivaId === sol.carreraSolicitanteId ? 10 : -20;
  }
  return Math.round(p * 100) / 100;
}
