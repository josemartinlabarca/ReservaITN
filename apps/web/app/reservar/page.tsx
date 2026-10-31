'use client';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { HORARIO, reservaCreateSchema } from '@reservaitn/shared';
import { Encabezado } from '../Encabezado';
import { api } from '@/lib/api';

interface Espacio {
  id: string;
  codigo: string;
  nombre: string;
  capacidad: number;
  tipo_espacio: { codigo: string; nombre: string };
  edificio: { nombre: string; sede: { id: string; nombre: string } };
}
interface TipoActividad { codigo: string; nombre: string }
interface Ocupacion {
  id: string;
  inicio: string;
  fin: string;
  estado: 'PENDIENTE' | 'APROBADA';
  solicitud: { descripcion: string; tipo_actividad: { codigo: string } };
}
interface Sugerencia { espacio: Espacio; esperaMin: number }
interface MiReserva {
  id: string;
  inicio: string;
  fin: string;
  estado: string;
  expira_en: string | null;
  espacio: { codigo: string; nombre: string };
  solicitud: { id: string; descripcion: string };
  cancelacion: { motivo: string | null } | null;
}
interface SolicitudCreada { reserva: { estado: string; inicio: string }[] }

const hora = (d: string | Date) => new Date(d).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
const fechaHora = (d: string) =>
  new Date(d).toLocaleString('es-CL', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const manana = () => {
  const d = new Date(Date.now() + 86_400_000);
  if (d.getDay() === 0) d.setDate(d.getDate() + 1); // no se reserva en domingo
  return d.toLocaleDateString('sv-SE');
};
const ESTADOS: Record<string, string> = {
  PENDIENTE: 'Pendiente de aprobación',
  APROBADA: 'Aprobada',
  RECHAZADA: 'Rechazada',
  CANCELADA: 'Cancelada',
  EXPIRADA: 'Expiró sin respuesta',
  LIBERADA: 'Liberada (sin check-in)',
};

/**
 * Solicitud de reservas desde la web (R2, R3, R10, D13). Precisión al minuto: el día, la hora y
 * los minutos de inicio y de término son libres, dentro del horario institucional.
 * Valida con el mismo esquema que la API (packages/shared) antes de enviar.
 */
export default function Reservar() {
  const [espacios, setEspacios] = useState<Espacio[]>([]);
  const [actividades, setActividades] = useState<TipoActividad[]>([]);
  const [form, setForm] = useState({
    fecha: manana(),
    desde: '08:55',
    hasta: '10:10',
    espacioId: '',
    tipoActividad: 'CLASE',
    descripcion: '',
    asistentes: '20',
    semanal: false,
    repetirHasta: '',
  });
  const [ocupado, setOcupado] = useState<Ocupacion[]>([]);
  const [sugerencias, setSugerencias] = useState<Sugerencia[] | null>(null);
  const [mias, setMias] = useState<MiReserva[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [version, setVersion] = useState(0); // fuerza recargar la ocupación tras reservar o cancelar
  // Tras reservar, el formulario coincide con la reserva recién creada: no avisar choque hasta que se edite
  const [recienReservado, setRecienReservado] = useState(false);

  const cambiar = (campo: keyof typeof form, valor: string | boolean) => {
    setRecienReservado(false);
    setMsg(null);
    setForm((f) => ({ ...f, [campo]: valor }));
  };

  // Horas en hora local del navegador (Chile): la API recibe la fecha con su zona horaria
  const inicio = useMemo(() => new Date(`${form.fecha}T${form.desde}`), [form.fecha, form.desde]);
  const fin = useMemo(() => new Date(`${form.fecha}T${form.hasta}`), [form.fecha, form.hasta]);
  const espacio = espacios.find((e) => e.id === form.espacioId);

  const cargarMias = useCallback(() => api<MiReserva[]>('/reservas/mias').then(setMias).catch(() => setMias([])), []);

  // Llegada desde el calendario: /reservar?espacioId=…&fecha=…&desde=…&hasta=…
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const desdeUrl = Object.fromEntries(['espacioId', 'fecha', 'desde', 'hasta'].flatMap((k) => (p.get(k) ? [[k, p.get(k)!]] : [])));
    if (Object.keys(desdeUrl).length) setForm((f) => ({ ...f, ...desdeUrl }));
  }, []);

  useEffect(() => {
    api<Espacio[]>('/espacios').then(setEspacios).catch((e) => setMsg({ ok: false, texto: e.message }));
    api<{ tiposActividad: TipoActividad[] }>('/catalogos').then((c) => setActividades(c.tiposActividad));
    cargarMias();
  }, [cargarMias]);

  // Lo que ya está tomado ese día en el espacio elegido
  useEffect(() => {
    if (!form.espacioId || !form.fecha) return setOcupado([]);
    const desde = new Date(`${form.fecha}T00:00`);
    const hasta = new Date(desde.getTime() + 86_400_000);
    api<Ocupacion[]>(`/reservas/ocupacion?desde=${desde.toISOString()}&hasta=${hasta.toISOString()}&espacioId=${form.espacioId}`)
      .then(setOcupado)
      .catch(() => setOcupado([]));
  }, [form.espacioId, form.fecha, version]);

  const choca = !recienReservado && ocupado.some((o) => new Date(o.inicio) < fin && inicio < new Date(o.fin));
  const propias = new Set(mias.map((r) => r.id));

  function datos() {
    return {
      espacioId: form.espacioId,
      inicio,
      fin,
      tipoActividad: form.tipoActividad,
      descripcion: form.descripcion,
      asistentes: Number(form.asistentes),
      ...(form.semanal && form.repetirHasta ? { repetirHasta: form.repetirHasta } : {}),
    };
  }

  async function sugerir() {
    setMsg(null);
    try {
      const r = await api<{ sugerida: Sugerencia | null; alternativas: Sugerencia[] }>('/sugerencia', {
        method: 'POST',
        body: JSON.stringify({ inicio, fin, asistentes: Number(form.asistentes) }),
      });
      const opciones = [...(r.sugerida ? [r.sugerida] : []), ...r.alternativas];
      setSugerencias(opciones);
      if (!opciones.length) setMsg({ ok: false, texto: 'No hay espacios libres para ese horario y cantidad de personas' });
    } catch (e) {
      setMsg({ ok: false, texto: (e as Error).message });
    }
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    const v = reservaCreateSchema().safeParse(datos());
    if (!v.success) {
      setMsg({ ok: false, texto: [...new Set(v.error.issues.map((i) => i.message))].join(' · ') });
      return;
    }
    if (form.semanal && !form.repetirHasta) {
      setMsg({ ok: false, texto: 'Indique hasta qué fecha se repite' });
      return;
    }
    setEnviando(true);
    try {
      const r = await api<SolicitudCreada>('/reservas', { method: 'POST', body: JSON.stringify(datos()) });
      const n = r.reserva.length;
      const estado = r.reserva[0]?.estado;
      setMsg({
        ok: true,
        texto:
          estado === 'APROBADA'
            ? `Reserva confirmada${n > 1 ? ` (${n} fechas)` : ''}.`
            : `Solicitud enviada${n > 1 ? ` (${n} fechas)` : ''}. El horario queda bloqueado mientras se aprueba.`,
      });
      setSugerencias(null);
      setForm((f) => ({ ...f, descripcion: '' }));
      setRecienReservado(true);
      cargarMias();
      setVersion((v) => v + 1);
    } catch (err) {
      setMsg({ ok: false, texto: (err as Error).message });
    } finally {
      setEnviando(false);
    }
  }

  async function cancelar(id: string) {
    if (!window.confirm('¿Cancelar esta reserva?')) return;
    try {
      await api(`/reservas/${id}/cancelar`, { method: 'POST', body: '{}' });
      cargarMias();
      setVersion((v) => v + 1);
    } catch (e) {
      setMsg({ ok: false, texto: (e as Error).message });
    }
  }

  return (
    <>
      <Encabezado />
      <main style={{ display: 'grid', gap: '1rem' }}>
        <form className="card" onSubmit={enviar} style={{ display: 'grid', gap: '1rem' }}>
          <h2 style={{ margin: 0 }}>Nueva reserva</h2>

          <div className="campos">
            <label>Día<input type="date" value={form.fecha} min={new Date().toLocaleDateString('sv-SE')} onChange={(e) => cambiar('fecha', e.target.value)} required /></label>
            <label>Desde (hora y minutos)<input type="time" step={60} value={form.desde} onChange={(e) => cambiar('desde', e.target.value)} required /></label>
            <label>Hasta (hora y minutos)<input type="time" step={60} value={form.hasta} onChange={(e) => cambiar('hasta', e.target.value)} required /></label>
            <label>Asistentes<input type="number" min={1} value={form.asistentes} onChange={(e) => cambiar('asistentes', e.target.value)} required /></label>
          </div>
          <p className="etiqueta" style={{ margin: 0 }}>
            Horario de {HORARIO.aperturaHora}:00 a {HORARIO.cierreHora}:00, de lunes a sábado. Duración mínima {HORARIO.duracionMinMin} minutos.
          </p>

          <div className="campos">
            <label style={{ gridColumn: 'span 2' }}>
              Espacio
              <select value={form.espacioId} onChange={(e) => cambiar('espacioId', e.target.value)} required>
                <option value="">Elegir…</option>
                {espacios.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.codigo} · {e.nombre} · {e.edificio.sede.nombre} · {e.capacidad} personas
                  </option>
                ))}
              </select>
            </label>
            <label>
              Actividad
              <select value={form.tipoActividad} onChange={(e) => cambiar('tipoActividad', e.target.value)}>
                {actividades.filter((a) => a.codigo !== 'MANTENCION').map((a) => (
                  <option key={a.codigo} value={a.codigo}>{a.nombre}</option>
                ))}
              </select>
            </label>
            <div style={{ display: 'flex', alignItems: 'end' }}>
              <button type="button" className="sec" onClick={sugerir}>Sugerir espacio libre</button>
            </div>
          </div>

          {sugerencias && sugerencias.length > 0 && (
            <div>
              <p className="etiqueta">Espacios disponibles para ese horario (clic para elegir):</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {sugerencias.map((s, i) => (
                  <button
                    type="button"
                    key={s.espacio.id}
                    className={form.espacioId === s.espacio.id ? '' : 'sec'}
                    onClick={() => cambiar('espacioId', s.espacio.id)}
                  >
                    {i === 0 && s.esperaMin === 0 ? '★ ' : ''}
                    {s.espacio.codigo} ({s.espacio.capacidad})
                    {s.esperaMin > 0 ? ` · libre en ${s.esperaMin} min` : ''}
                  </button>
                ))}
              </div>
            </div>
          )}

          {espacio && (
            <div>
              <p className="etiqueta" style={{ marginTop: 0 }}>
                Ocupación de {espacio.codigo} el {new Date(`${form.fecha}T12:00`).toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })}:
              </p>
              {ocupado.length === 0 ? (
                <p className="ok" style={{ margin: 0 }}>Libre todo el día.</p>
              ) : (
                <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                  {ocupado.map((o) => (
                    <li key={o.id}>
                      {hora(o.inicio)}–{hora(o.fin)} · {o.solicitud.descripcion}
                      {o.estado === 'PENDIENTE' ? ' (pendiente)' : ''}
                      {propias.has(o.id) ? ' · suya' : ''}
                    </li>
                  ))}
                </ul>
              )}
              {choca && <p className="error">El horario elegido se cruza con una reserva existente.</p>}
            </div>
          )}

          <label>
            Motivo
            <input value={form.descripcion} onChange={(e) => cambiar('descripcion', e.target.value)} placeholder="Ej. clase de recuperación de Redes" required />
          </label>

          <div className="campos">
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--text)' }}>
              <input type="checkbox" checked={form.semanal} onChange={(e) => cambiar('semanal', e.target.checked)} />
              Repetir cada semana (mismo día y horario)
            </label>
            {form.semanal && (
              <label>Hasta el día<input type="date" value={form.repetirHasta} min={form.fecha} onChange={(e) => cambiar('repetirHasta', e.target.value)} /></label>
            )}
          </div>

          {msg && <p className={msg.ok ? 'ok' : 'error'} style={{ margin: 0 }}>{msg.texto}</p>}
          <div>
            <button type="submit" disabled={enviando || choca}>
              {enviando ? 'Enviando…' : `Reservar ${form.desde}–${form.hasta}`}
            </button>
          </div>
        </form>

        <section className="card">
          <h2>Mis reservas</h2>
          {mias.length === 0 ? (
            <p>No tiene reservas próximas.</p>
          ) : (
            <table>
              <thead>
                <tr><th>Fecha y hora</th><th>Término</th><th>Espacio</th><th>Motivo</th><th>Estado</th><th></th></tr>
              </thead>
              <tbody>
                {mias.map((r) => (
                  <tr key={r.id}>
                    <td>{fechaHora(r.inicio)}</td>
                    <td>{hora(r.fin)}</td>
                    <td>{r.espacio.codigo}</td>
                    <td>{r.solicitud.descripcion}</td>
                    <td>
                      <span className={`estado estado-${r.estado}`}>{ESTADOS[r.estado] ?? r.estado}</span>
                      {r.cancelacion?.motivo && <div className="etiqueta">Motivo: {r.cancelacion.motivo}</div>}
                    </td>
                    <td>
                      {(r.estado === 'PENDIENTE' || r.estado === 'APROBADA') && new Date(r.fin) > new Date() && (
                        <button className="sec" onClick={() => cancelar(r.id)}>Cancelar</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </main>
    </>
  );
}
