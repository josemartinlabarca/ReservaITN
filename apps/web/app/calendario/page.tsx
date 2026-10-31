'use client';
import { useEffect, useMemo, useState, type MouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import { HORARIO } from '@reservaitn/shared';
import { Encabezado } from '../Encabezado';
import { api, sesion } from '@/lib/api';

interface Espacio {
  id: string;
  codigo: string;
  nombre: string;
  capacidad: number;
  edificio: { sede: { nombre: string } };
}
interface Ocupacion {
  id: string;
  inicio: string;
  fin: string;
  estado: 'PENDIENTE' | 'APROBADA';
  solicitud: { descripcion: string; origen: string; tipo_actividad: { codigo: string } };
}

const PX_POR_MINUTO = 0.9; // 15 h × 60 min × 0,9 = 810 px de alto
const INICIO_MIN = HORARIO.aperturaHora * 60;
const FIN_MIN = HORARIO.cierreHora * 60;
const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const lunesDe = (d: Date) => {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  r.setDate(r.getDate() - ((r.getDay() + 6) % 7));
  return r;
};
const sumarDias = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const dia = (d: Date) => d.toLocaleDateString('sv-SE');
const minutosDelDia = (d: Date) => d.getHours() * 60 + d.getMinutes();
const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

/**
 * Calendario semanal de un espacio (R3): lunes a sábado, en el horario institucional, con cada
 * reserva en su posición exacta al minuto. Clic en un hueco libre → formulario de reserva con el
 * espacio, el día y la hora ya puestos.
 */
export default function Calendario() {
  const router = useRouter();
  const [espacios, setEspacios] = useState<Espacio[]>([]);
  const [espacioId, setEspacioId] = useState('');
  const [lunes, setLunes] = useState(() => lunesDe(new Date()));
  const [ocupaciones, setOcupaciones] = useState<Ocupacion[]>([]);
  const [seleccion, setSeleccion] = useState<Ocupacion | null>(null);
  const puedeReservar = sesion()?.usuario.permisos.includes('reserva:solicitar') ?? false;

  useEffect(() => {
    api<Espacio[]>('/espacios').then((e) => {
      setEspacios(e);
      const desdeUrl = new URLSearchParams(window.location.search).get('espacioId');
      setEspacioId(desdeUrl && e.some((x) => x.id === desdeUrl) ? desdeUrl : (e[0]?.id ?? ''));
    });
  }, []);

  useEffect(() => {
    if (!espacioId) return;
    const desde = lunes.toISOString();
    const hasta = sumarDias(lunes, 7).toISOString();
    api<Ocupacion[]>(`/reservas/ocupacion?desde=${desde}&hasta=${hasta}&espacioId=${espacioId}`)
      .then(setOcupaciones)
      .catch(() => setOcupaciones([]));
    setSeleccion(null);
  }, [espacioId, lunes]);

  const dias = useMemo(() => DIAS.map((nombre, i) => ({ nombre, fecha: sumarDias(lunes, i) })), [lunes]);
  const hoy = dia(new Date());
  const espacio = espacios.find((e) => e.id === espacioId);
  const alto = (FIN_MIN - INICIO_MIN) * PX_POR_MINUTO;

  function clicEnDia(e: MouseEvent<HTMLDivElement>, fecha: Date) {
    if (!puedeReservar || e.target !== e.currentTarget) return; // solo sobre el fondo libre
    const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
    const minuto = Math.floor((INICIO_MIN + y / PX_POR_MINUTO) / 15) * 15; // al cuarto de hora
    const desde = Math.min(minuto, FIN_MIN - 60);
    const inicio = new Date(`${dia(fecha)}T${hhmm(desde)}`);
    if (inicio < new Date()) return;
    const q = new URLSearchParams({ espacioId, fecha: dia(fecha), desde: hhmm(desde), hasta: hhmm(desde + 60) });
    router.push(`/reservar?${q}`);
  }

  return (
    <>
      <Encabezado />
      <main style={{ display: 'grid', gap: '1rem' }}>
        <section className="card" style={{ display: 'grid', gap: '0.75rem' }}>
          <div className="fila-controles">
            <label style={{ flex: '1 1 280px' }}>
              Espacio
              <select value={espacioId} onChange={(e) => setEspacioId(e.target.value)}>
                {espacios.map((e) => (
                  <option key={e.id} value={e.id}>{e.codigo} · {e.nombre} · {e.edificio.sede.nombre} · {e.capacidad} personas</option>
                ))}
              </select>
            </label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'end' }}>
              <button className="sec" onClick={() => setLunes(sumarDias(lunes, -7))} aria-label="Semana anterior">←</button>
              <button className="sec" onClick={() => setLunes(lunesDe(new Date()))}>Hoy</button>
              <button className="sec" onClick={() => setLunes(sumarDias(lunes, 7))} aria-label="Semana siguiente">→</button>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <strong>
              Semana del {lunes.toLocaleDateString('es-CL', { day: 'numeric', month: 'long' })} al{' '}
              {sumarDias(lunes, 5).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })}
            </strong>
            <span className="leyenda">
              <span className="evento-APROBADA muestra" /> Aprobada
              <span className="evento-PENDIENTE muestra" /> Pendiente
              <span className="evento-PLANIFICACION muestra" /> Clase planificada
            </span>
          </div>
          {puedeReservar && <p className="etiqueta" style={{ margin: 0 }}>Haz clic en un espacio libre para reservar ese horario.</p>}

          <div className="calendario-scroll">
            <div className="calendario" style={{ gridTemplateColumns: `56px repeat(${dias.length}, minmax(110px, 1fr))` }}>
              <div />
              {dias.map((d) => (
                <div key={d.nombre} className={`cal-cabecera ${dia(d.fecha) === hoy ? 'cal-hoy' : ''}`}>
                  {d.nombre} {d.fecha.getDate()}/{d.fecha.getMonth() + 1}
                </div>
              ))}
              <div className="cal-horas" style={{ height: alto }}>
                {Array.from({ length: HORARIO.cierreHora - HORARIO.aperturaHora }, (_, i) => (
                  <span key={i} style={{ top: i * 60 * PX_POR_MINUTO }}>{hhmm(INICIO_MIN + i * 60)}</span>
                ))}
              </div>
              {dias.map((d) => {
                const delDia = ocupaciones.filter((o) => dia(new Date(o.inicio)) === dia(d.fecha));
                return (
                  <div
                    key={d.nombre}
                    className={`cal-dia ${puedeReservar ? 'cal-clic' : ''}`}
                    style={{ height: alto, backgroundSize: `100% ${60 * PX_POR_MINUTO}px` }}
                    onClick={(e) => clicEnDia(e, d.fecha)}
                  >
                    {delDia.map((o) => {
                      const ini = Math.max(minutosDelDia(new Date(o.inicio)), INICIO_MIN);
                      const fin = Math.min(minutosDelDia(new Date(o.fin)), FIN_MIN);
                      const clase = o.solicitud.origen === 'PLANIFICACION' ? 'PLANIFICACION' : o.estado;
                      return (
                        // div con rol de botón: un <button> centra el texto verticalmente; aquí va arriba
                        <div
                          key={o.id}
                          role="button"
                          tabIndex={0}
                          className={`cal-evento evento-${clase}`}
                          style={{ top: (ini - INICIO_MIN) * PX_POR_MINUTO, height: Math.max((fin - ini) * PX_POR_MINUTO, 18) }}
                          onClick={() => setSeleccion(o)}
                          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setSeleccion(o)}
                          title={`${hhmm(ini)}–${hhmm(fin)} · ${o.solicitud.descripcion}`}
                        >
                          <strong>{hhmm(ini)}–{hhmm(fin)}</strong> {o.solicitud.descripcion}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {seleccion && espacio && (
          <section className="card">
            <h2 style={{ marginTop: 0 }}>{seleccion.solicitud.descripcion}</h2>
            <p style={{ margin: 0 }}>
              {espacio.codigo} ·{' '}
              {new Date(seleccion.inicio).toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })} ·{' '}
              {hhmm(minutosDelDia(new Date(seleccion.inicio)))}–{hhmm(minutosDelDia(new Date(seleccion.fin)))} ·{' '}
              <span className={`estado estado-${seleccion.estado}`}>{seleccion.estado === 'APROBADA' ? 'Aprobada' : 'Pendiente'}</span>
              {seleccion.solicitud.origen === 'PLANIFICACION' && ' · Clase de la planificación semestral'}
            </p>
          </section>
        )}
      </main>
    </>
  );
}
