'use client';
import { useState } from 'react';
import { MOTIVO_MINIMO } from '@reservaitn/shared';

/**
 * Cuadro para pedir un motivo obligatorio (cancelar la reserva de otra persona).
 * El motivo lo recibe el solicitante y queda en la trazabilidad (reservas.cancelacion).
 */
export function DialogoMotivo({
  titulo,
  detalle,
  accion,
  onConfirmar,
  onCerrar,
}: {
  titulo: string;
  detalle: string;
  accion: string;
  onConfirmar: (motivo: string) => Promise<void>;
  onCerrar: () => void;
}) {
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const valido = motivo.trim().length >= MOTIVO_MINIMO;

  async function confirmar() {
    setEnviando(true);
    setError('');
    try {
      await onConfirmar(motivo.trim());
    } catch (e) {
      setError((e as Error).message);
      setEnviando(false);
    }
  }

  return (
    <div className="dialogo-fondo" role="dialog" aria-modal="true" onClick={onCerrar}>
      <div className="card dialogo" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ marginTop: 0 }}>{titulo}</h2>
        <p style={{ marginTop: 0 }}>{detalle}</p>
        <label>
          Motivo (obligatorio, lo recibirá el solicitante)
          <textarea
            rows={3}
            autoFocus
            value={motivo}
            maxLength={300}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ej. la sala se usará para un evento institucional"
          />
        </label>
        <p className="etiqueta" style={{ margin: '4px 0 0' }}>
          {valido ? `${motivo.trim().length}/300` : `Mínimo ${MOTIVO_MINIMO} caracteres`}
        </p>
        {error && <p className="error">{error}</p>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: '1rem' }}>
          <button className="sec" onClick={onCerrar}>Volver</button>
          <button className="peligro" disabled={!valido || enviando} onClick={confirmar}>
            {enviando ? 'Cancelando…' : accion}
          </button>
        </div>
      </div>
    </div>
  );
}
