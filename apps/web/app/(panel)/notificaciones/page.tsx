'use client';
import { usePanel } from '@/components/Panel';
import { Badge, Cabecera, Cargando, Icono, Vacio, useAviso, useDatos } from '@/components/ui';
import { enviar, mensajeError } from '@/lib/api';
import { fechaHora, hace } from '@/lib/formato';
import type { Notificacion } from '@/lib/tipos';

/** Bandeja de avisos in-app (R6 / WBS 1.4.6). */
export default function Notificaciones() {
  const avisar = useAviso();
  const { refrescarContadores } = usePanel();
  const { datos, error, recargar } = useDatos<Notificacion[]>('/notificaciones/mias');
  const noLeidas = datos?.filter((n) => !n.leida_en).length ?? 0;

  async function marcar(n?: Notificacion) {
    try {
      await enviar(n ? `/notificaciones/${n.id}/leida` : '/notificaciones/leidas', {}, 'PATCH');
      if (!n) avisar('Todos los avisos quedaron como leídos');
      await recargar();
      refrescarContadores();
    } catch (e) {
      avisar(mensajeError(e), true);
    }
  }

  return (
    <>
      <Cabecera miga="Cuenta" titulo="Notificaciones" sub={noLeidas ? `${noLeidas} sin leer` : 'Estás al día'}>
        <button className="sec" disabled={!noLeidas} onClick={() => marcar()}><Icono n="check" />Marcar todo como leído</button>
      </Cabecera>
      <section className="card">
        {error && <div className="alerta error"><Icono n="alerta" />{error}</div>}
        {!datos ? <Cargando /> : datos.length === 0 ? <Vacio icono="campana" titulo="No tienes avisos" /> : (
          <div style={{ display: 'grid' }}>
            {datos.map((n) => (
              <div key={n.id} style={{ display: 'flex', gap: 12, padding: '0.85rem 0.25rem', borderBottom: '1px solid var(--border)', alignItems: 'flex-start', opacity: n.leida_en ? 0.7 : 1 }}>
                <span className="avatar" style={{ width: 36, height: 36, background: n.leida_en ? 'var(--neutral-bg)' : 'var(--orange-500)', color: n.leida_en ? 'var(--muted)' : 'var(--navy-950)' }}>
                  <Icono n="campana" t={16} />
                </span>
                <div style={{ flex: 1, display: 'grid', gap: 2 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <strong>{n.titulo}</strong>{!n.leida_en && <Badge tono="naranja">Nuevo</Badge>}
                  </div>
                  <span>{n.cuerpo}</span>
                  <span className="muted chico" title={fechaHora(n.creado_en)}>{hace(n.creado_en)}</span>
                </div>
                {!n.leida_en && <button className="fantasma chico" onClick={() => marcar(n)}>Marcar leído</button>}
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
