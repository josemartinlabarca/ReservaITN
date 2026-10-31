'use client';
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Encabezado } from '../Encabezado';
import { api } from '@/lib/api';

interface Persona { nombres: string; apellido_paterno: string }
interface Danio {
  id: string;
  descripcion: string;
  severidad: 'BAJA' | 'MEDIA' | 'ALTA';
  creado_en: string;
  espacio: { id: string; codigo: string; nombre: string };
  item: { nombre: string } | null;
  usuario: { persona: Persona };
  orden_trabajo: { id: string; estado: string } | null;
}
interface Orden {
  id: string;
  tipo: 'CORRECTIVA' | 'PREVENTIVA';
  prioridad: 'BAJA' | 'MEDIA' | 'ALTA' | 'URGENTE';
  estado: 'ABIERTA' | 'ASIGNADA' | 'EN_PROCESO' | 'RESUELTA' | 'CANCELADA';
  solucion: string | null;
  creado_en: string;
  resuelta_en: string | null;
  espacio: { id: string; codigo: string; nombre: string };
  usuario: { persona: Persona } | null;
  reporte_danio: { id: string; descripcion: string; severidad: string }[];
  solicitud: { reserva: { inicio: string; fin: string; estado: string }[] } | null;
}
interface Personal { id: string; nombre: string }
interface Espacio { id: string; codigo: string; nombre: string }

const ESTADO_ORDEN: Record<Orden['estado'], [string, string]> = {
  ABIERTA: ['Abierta', 'PENDIENTE'],
  ASIGNADA: ['Asignada', 'PENDIENTE'],
  EN_PROCESO: ['En proceso', 'PENDIENTE'],
  RESUELTA: ['Resuelta', 'APROBADA'],
  CANCELADA: ['Cancelada', 'CANCELADA'],
};
const SEVERIDAD: Record<string, string> = { BAJA: 'LIBERADA', MEDIA: 'PENDIENTE', ALTA: 'CANCELADA' };
const fecha = (d: string) => new Date(d).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const nombre = (p: Persona) => `${p.nombres} ${p.apellido_paterno}`;
const hoy = () => new Date().toLocaleDateString('sv-SE');

function Dialogo({ titulo, children, onCerrar }: { titulo: string; children: ReactNode; onCerrar: () => void }) {
  return (
    <div className="dialogo-fondo" role="dialog" aria-modal="true" onClick={onCerrar}>
      <div className="card dialogo dialogo-ancho" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ marginTop: 0 }}>{titulo}</h2>
        {children}
      </div>
    </div>
  );
}

/**
 * Mantención y aseo para el encargado de operaciones (R15, R17 / E12 / WBS 1.4.10):
 * daños reportados → órdenes de trabajo (asignar, en proceso, resolver) y mantención preventiva
 * con bloqueo de la sala, que respeta las reservas existentes igual que cualquier otra reserva.
 */
