import type { EstadoReserva } from '../schemas';
import { tienePermiso, type Rol } from '../roles';

/** Máquina de estados de una reserva (R4, R5, R18). */
export type AccionReserva = 'APROBAR' | 'RECHAZAR' | 'CANCELAR' | 'LIBERAR';

const TRANSICIONES: Record<AccionReserva, { desde: EstadoReserva[]; hacia: EstadoReserva }> = {
  APROBAR: { desde: ['PENDIENTE'], hacia: 'APROBADA' },
  RECHAZAR: { desde: ['PENDIENTE'], hacia: 'RECHAZADA' },
  CANCELAR: { desde: ['PENDIENTE', 'APROBADA'], hacia: 'CANCELADA' },
  LIBERAR: { desde: ['APROBADA'], hacia: 'LIBERADA' },
};

export function siguienteEstado(actual: EstadoReserva, accion: AccionReserva): EstadoReserva | null {
  const t = TRANSICIONES[accion];
  return t.desde.includes(actual) ? t.hacia : null;
}

export interface ContextoAprobacion {
  rolActor: Rol;
  carreraActor: string | null;
  carreraSolicitante: string | null;
  carreraExclusivaSala: string | null;
}

/**
 * Quién aprueba (R4, R8, R11): dirección académica y Subdirección, cualquier reserva;
 * director de carrera, solo las de su carrera (solicitante o laboratorio exclusivo).
 */
export function puedeAprobar(c: ContextoAprobacion): boolean {
  if (!tienePermiso(c.rolActor, 'reserva:aprobar')) return false;
  if (c.rolActor !== 'DIRECTOR_CARRERA') return true;
  return (
    c.carreraActor !== null &&
    (c.carreraActor === c.carreraSolicitante || c.carreraActor === c.carreraExclusivaSala)
  );
}
