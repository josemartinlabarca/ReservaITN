'use client';
import { Cargando, EstadoBadge, Modal, useDatos } from './ui';
import { fecha, fechaHora, rangoHora } from '@/lib/formato';
import type { EstadoReserva } from '@reservaitn/shared';

interface Paso { momento: string; accion: string; actor: string | null; comentario: string | null }
interface Traza { estado: EstadoReserva; espacio: string; linea: Paso[] }

const TITULO: Record<string, string> = {
  CREADA: 'Solicitud creada',
  APROBADA: 'Aprobada',
  RECHAZADA: 'Rechazada',
  CHECK_IN: 'Check-in registrado',
  CANCELADA: 'Cancelada',
  EXPIRADA: 'Expiró sin decisión',
  LIBERADA: 'Liberada por no presentarse',
};

/** Historial de una reserva (trazabilidad R7): quién la creó, aprobó, rechazó, usó o canceló. */
export function HistorialModal({ reserva, onCerrar }: { reserva: { id: string; codigo: string; inicio: string; fin: string }; onCerrar: () => void }) {
  const h = useDatos<Traza>(`/reservas/${reserva.id}/historial`);
  return (
    <Modal titulo={`Trazabilidad · ${reserva.codigo}`} onCerrar={onCerrar}>
      <p className="muted" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {fecha(reserva.inicio)} · {rangoHora(reserva.inicio, reserva.fin)}
        {h.datos && <EstadoBadge estado={h.datos.estado} />}
      </p>
      {h.error && <div className="alerta error">{h.error}</div>}
      {!h.datos ? !h.error && <Cargando /> : (
        <ul className="timeline">
          {h.datos.linea.map((p, i) => (
            <li key={i}>
              <strong>{TITULO[p.accion] ?? p.accion}</strong>
              <small>{p.actor ? `${p.actor} · ` : ''}{fechaHora(p.momento)}</small>
              {p.comentario && <small>{p.accion === 'CHECK_IN' ? `Método: ${p.comentario}` : `“${p.comentario}”`}</small>}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
