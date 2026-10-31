'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { Encabezado } from '../Encabezado';
import { api, descargar, sesion } from '@/lib/api';
import { DialogoMotivo } from '../DialogoMotivo';

interface FilaSala { espacioId: string; codigo: string; nombre: string; sede: string; tipo: string; horasReservadas: number; indice: number }
interface Ocupacion {
  indiceGlobal: number;
  totalReservas: number;
  porEspacio: FilaSala[];
}
interface Bloque { dia: string; jornada: 'MANANA' | 'TARDE' | 'VESPERTINA'; horas: number }
interface Proyeccion { mayorUso: Bloque[]; menorUso: Bloque[] }
interface Indicadores { pendientes: number; B6_tiempoPromedioAprobacionHoras: number | null; B3_reservasNoUsadas: number }
interface OcupSala { id: string; inicio: string; fin: string; estado: string; solicitud: { descripcion: string; origen: string } }
interface ReservaPeriodo {
  reservaId: string;
  inicio: string;
  fin: string;
  estado: string;
  espacio: string;
  tipoActividad: string;
  origen: string;
  asistentes: number;
  descripcion: string;
  solicitante: string;
  aprobador: string | null;
  aprobacionAutomatica: boolean;
  canceladoPor: string | null;
  motivoCancelacion: string | null;
}

const JORNADA = { MANANA: 'mañana', TARDE: 'tarde', VESPERTINA: 'vespertina' } as const;
const pct = (n: number) => `${(n * 100).toFixed(1)} %`;
/** Fecha calendario local (no UTC): a las 22:00 en Chile, toISOString ya sería el día siguiente. */
const dia = (d: Date) => d.toLocaleDateString('sv-SE');
const sumarDias = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
/**
 * El rango se elige por días completos en hora local: "hasta 10/11" incluye todo el 10 de noviembre.
 * Se envía a la API como instantes con zona horaria (no como medianoche UTC).
 */
const consulta = (r: { desde: string; hasta: string }) => {
  const desde = new Date(`${r.desde}T00:00`);
  const hasta = sumarDias(new Date(`${r.hasta}T00:00`), 1);
  return `desde=${encodeURIComponent(desde.toISOString())}&hasta=${encodeURIComponent(hasta.toISOString())}`;
};
const RANGOS: [string, () => { desde: string; hasta: string }][] = [
  ['Próximos 30 días', () => ({ desde: dia(new Date()), hasta: dia(sumarDias(new Date(), 30)) })],
  ['Este mes', () => {
    const h = new Date();
    return { desde: dia(new Date(h.getFullYear(), h.getMonth(), 1)), hasta: dia(new Date(h.getFullYear(), h.getMonth() + 1, 0)) };
  }],
  ['Últimos 30 días', () => ({ desde: dia(sumarDias(new Date(), -30)), hasta: dia(new Date()) })],
];
const ESTADO: Record<string, string> = {
  PENDIENTE: 'Pendiente', APROBADA: 'Aprobada', RECHAZADA: 'Rechazada',
  CANCELADA: 'Cancelada', EXPIRADA: 'Expirada', LIBERADA: 'Liberada',
};
const fechaCorta = (d: string) => new Date(d).toLocaleString('es-CL', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const horaCorta = (d: string) => new Date(d).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });

