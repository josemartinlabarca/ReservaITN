'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ConPermiso, usePanel } from '@/components/Panel';
import { HistorialModal } from '@/components/Historial';
import { Cabecera, Cargando, EstadoBadge, Icono, Modal, Vacio, useAviso, useDatos } from '@/components/ui';
import { enviar, mensajeError } from '@/lib/api';
import { ORIGEN, fecha, rangoHora } from '@/lib/formato';
import { MOTIVO_MINIMO } from '@reservaitn/shared';
import type { ReservaPropia } from '@/lib/tipos';

type Vista = 'proximas' | 'pasadas' | 'todas';

/** Reservas propias con filtro por período, check-in, cancelación con motivo e historial (R5, R7, R18). */
function MisReservas() {
  const avisar = useAviso();
  const { refrescarContadores } = usePanel();
  const { datos, error, recargar } = useDatos<ReservaPropia[]>('/reservas/mias');
  const [vista, setVista] = useState<Vista>('proximas');
  const [historial, setHistorial] = useState<ReservaPropia | null>(null);
  const [cancelar, setCancelar] = useState<ReservaPropia | null>(null);
  const [motivo, setMotivo] = useState('');

  const ahora = Date.now();
  const lista = (datos ?? [])
    .filter((r) => vista === 'todas' || (vista === 'proximas' ? new Date(r.fin).getTime() > ahora : new Date(r.fin).getTime() <= ahora))
    .sort((a, b) => (vista === 'proximas' ? a.inicio.localeCompare(b.inicio) : b.inicio.localeCompare(a.inicio)));
  const cuenta = (e: string) => (datos ?? []).filter((r) => r.estado === e && new Date(r.fin).getTime() > ahora).length;

  async function confirmarCancelacion() {
    if (!cancelar) return;
    try {
      await enviar(`/reservas/${cancelar.id}/cancelar`, { motivo: motivo.trim() || undefined });
      avisar('Reserva cancelada');
      setCancelar(null);
      setMotivo('');
      recargar();
      refrescarContadores();
    } catch (e) {
      avisar(mensajeError(e), true);
    }
  }

  return (
    <>
      <Cabecera miga="Reservas" titulo="Mis reservas" sub="Revisa el estado de tus solicitudes, cancela las que ya no necesites y consulta su historial.">
        <Link href="/reservar" className="btn acento"><Icono n="mas" />Nueva reserva</Link>
      </Cabecera>

      <section className="grid">
        <div className="card kpi destacado"><span className="etiqueta">Próximas aprobadas</span><span className="valor">{cuenta('APROBADA')}</span></div>
        <div className="card kpi"><span className="etiqueta">Esperando aprobación</span><span className="valor">{cuenta('PENDIENTE')}</span></div>
        <div className="card kpi"><span className="etiqueta">Total de solicitudes</span><span className="valor">{datos?.length ?? '—'}</span></div>
      </section>

      <section className="card">
        <div className="card-head">
          <div className="segmentado">
            {(['proximas', 'pasadas', 'todas'] as const).map((v) => (
              <button key={v} className={vista === v ? 'activo' : ''} onClick={() => setVista(v)}>
                {v === 'proximas' ? 'Próximas' : v === 'pasadas' ? 'Pasadas' : 'Todas'}
              </button>
            ))}
          </div>
        </div>
        {error && <div className="alerta error"><Icono n="alerta" />{error}</div>}
        {!datos ? <Cargando /> : lista.length === 0 ? (
          <Vacio titulo={vista === 'proximas' ? 'No tienes reservas próximas' : 'Sin reservas en esta vista'}>
            <Link href="/reservar">Reservar una sala</Link>
          </Vacio>
        ) : (
          <div className="tabla-wrap">
            <table>
              <thead><tr><th>Sala</th><th>Fecha</th><th>Horario</th><th>Motivo</th><th>Asist.</th><th>Estado</th><th /></tr></thead>
              <tbody>
                {lista.map((r) => {
                  const cancelable = (r.estado === 'PENDIENTE' || r.estado === 'APROBADA') && new Date(r.inicio).getTime() > ahora;
                  return (
                    <tr key={r.id}>
                      <td><strong>{r.espacio.codigo}</strong><div className="muted chico">{r.espacio.nombre} · {r.espacio.edificio.sede.nombre}</div></td>
                      <td>{fecha(r.inicio)}</td>
                      <td className="tnum">{rangoHora(r.inicio, r.fin)}</td>
                      <td>{r.solicitud.descripcion}{r.solicitud.origen !== 'SOLICITUD' && <div className="muted chico">{ORIGEN[r.solicitud.origen]}</div>}{r.cancelacion?.motivo && <div className="muted chico">Cancelada: “{r.cancelacion.motivo}”</div>}</td>
                      <td className="tnum">{r.solicitud.asistentes}</td>
                      <td><EstadoBadge estado={r.estado} />{r.check_in && <div className="muted chico">Check-in ✓</div>}</td>
                      <td className="acciones-celda">
                        <button className="fantasma chico" onClick={() => setHistorial(r)} title="Ver historial"><Icono n="historial" t={16} />Historial</button>
                        {cancelable && <button className="sec chico" onClick={() => setCancelar(r)}>Cancelar</button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {historial && <HistorialModal reserva={{ ...historial, codigo: historial.espacio.codigo }} onCerrar={() => setHistorial(null)} />}
      {cancelar && (
        <Modal titulo="Cancelar reserva" onCerrar={() => setCancelar(null)}
          pie={<><button className="sec" onClick={() => setCancelar(null)}>Volver</button><button className="peligro" onClick={confirmarCancelacion}>Cancelar reserva</button></>}>
          <p>Se liberará <strong>{cancelar.espacio.codigo}</strong> el {fecha(cancelar.inicio)}, {rangoHora(cancelar.inicio, cancelar.fin)}.</p>
          <label>Motivo (opcional; si lo escribe, mínimo {MOTIVO_MINIMO} caracteres)<textarea maxLength={300} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></label>
        </Modal>
      )}
    </>
  );
}

export default function Pagina() {
  return <ConPermiso permiso="reserva:solicitar"><MisReservas /></ConPermiso>;
}
