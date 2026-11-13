'use client';
import { useState, type FormEvent } from 'react';
import { ConPermiso } from '@/components/Panel';
import { Badge, Cabecera, Cargando, Icono, Vacio, useAviso, useDatos } from '@/components/ui';
import { api, mensajeError } from '@/lib/api';
import { descargarCsv, fecha, fechaHora, pct } from '@/lib/formato';

interface Resultado { totalFilas: number; filasOk: number; reservasCreadas: number; porcentajeOk: number; errores: { fila: number; columna: string | null; mensaje: string }[] }
interface Carga { id: string; archivo_nombre: string; total_filas: number; filas_ok: number; proporcion_ok: number; creado_en: string; periodo: string; responsable: string }
interface Periodo { id: string; codigo: string; nombre: string; fecha_inicio: string; fecha_fin: string }

const COLUMNAS = [
  ['Código sala', 'LAB-INF-1', 'Debe existir en Salas y laboratorios'],
  ['Asignatura', 'Programación I', 'Será el motivo de la reserva'],
  ['Día', '2', '1 = lunes … 6 = sábado'],
  ['Hora inicio', '08:30', 'Formato HH:MM'],
  ['Hora fin', '10:00', 'Formato HH:MM'],
  ['Inscritos', '32', 'Número de estudiantes'],
  ['RUT docente', '12.345.678-5', 'Opcional; debe ser un usuario del sistema'],
];