/** Dashboard de ocupación (R12, WBS 1.4.7), reporte desde–hasta (R13) y proyección de uso (R14, WBS 1.4.8). */
export default function Dashboard() {
  // Por defecto, del inicio del mes actual al fin del mes siguiente: incluye lo ya ocurrido y lo agendado
  const [rango, setRango] = useState(() => {
    const h = new Date();
    return { desde: dia(new Date(h.getFullYear(), h.getMonth(), 1)), hasta: dia(new Date(h.getFullYear(), h.getMonth() + 2, 0)) };
  });
  const [reservas, setReservas] = useState<ReservaPeriodo[]>([]);
  const [soloActivas, setSoloActivas] = useState(true);
  const [aCancelar, setACancelar] = useState<ReservaPeriodo | null>(null);
  const [version, setVersion] = useState(0);
  const [aviso, setAviso] = useState('');
  const permisos = sesion()?.usuario.permisos ?? [];
  const puedeCancelar = permisos.includes('reserva:cancelar_cualquiera');
  const puedeExportar = permisos.includes('reporte:generar');
  const [datos, setDatos] = useState<Ocupacion | null>(null);
  const [ind, setInd] = useState<Indicadores | null>(null);
  const [proy, setProy] = useState<Proyeccion | null>(null);
  const [detalle, setDetalle] = useState<{ sala: FilaSala; reservas: OcupSala[] } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    // Sin permiso de dashboard (docentes, estudiantes): a la página de reservas
    if (!sesion()?.usuario.permisos.includes('dashboard:ver')) {
      window.location.replace('/reservar');
      return;
    }
    const q = consulta(rango);
    Promise.all([
      api<Ocupacion>(`/dashboard/ocupacion?${q}`),
      api<Indicadores>(`/dashboard/indicadores?${q}`),
      api<Proyeccion>(`/proyeccion?${q}`),
      api<ReservaPeriodo[]>(`/dashboard/reservas?${q}`),
    ])
      .then(([o, i, p, r]) => { setDatos(o); setInd(i); setProy(p); setReservas(r); setError(''); })
      .catch((e) => setError(e.message));
  }, [rango, version]);

  async function exportarExcel() {
    setAviso('Generando Excel…');
    try {
      await descargar(`/dashboard/reporte.xlsx?${consulta(rango)}`, `ReservaITN_Reporte_${rango.desde}_al_${rango.hasta}.xlsx`);
      setAviso('');
    } catch (e) {
      setAviso('');
      setError((e as Error).message);
    }
  }

  async function cancelar(r: ReservaPeriodo, motivo: string) {
    await api(`/reservas/${r.reservaId}/cancelar`, { method: 'POST', body: JSON.stringify({ motivo }) });
    setACancelar(null);
    setAviso(`Reserva de ${r.espacio} cancelada. Se avisó a ${r.solicitante}.`);
    setVersion((v) => v + 1);
  }

  async function verSala(sala: FilaSala) {
    const delEspacio = await api<OcupSala[]>(`/reservas/ocupacion?${consulta(rango)}&espacioId=${sala.espacioId}`);
    setDetalle({ sala, reservas: delEspacio });
  }

  function aplicar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setRango({ desde: String(f.get('desde')), hasta: String(f.get('hasta')) });
    setDetalle(null);
  }

  return (
    <>
      <Encabezado />
      <main style={{ display: 'grid', gap: '1rem' }}>
        <form className="fila" onSubmit={aplicar} key={`${rango.desde}-${rango.hasta}`}>
          <label>Desde<input type="date" name="desde" defaultValue={rango.desde} /></label>
          <label>Hasta (incluido)<input type="date" name="hasta" defaultValue={rango.hasta} /></label>
          <button type="submit">Generar reporte</button>
          {puedeExportar && (
            <button type="button" onClick={exportarExcel} title="Descarga el reporte del período en Excel">
              ⬇ Descargar Excel
            </button>
          )}
          {RANGOS.map(([nombre, calcular]) => (
            <button type="button" className="sec" key={nombre} onClick={() => { setRango(calcular()); setDetalle(null); }}>
              {nombre}
            </button>
          ))}
        </form>
        {error && <p className="error">{error}</p>}
        {aviso && <p className="ok">{aviso}</p>}
        {datos && ind && (
          <>
            <section className="grid">
              <div className="card kpi"><div className="etiqueta">Índice de ocupación</div><div className="valor">{pct(datos.indiceGlobal)}</div></div>
              <div className="card kpi"><div className="etiqueta">Reservas aprobadas</div><div className="valor">{datos.totalReservas}</div></div>
              <div className="card kpi"><div className="etiqueta">Pendientes de aprobación</div><div className="valor">{ind.pendientes}</div></div>
              <div className="card kpi"><div className="etiqueta">Tiempo medio de aprobación</div><div className="valor">{ind.B6_tiempoPromedioAprobacionHoras === null ? '—' : `${ind.B6_tiempoPromedioAprobacionHoras.toFixed(1)} h`}</div></div>
            </section>

            <section className="card">
              <h2>Ocupación por sala</h2>
              <p className="etiqueta" style={{ marginTop: 0 }}>Horas de reservas aprobadas sobre las horas disponibles del período. Clic en una sala para ver su detalle.</p>
              <table>
                <thead><tr><th>Sala</th><th>Sede</th><th>Tipo</th><th>Horas</th><th>Ocupación</th><th></th></tr></thead>
                <tbody>
                  {datos.porEspacio.map((s) => (
                    <tr key={s.espacioId} className="click" onClick={() => verSala(s)}>
                      <td>{s.codigo}</td><td>{s.sede}</td><td>{s.tipo}</td><td>{s.horasReservadas}</td>
                      <td><div className="barra"><span style={{ width: `${(s.indice * 100).toFixed(1)}%` }} /></div></td>
                      <td>{pct(s.indice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            {detalle && (
              <section className="card">
                <h2>Detalle {detalle.sala.codigo} · {detalle.sala.nombre}</h2>
                {detalle.reservas.length === 0 ? <p>Sin reservas en el período.</p> : (
                  <table>
                    <thead><tr><th>Inicio</th><th>Fin</th><th>Motivo</th><th>Origen</th><th>Estado</th></tr></thead>
                    <tbody>{detalle.reservas.map((r) => (
                      <tr key={r.id}><td>{new Date(r.inicio).toLocaleString('es-CL')}</td><td>{new Date(r.fin).toLocaleTimeString('es-CL')}</td><td>{r.solicitud.descripcion}</td><td>{r.solicitud.origen}</td><td>{r.estado}</td></tr>
                    ))}</tbody>
                  </table>
                )}
              </section>
            )}

            <section className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
                <h2>Reservas del período</h2>
                <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input type="checkbox" checked={soloActivas} onChange={(e) => setSoloActivas(e.target.checked)} />
                  Solo pendientes y aprobadas
                </label>
              </div>
              {(() => {
                const filas = reservas.filter((r) => !soloActivas || r.estado === 'PENDIENTE' || r.estado === 'APROBADA');
                return filas.length === 0 ? (
                  <p>No hay reservas en el período.</p>
                ) : (
                  <table>
                    <thead>
                      <tr><th>Fecha</th><th>Término</th><th>Espacio</th><th>Actividad</th><th>Solicitante</th><th>Estado</th><th>Aprobó</th>{puedeCancelar && <th></th>}</tr>
                    </thead>
                    <tbody>
                      {filas.map((r) => (
                        <tr key={r.reservaId}>
                          <td>{fechaCorta(r.inicio)}</td>
                          <td>{horaCorta(r.fin)}</td>
                          <td>{r.espacio}</td>
                          <td>{r.descripcion}<div className="etiqueta">{r.tipoActividad}{r.origen === 'PLANIFICACION' ? ' · planificación' : ''}</div></td>
                          <td>{r.solicitante}</td>
                          <td>
                            <span className={`estado estado-${r.estado}`}>{ESTADO[r.estado] ?? r.estado}</span>
                            {r.motivoCancelacion && (
                              <div className="etiqueta">Por {r.canceladoPor}: {r.motivoCancelacion}</div>
                            )}
                          </td>
                          <td>{r.aprobacionAutomatica ? 'Automática' : (r.aprobador ?? '—')}</td>
                          {puedeCancelar && (
                            <td>
                              {(r.estado === 'PENDIENTE' || r.estado === 'APROBADA') && new Date(r.fin) > new Date() && (
                                <button className="sec chico" onClick={() => setACancelar(r)}>Cancelar</button>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              })()}
            </section>

            {proy && (
              <section className="grid">
                {([['Jornadas de mayor uso', proy.mayorUso], ['Jornadas de menor uso', proy.menorUso]] as const).map(([titulo, bloques]) => (
                  <div className="card" key={titulo}>
                    <h2>{titulo}</h2>
                    <table>
                      <tbody>{bloques.map((b) => (
                        <tr key={b.dia + b.jornada}><td>{b.dia} {JORNADA[b.jornada]}</td><td>{b.horas.toFixed(1)} h</td></tr>
                      ))}</tbody>
                    </table>
                  </div>
                ))}
              </section>
            )}
          </>
        )}
      </main>
      {aCancelar && (
        <DialogoMotivo
          titulo="Cancelar reserva"
          detalle={`${aCancelar.espacio} · ${fechaCorta(aCancelar.inicio)}–${horaCorta(aCancelar.fin)} · ${aCancelar.descripcion} (${aCancelar.solicitante})`}
          accion="Cancelar reserva"
          onConfirmar={(motivo) => cancelar(aCancelar, motivo)}
          onCerrar={() => setACancelar(null)}
        />
      )}
    </>
  );
}
