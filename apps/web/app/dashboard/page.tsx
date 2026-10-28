'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { Encabezado } from '../Encabezado';
import { api } from '@/lib/api';

interface FilaSala { salaId: string; codigo: string; sede: string; tipo: string; horasReservadas: number; indice: number }
interface Ocupacion {
  indiceGlobal: number;
  totalReservas: number;
  porSala: FilaSala[];
  porDiaYJornada: Record<string, Record<'MANANA' | 'TARDE' | 'VESPERTINA', number>>;
}
interface Indicadores { pendientes: number; B6_tiempoPromedioAprobacionHoras: number | null; B3_reservasNoUsadas: number }
interface OcupSala { id: string; inicio: string; fin: string; motivo: string; origen: string }

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const pct = (n: number) => `${(n * 100).toFixed(1)} %`;
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Dashboard de ocupación (R12), reporte desde–hasta (R13) y uso por jornada (R14). */
export default function Dashboard() {
  const hoy = new Date();
  const [rango, setRango] = useState({ desde: iso(new Date(hoy.getTime() - 30 * 86_400_000)), hasta: iso(hoy) });
  const [datos, setDatos] = useState<Ocupacion | null>(null);
  const [ind, setInd] = useState<Indicadores | null>(null);
  const [detalle, setDetalle] = useState<{ sala: FilaSala; reservas: OcupSala[] } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const q = `desde=${rango.desde}&hasta=${rango.hasta}`;
    Promise.all([api<Ocupacion>(`/dashboard/ocupacion?${q}`), api<Indicadores>(`/dashboard/indicadores?${q}`)])
      .then(([o, i]) => { setDatos(o); setInd(i); setError(''); })
      .catch((e) => setError(e.message));
  }, [rango]);

  async function verSala(sala: FilaSala) {
    const reservas = await api<OcupSala[]>(`/reservas/ocupacion?desde=${rango.desde}&hasta=${rango.hasta}&salaId=${sala.salaId}`);
    setDetalle({ sala, reservas });
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
        <form className="fila" onSubmit={aplicar}>
          <label>Desde<input type="date" name="desde" defaultValue={rango.desde} /></label>
          <label>Hasta<input type="date" name="hasta" defaultValue={rango.hasta} /></label>
          <button type="submit">Generar reporte</button>
        </form>
        {error && <p className="error">{error}</p>}
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
              <table>
                <thead><tr><th>Sala</th><th>Sede</th><th>Tipo</th><th>Horas</th><th>Ocupación</th><th></th></tr></thead>
                <tbody>
                  {datos.porSala.map((s) => (
                    <tr key={s.salaId} className="click" onClick={() => verSala(s)}>
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
                <h2>Detalle {detalle.sala.codigo}</h2>
                {detalle.reservas.length === 0 ? <p>Sin reservas en el período.</p> : (
                  <table>
                    <thead><tr><th>Inicio</th><th>Fin</th><th>Motivo</th><th>Origen</th></tr></thead>
                    <tbody>{detalle.reservas.map((r) => (
                      <tr key={r.id}><td>{new Date(r.inicio).toLocaleString('es-CL')}</td><td>{new Date(r.fin).toLocaleTimeString('es-CL')}</td><td>{r.motivo}</td><td>{r.origen}</td></tr>
                    ))}</tbody>
                  </table>
                )}
              </section>
            )}

            <section className="card">
              <h2>Horas usadas por día y jornada</h2>
              <table>
                <thead><tr><th>Día</th><th>Mañana</th><th>Tarde</th><th>Vespertina</th></tr></thead>
                <tbody>{Object.entries(datos.porDiaYJornada).map(([dia, j]) => (
                  <tr key={dia}><td>{DIAS[Number(dia)]}</td><td>{j.MANANA.toFixed(1)}</td><td>{j.TARDE.toFixed(1)}</td><td>{j.VESPERTINA.toFixed(1)}</td></tr>
                ))}</tbody>
              </table>
            </section>
          </>
        )}
      </main>
    </>
  );
}