/** Importación de la planificación semestral desde Excel (R9 / E5 / WBS 1.4.3). Criterio E5: ≥ 98 % importado. */
function Importacion() {
  const avisar = useAviso();
  const historial = useDatos<Carga[]>('/importaciones');
  const catalogos = useDatos<{ periodos: Periodo[] }>('/catalogos');
  const periodos = catalogos.datos?.periodos ?? [];
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [error, setError] = useState('');
  const [subiendo, setSubiendo] = useState(false);
  const [archivo, setArchivo] = useState<string>('');

  async function importar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setSubiendo(true);
    try {
      const r = await api<Resultado>('/importaciones', { method: 'POST', body: new FormData(e.currentTarget) });
      setResultado(r);
      avisar(`${r.reservasCreadas} reservas creadas desde ${r.filasOk} filas`);
      historial.recargar();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setSubiendo(false);
    }
  }

  const cumple = resultado && resultado.porcentajeOk >= 0.98;

  return (
    <>
      <Cabecera miga="Gestión" titulo="Importar planificación"
        sub="Carga el Excel del semestre: cada fila genera una reserva semanal aprobada durante todo el período, sin días no hábiles. Las filas con errores o choques se informan sin detener el resto." />

      <div className="grid-lateral">
        <form className="card" onSubmit={importar} style={{ display: 'grid', gap: '1rem' }}>
          <h2>Nueva carga</h2>
          <label className="campo" style={{ border: '2px dashed var(--border-strong)', borderRadius: 'var(--radius)', padding: '1.5rem', textAlign: 'center', cursor: 'pointer', background: 'var(--surface-2)' }}>
            <span style={{ display: 'grid', placeItems: 'center', gap: 6 }}>
              <span className="avatar" style={{ width: 46, height: 46, background: 'var(--accent-soft)', color: 'var(--accent)' }}><Icono n="archivo" t={22} /></span>
              <strong style={{ color: 'var(--text)' }}>{archivo || 'Selecciona el archivo .xlsx'}</strong>
              <span className="ayuda">Primera hoja del libro, fila 1 con encabezados. Máximo 10 MB.</span>
            </span>
            <input type="file" name="archivo" required accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              style={{ display: 'none' }} onChange={(e) => setArchivo(e.target.files?.[0]?.name ?? '')} />
          </label>
          <label>Período académico
            <select name="periodo" required>
              {periodos.map((p) => <option key={p.id} value={p.codigo}>{p.nombre} ({fecha(p.fecha_inicio)} – {fecha(p.fecha_fin)})</option>)}
            </select>
          </label>
          {catalogos.datos && !periodos.length && <div className="alerta info"><Icono n="alerta" />No hay períodos abiertos: créelos antes de importar.</div>}
          {error && <div className="alerta error"><Icono n="alerta" />{error}</div>}
          <div><button type="submit" className="acento" disabled={subiendo}><Icono n="subir" />{subiendo ? 'Importando…' : 'Importar planificación'}</button></div>
        </form>

        <aside className="card">
          <h2>Columnas esperadas</h2>
          <div className="tabla-wrap">
            <table>
              <thead><tr><th>Columna</th><th>Ejemplo</th></tr></thead>
              <tbody>{COLUMNAS.map(([c, ej, nota]) => (
                <tr key={c}><td><strong>{c}</strong><div className="muted chico">{nota}</div></td><td className="tnum">{ej}</td></tr>
              ))}</tbody>
            </table>
          </div>
        </aside>
      </div>

      {resultado && (
        <section className="card" style={{ display: 'grid', gap: '1rem' }}>
          <div className="card-head">
            <h2>Resultado de la carga</h2>
            <Badge tono={cumple ? 'ok' : 'warn'}>{cumple ? 'Cumple criterio E5 (≥ 98 %)' : 'Bajo el 98 %: revisar errores'}</Badge>
          </div>
          <div className="grid">
            <div className="kpi"><span className="etiqueta">Filas importadas</span><span className="valor">{pct(resultado.porcentajeOk)}</span><div className="barra"><span style={{ width: `${resultado.porcentajeOk * 100}%` }} /></div></div>
            <div className="kpi"><span className="etiqueta">Filas correctas</span><span className="valor">{resultado.filasOk} / {resultado.totalFilas}</span></div>
            <div className="kpi"><span className="etiqueta">Reservas creadas</span><span className="valor">{resultado.reservasCreadas}</span></div>
          </div>
          {resultado.errores.length > 0 && (
            <>
              <div className="card-head">
                <h3>Filas con observaciones ({resultado.errores.length})</h3>
                <button className="sec chico" onClick={() => descargarCsv('errores_importacion.csv', [['Fila', 'Columna', 'Detalle'], ...resultado.errores.map((x) => [x.fila, x.columna ?? '', x.mensaje])])}>
                  <Icono n="bajar" t={15} />Descargar CSV
                </button>
              </div>
              <div className="tabla-wrap">
                <table>
                  <thead><tr><th style={{ width: 80 }}>Fila</th><th>Columna</th><th>Detalle</th></tr></thead>
                  <tbody>{resultado.errores.map((x, i) => <tr key={i}><td className="tnum">{x.fila}</td><td>{x.columna ?? 'Fila completa'}</td><td>{x.mensaje}</td></tr>)}</tbody>
                </table>
              </div>
            </>
          )}
        </section>
      )}

      <section className="card">
        <h2>Cargas anteriores</h2>
        {!historial.datos ? <Cargando /> : historial.datos.length === 0 ? <Vacio icono="archivo" titulo="Aún no se ha importado ninguna planificación" /> : (
          <div className="tabla-wrap">
            <table>
              <thead><tr><th>Archivo</th><th>Período</th><th>Fecha</th><th>Responsable</th><th>Filas</th><th>Resultado</th></tr></thead>
              <tbody>{historial.datos.map((c) => {
                const p = c.proporcion_ok;
                return (
                  <tr key={c.id}>
                    <td><strong>{c.archivo_nombre}</strong></td><td>{c.periodo}</td><td>{fechaHora(c.creado_en)}</td><td>{c.responsable}</td>
                    <td className="tnum">{c.filas_ok} / {c.total_filas}</td>
                    <td><Badge tono={p >= 0.98 ? 'ok' : 'warn'}>{pct(p)}</Badge></td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

export default function Pagina() {
  return <ConPermiso permiso="planificacion:importar"><Importacion /></ConPermiso>;
}
