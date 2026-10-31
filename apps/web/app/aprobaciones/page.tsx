'use client';
import { useCallback, useEffect, useState } from 'react';
import { Encabezado } from '../Encabezado';
import { api } from '@/lib/api';

interface Pendiente {
  id: string;
  descripcion: string;
  asistentes: number;
  creado_en: string;
  tipo_actividad: { nombre: string };
  usuario: { persona: { nombres: string; apellido_paterno: string } };
  reserva: { id: string; inicio: string; fin: string; expira_en: string | null; espacio: { codigo: string } }[];
}

const fecha = (d: string) => new Date(d).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' });

/**
 * Bandeja de aprobación (R4, D11). Muestra solo las solicitudes que le corresponden a este usuario
 * según las reglas configuradas. Una serie semanal se decide de una vez (D14).
 */
export default function Aprobaciones() {
  const [items, setItems] = useState<Pendiente[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const cargar = useCallback(
    () => api<Pendiente[]>('/solicitudes/pendientes').then(setItems).catch((e) => setMsg({ ok: false, texto: e.message })),
    [],
  );
  useEffect(() => {
    cargar();
  }, [cargar]);

  async function decidir(id: string, accion: 'aprobar' | 'rechazar') {
    let comentario: string | undefined;
    if (accion === 'rechazar') {
      comentario = window.prompt('Motivo del rechazo (lo recibirá el solicitante):') ?? undefined;
      if (!comentario) return;
    }
    try {
      await api(`/solicitudes/${id}/${accion}`, { method: 'POST', body: JSON.stringify({ comentario }) });
      setMsg({ ok: true, texto: accion === 'aprobar' ? 'Solicitud aprobada' : 'Solicitud rechazada' });
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
          {items.length === 0 ? (
            <p>No hay solicitudes pendientes.</p>
          ) : (
            <table>
              <thead>
                <tr><th>Espacio</th><th>Fecha</th><th>Solicitante</th><th>Actividad</th><th>Asist.</th><th>Vence</th><th></th></tr>
              </thead>
              <tbody>
                {items.map((s) => {
                  const primera = s.reserva[0];
                  return (
                    <tr key={s.id}>
                      <td>{primera.espacio.codigo}</td>
                      <td>
                        {fecha(primera.inicio)} – {new Date(primera.fin).toLocaleTimeString('es-CL', { timeStyle: 'short' })}
                        {s.reserva.length > 1 && <div className="etiqueta">Serie semanal: {s.reserva.length} fechas</div>}
                      </td>
                      <td>{s.usuario.persona.nombres} {s.usuario.persona.apellido_paterno}</td>
                      <td>{s.tipo_actividad.nombre}: {s.descripcion}</td>
                      <td>{s.asistentes}</td>
                      <td>{primera.expira_en ? fecha(primera.expira_en) : '—'}</td>
                      <td style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => decidir(s.id, 'aprobar')}>Aprobar</button>
                        <button className="sec" onClick={() => decidir(s.id, 'rechazar')}>Rechazar</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      </main>
    </>
  );
}
