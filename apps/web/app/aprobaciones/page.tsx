'use client';
import { useCallback, useEffect, useState } from 'react';
import { Encabezado } from '../Encabezado';
import { api } from '@/lib/api';

interface Pendiente {
  id: string; inicio: string; fin: string; motivo: string; asistentes: number;
  sala: { codigo: string }; solicitante: { nombre: string; rol: string };
}

/** Bandeja de aprobación (R4). Un 409 indica que otra reserva ya se aprobó en ese horario. */
export default function Aprobaciones() {
  const [items, setItems] = useState<Pendiente[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const cargar = useCallback(() => api<Pendiente[]>('/reservas/pendientes').then(setItems).catch((e) => setMsg({ ok: false, texto: e.message })), []);
  useEffect(() => { cargar(); }, [cargar]);

  async function decidir(id: string, accion: 'aprobar' | 'rechazar') {
    try {
      await api(`/reservas/${id}/${accion}`, { method: 'POST', body: '{}' });
      setMsg({ ok: true, texto: accion === 'aprobar' ? 'Reserva aprobada' : 'Reserva rechazada' });
    } catch (e) {
      setMsg({ ok: false, texto: (e as Error).message });
    }
    cargar();
  }

  return (
    <>
      <Encabezado />
      <main>
        <section className="card">
          <h2>Solicitudes pendientes</h2>
          {msg && <p className={msg.ok ? 'ok' : 'error'}>{msg.texto}</p>}
          {items.length === 0 ? <p>No hay solicitudes pendientes.</p> : (
            <table>
              <thead><tr><th>Sala</th><th>Fecha</th><th>Solicitante</th><th>Motivo</th><th>Asist.</th><th></th></tr></thead>
              <tbody>{items.map((r) => (
                <tr key={r.id}>
                  <td>{r.sala.codigo}</td>
                  <td>{new Date(r.inicio).toLocaleString('es-CL')} – {new Date(r.fin).toLocaleTimeString('es-CL')}</td>
                  <td>{r.solicitante.nombre} ({r.solicitante.rol})</td><td>{r.motivo}</td><td>{r.asistentes}</td>
                  <td style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => decidir(r.id, 'aprobar')}>Aprobar</button>
                    <button className="sec" onClick={() => decidir(r.id, 'rechazar')}>Rechazar</button>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </section>
      </main>
    </>
  );
}