export default function Mantencion() {
  const [danios, setDanios] = useState<Danio[]>([]);
  const [ordenes, setOrdenes] = useState<Orden[]>([]);
  const [personal, setPersonal] = useState<Personal[]>([]);
  const [espacios, setEspacios] = useState<Espacio[]>([]);
  const [marcados, setMarcados] = useState<string[]>([]);
  const [verCerradas, setVerCerradas] = useState(false);
  const [dialogo, setDialogo] = useState<{ tipo: 'orden'; preventiva: boolean } | { tipo: 'asignar' | 'resolver'; orden: Orden } | null>(null);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);

  const cargar = useCallback(() => {
    api<Danio[]>('/mantencion/danios?sinOrden=true').then(setDanios).catch((e) => setAviso({ ok: false, texto: e.message }));
    api<Orden[]>(`/mantencion/ordenes${verCerradas ? '' : '?abiertas=true'}`).then(setOrdenes);
  }, [verCerradas]);

  useEffect(() => {
    cargar();
  }, [cargar]);
  useEffect(() => {
    api<Personal[]>('/mantencion/personal').then(setPersonal);
    api<Espacio[]>('/espacios').then(setEspacios);
  }, []);

  const marcadosDanios = danios.filter((d) => marcados.includes(d.id));
  const espacioMarcado = marcadosDanios[0]?.espacio;
  const mismoEspacio = marcadosDanios.every((d) => d.espacio.id === espacioMarcado?.id);

  function marcar(d: Danio) {
    setMarcados((m) => (m.includes(d.id) ? m.filter((x) => x !== d.id) : [...m, d.id]));
  }

  async function cambiarEstado(o: Orden, estado: Orden['estado'], extra: Record<string, string> = {}) {
    try {
      await api(`/mantencion/ordenes/${o.id}`, { method: 'PATCH', body: JSON.stringify({ estado, ...extra }) });
      setAviso({ ok: true, texto: `Orden de ${o.espacio.codigo}: ${ESTADO_ORDEN[estado][0].toLowerCase()}.` });
      setDialogo(null);
      cargar();
    } catch (e) {
      setAviso({ ok: false, texto: (e as Error).message });
      throw e;
    }
  }

  return (
    <>
      <Encabezado />
      <main style={{ display: 'grid', gap: '1rem' }}>
        {aviso && <p className={aviso.ok ? 'ok' : 'error'} style={{ margin: 0 }}>{aviso.texto}</p>}

        <section className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
            <h2>Daños reportados sin orden <span className="etiqueta">({danios.length})</span></h2>
            <button disabled={!marcados.length || !mismoEspacio} onClick={() => setDialogo({ tipo: 'orden', preventiva: false })}>
              Crear orden de trabajo{marcados.length ? ` (${marcados.length})` : ''}
            </button>
          </div>
          {!mismoEspacio && <p className="error">Una orden agrupa reportes de un mismo espacio: desmarque los de otros espacios.</p>}
          {danios.length === 0 ? (
            <p>No hay daños pendientes de revisión.</p>
          ) : (
            <div className="tabla-scroll">
              <table>
                <thead><tr><th></th><th>Fecha</th><th>Espacio</th><th>Gravedad</th><th>Descripción</th><th>Reportó</th></tr></thead>
                <tbody>
                  {danios.map((d) => (
                    <tr key={d.id} className="click" onClick={() => marcar(d)}>
                      <td><input type="checkbox" checked={marcados.includes(d.id)} readOnly aria-label="Marcar reporte" /></td>
                      <td>{fecha(d.creado_en)}</td>
                      <td><strong>{d.espacio.codigo}</strong></td>
                      <td><span className={`estado estado-${SEVERIDAD[d.severidad]}`}>{d.severidad.toLowerCase()}</span></td>
                      <td>{d.descripcion}{d.item && <div className="etiqueta">{d.item.nombre}</div>}</td>
                      <td>{nombre(d.usuario.persona)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
            <h2>Órdenes de trabajo</h2>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <label className="check"><input type="checkbox" checked={verCerradas} onChange={(e) => setVerCerradas(e.target.checked)} /> Incluir cerradas</label>
              <button className="sec" onClick={() => setDialogo({ tipo: 'orden', preventiva: true })}>+ Mantención preventiva</button>
            </div>
          </div>
          {ordenes.length === 0 ? (
            <p>No hay órdenes {verCerradas ? '' : 'abiertas'}.</p>
          ) : (
            <div className="tabla-scroll">
              <table>
                <thead><tr><th>Creada</th><th>Espacio</th><th>Tipo</th><th>Prioridad</th><th>Detalle</th><th>Responsable</th><th>Estado</th><th></th></tr></thead>
                <tbody>
                  {ordenes.map((o) => {
                    const bloqueo = o.solicitud?.reserva[0];
                    const abierta = !['RESUELTA', 'CANCELADA'].includes(o.estado);
                    return (
                      <tr key={o.id}>
                        <td>{fecha(o.creado_en)}</td>
                        <td><strong>{o.espacio.codigo}</strong></td>
                        <td>{o.tipo === 'CORRECTIVA' ? 'Reparación' : 'Preventiva'}</td>
                        <td>{o.prioridad.toLowerCase()}</td>
                        <td>
                          {o.reporte_danio.map((r) => <div key={r.id}>{r.descripcion}</div>)}
                          {bloqueo && (
                            <div className="etiqueta">
                              Sala bloqueada {fecha(bloqueo.inicio)}–{new Date(bloqueo.fin).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                              {bloqueo.estado === 'CANCELADA' ? ' (liberada)' : ''}
                            </div>
                          )}
                          {o.solucion && <div className="etiqueta">Solución: {o.solucion}</div>}
                        </td>
                        <td>{o.usuario ? nombre(o.usuario.persona) : '—'}</td>
                        <td><span className={`estado estado-${ESTADO_ORDEN[o.estado][1]}`}>{ESTADO_ORDEN[o.estado][0]}</span></td>
                        <td>
                          {abierta && (
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              <button className="sec chico" onClick={() => setDialogo({ tipo: 'asignar', orden: o })}>{o.usuario ? 'Reasignar' : 'Asignar'}</button>
                              {o.estado === 'ASIGNADA' && <button className="sec chico" onClick={() => cambiarEstado(o, 'EN_PROCESO').catch(() => {})}>En proceso</button>}
                              {o.estado !== 'ABIERTA' && <button className="chico" onClick={() => setDialogo({ tipo: 'resolver', orden: o })}>Resolver</button>}
                              <button className="sec chico" onClick={() => window.confirm('¿Cancelar la orden? Si tenía la sala bloqueada, se libera.') && cambiarEstado(o, 'CANCELADA').catch(() => {})}>Cancelar</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {dialogo?.tipo === 'orden' && (
        <FormOrden
          preventiva={dialogo.preventiva}
          espacio={dialogo.preventiva ? null : (espacioMarcado ?? null)}
          reporteIds={dialogo.preventiva ? [] : marcados}
          espacios={espacios}
          personal={personal}
          onCerrar={() => setDialogo(null)}
          onCreada={(texto) => { setDialogo(null); setMarcados([]); setAviso({ ok: true, texto }); cargar(); }}
        />
      )}
      {dialogo?.tipo === 'asignar' && (
        <DialogoTexto
          titulo={`Asignar orden de ${dialogo.orden.espacio.codigo}`}
          personal={personal}
          onCerrar={() => setDialogo(null)}
          onConfirmar={(asignadaA) => cambiarEstado(dialogo.orden, 'ASIGNADA', { asignadaA })}
        />
      )}
      {dialogo?.tipo === 'resolver' && (
        <DialogoTexto
          titulo={`Resolver orden de ${dialogo.orden.espacio.codigo}`}
          etiqueta="Solución aplicada (queda registrada en la orden)"
          onCerrar={() => setDialogo(null)}
          onConfirmar={(solucion) => cambiarEstado(dialogo.orden, 'RESUELTA', { solucion })}
        />
      )}
    </>
  );
}

/** Pide un responsable (lista) o un texto obligatorio (solución). */
function DialogoTexto({ titulo, etiqueta, personal, onCerrar, onConfirmar }: {
  titulo: string; etiqueta?: string; personal?: Personal[]; onCerrar: () => void; onConfirmar: (valor: string) => Promise<void>;
}) {
  const [valor, setValor] = useState(personal?.[0]?.id ?? '');
  const [error, setError] = useState('');
  return (
    <Dialogo titulo={titulo} onCerrar={onCerrar}>
      {personal ? (
        <label>
          Responsable (recibe un aviso)
          <select value={valor} onChange={(e) => setValor(e.target.value)}>
            {personal.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </label>
      ) : (
        <label>{etiqueta}<textarea rows={3} autoFocus value={valor} onChange={(e) => setValor(e.target.value)} /></label>
      )}
      {error && <p className="error">{error}</p>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: '1rem' }}>
        <button className="sec" onClick={onCerrar}>Volver</button>
        <button disabled={!valor.trim()} onClick={() => onConfirmar(valor.trim()).catch((e) => setError((e as Error).message))}>Confirmar</button>
      </div>
    </Dialogo>
  );
}

function FormOrden({ preventiva, espacio, reporteIds, espacios, personal, onCerrar, onCreada }: {
  preventiva: boolean; espacio: Espacio | null; reporteIds: string[]; espacios: Espacio[]; personal: Personal[];
  onCerrar: () => void; onCreada: (texto: string) => void;
}) {
  const [f, setF] = useState({
    espacioId: espacio?.id ?? espacios[0]?.id ?? '',
    prioridad: preventiva ? 'MEDIA' : 'ALTA',
    asignadaA: '',
    bloquear: preventiva,
    fecha: hoy(),
    desde: '08:00',
    hasta: '09:00',
  });
  const [error, setError] = useState('');
  const cambiar = (k: keyof typeof f, v: string | boolean) => setF((x) => ({ ...x, [k]: v }));

  async function crear(e: FormEvent) {
    e.preventDefault();
    setError('');
    const inicio = new Date(`${f.fecha}T${f.desde}`);
    const fin = new Date(`${f.fecha}T${f.hasta}`);
    if (f.bloquear && fin <= inicio) return setError('La hora de término del bloqueo debe ser posterior al inicio');
    try {
      await api('/mantencion/ordenes', {
        method: 'POST',
        body: JSON.stringify({
          espacioId: f.espacioId,
          tipo: preventiva ? 'PREVENTIVA' : 'CORRECTIVA',
          prioridad: f.prioridad,
          reporteIds,
          ...(f.asignadaA ? { asignadaA: f.asignadaA } : {}),
          ...(f.bloquear ? { bloqueo: { inicio, fin } } : {}),
        }),
      });
      const codigo = espacios.find((x) => x.id === f.espacioId)?.codigo ?? espacio?.codigo;
      const dia = new Date(`${f.fecha}T12:00`).toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
      onCreada(`Orden de trabajo creada para ${codigo}${f.bloquear ? `; sala bloqueada el ${dia} de ${f.desde} a ${f.hasta}` : ''}.`);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <Dialogo titulo={preventiva ? 'Nueva mantención preventiva' : `Orden de trabajo · ${espacio?.codigo} (${reporteIds.length} reporte${reporteIds.length > 1 ? 's' : ''})`} onCerrar={onCerrar}>
      <form onSubmit={crear} style={{ display: 'grid', gap: '0.75rem' }}>
        <div className="campos">
          {preventiva && (
            <label>
              Espacio
              <select value={f.espacioId} onChange={(e) => cambiar('espacioId', e.target.value)}>
                {espacios.map((x) => <option key={x.id} value={x.id}>{x.codigo} · {x.nombre}</option>)}
              </select>
            </label>
          )}
          <label>
            Prioridad
            <select value={f.prioridad} onChange={(e) => cambiar('prioridad', e.target.value)}>
              <option value="BAJA">Baja</option><option value="MEDIA">Media</option><option value="ALTA">Alta</option><option value="URGENTE">Urgente</option>
            </select>
          </label>
          <label>
            Asignar a (opcional)
            <select value={f.asignadaA} onChange={(e) => cambiar('asignadaA', e.target.value)}>
              <option value="">Sin asignar todavía</option>
              {personal.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </label>
        </div>
        <label className="check">
          <input type="checkbox" checked={f.bloquear} onChange={(e) => cambiar('bloquear', e.target.checked)} />
          Bloquear la sala mientras se trabaja (no se podrá reservar en ese horario)
        </label>
        {f.bloquear && (
          <div className="campos">
            <label>Día<input type="date" value={f.fecha} min={hoy()} onChange={(e) => cambiar('fecha', e.target.value)} /></label>
            <label>Desde<input type="time" step={60} value={f.desde} onChange={(e) => cambiar('desde', e.target.value)} /></label>
            <label>Hasta<input type="time" step={60} value={f.hasta} onChange={(e) => cambiar('hasta', e.target.value)} /></label>
          </div>
        )}
        {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="sec" onClick={onCerrar}>Volver</button>
          <button type="submit">Crear orden</button>
        </div>
      </form>
    </Dialogo>
  );
}
