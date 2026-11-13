'use client';
/**
 * Componentes visuales comunes de la web (sistema de diseño ITN).
 * Las clases CSS que usan están en app/globals.css; aquí solo hay estructura y comportamiento.
 */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { EstadoReserva } from '@reservaitn/shared';
import { api, mensajeError } from '@/lib/api';
import { ESTADO } from '@/lib/formato';

/* ---------- Íconos (trazos 24×24, estilo lineal) ---------- */
const TRAZOS = {
  inicio: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  reservar: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM12 13v6M9 16h6',
  calendario: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01',
  lista: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01',
  aprobar: 'M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4 12 14.01l-3-3',
  grafico: 'M3 3v18h18M7 15l4-4 3 3 6-7',
  edificio: 'M3 21h18M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16M9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1',
  usuarios: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  subir: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
  bajar: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  herramienta: 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z',
  campana: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0',
  salir: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  usuario: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM20 21a8 8 0 0 0-16 0',
  menu: 'M4 6h16M4 12h16M4 18h16',
  cerrar: 'M18 6 6 18M6 6l12 12',
  buscar: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
  reloj: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
  destello: 'M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2zM19 3v4M21 5h-4',
  mas: 'M12 5v14M5 12h14',
  imprimir: 'M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z',
  izq: 'm15 18-6-6 6-6',
  der: 'm9 18 6-6-6-6',
  alerta: 'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01',
  llave: 'M15.5 7.5 19 4m2-2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.78 7.78 5.5 5.5 0 0 1 7.78-7.78zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3',
  editar: 'M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z',
  historial: 'M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8M3 3v5h5M12 7v5l4 2',
  personas: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  sala: 'M3 21h18M5 21V8l7-5 7 5v13M10 21v-6h4v6',
  check: 'M20 6 9 17l-5-5',
  archivo: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5',
  caja: 'M21 8V16a2 2 0 0 1-1 1.73l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 16V8a2 2 0 0 1 1-1.73l7-4a2 2 0 0 1 2 0l7 4A2 2 0 0 1 21 8zM3.3 7 12 12l8.7-5M12 22V12',
} as const;
export type NombreIcono = keyof typeof TRAZOS;

/** Ícono SVG en línea; toma el color del texto (`currentColor`). `t` = tamaño en px. */
export function Icono({ n, t = 18 }: { n: NombreIcono; t?: number }) {
  return (
    <svg width={t} height={t} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={TRAZOS[n]} />
    </svg>
  );
}

/** Isotipo ITN: letras institucionales con el triángulo naranja sobre la "i". `claro` = letras blancas (fondos azules). */
export function Logo({ alto = 34, claro = false }: { alto?: number; claro?: boolean }) {
  const color = claro ? '#ffffff' : 'var(--navy-700)';
  return (
    <svg height={alto} viewBox="0 0 92 46" role="img" aria-label="ITN">
      <path d="M2 2h13L2 13z" fill="var(--orange-500)" />
      <rect x="3" y="16" width="10" height="28" rx="1" fill={color} />
      <path d="M17 6h28v9H36v29H26V15h-9z" fill={color} />
      <path d="M48 44V6h9.5L79 29V6h10v38h-9.5L58 21v23z" fill={color} />
    </svg>
  );
}

/** Encabezado de página: sección (`miga`), título, bajada y botones de acción a la derecha. */
export function Cabecera({ miga, titulo, sub, children }: { miga?: string; titulo: string; sub?: ReactNode; children?: ReactNode }) {
  return (
    <div className="cabecera">
      <div>
        {miga && <span className="miga">{miga}</span>}
        <h1>{titulo}</h1>
        {sub && <p className="muted">{sub}</p>}
      </div>
      {children && <div className="acciones">{children}</div>}
    </div>
  );
}

/** Etiqueta de color para el estado de una reserva (pendiente, aprobada, rechazada…). */
export function EstadoBadge({ estado }: { estado: EstadoReserva }) {
  const e = ESTADO[estado];
  return <span className={`badge ${e.tono}`}>{e.texto}</span>;
}

/** Etiqueta genérica. `tono`: ok | warn | danger | info | naranja | sin-punto. */
export function Badge({ tono = '', children }: { tono?: string; children: ReactNode }) {
  return <span className={`badge ${tono}`}>{children}</span>;
}

/** Estado vacío de una lista o tabla, con ícono, título y una acción opcional. */
export function Vacio({ icono = 'calendario', titulo, children }: { icono?: NombreIcono; titulo: string; children?: ReactNode }) {
  return (
    <div className="vacio">
      <div className="ico"><Icono n={icono} t={24} /></div>
      <strong>{titulo}</strong>
      {children && <div className="chico">{children}</div>}
    </div>
  );
}

/** Barras animadas mientras llegan los datos. */
export function Cargando({ filas = 3 }: { filas?: number }) {
  return (
    <div style={{ display: 'grid', gap: 10, padding: '0.5rem 0' }} aria-busy>
      {Array.from({ length: filas }, (_, i) => <div key={i} className="cargando" style={{ width: `${90 - i * 12}%` }} />)}
    </div>
  );
}

/** Ventana modal; se cierra con Escape, con la X o al hacer clic fuera. `pie` = botones inferiores. */
export function Modal({ titulo, onCerrar, children, pie }: { titulo: string; onCerrar: () => void; children: ReactNode; pie?: ReactNode }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onCerrar]);
  return (
    <div className="modal-fondo" onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <div className="modal" role="dialog" aria-modal aria-label={titulo}>
        <div className="card-head">
          <h2>{titulo}</h2>
          <button className="fantasma" onClick={onCerrar} aria-label="Cerrar"><Icono n="cerrar" /></button>
        </div>
        {children}
        {pie && <div className="pie-modal">{pie}</div>}
      </div>
    </div>
  );
}

/* ---------- Avisos flotantes ---------- */
type Toast = { id: number; texto: string; error?: boolean };
const ToastCtx = createContext<(texto: string, error?: boolean) => void>(() => {});
/** Devuelve `avisar(texto, error?)`, que muestra un aviso flotante por 4,5 s. */
export const useAviso = () => useContext(ToastCtx);

/** Contenedor de los avisos flotantes; lo monta el Panel, así toda página puede usar `useAviso`. */
export function ProveedorAvisos({ children }: { children: ReactNode }) {
  const [lista, setLista] = useState<Toast[]>([]);
  const avisar = useCallback((texto: string, error = false) => {
    const id = Date.now() + Math.random();
    setLista((l) => [...l, { id, texto, error }]);
    setTimeout(() => setLista((l) => l.filter((t) => t.id !== id)), 4500);
  }, []);
  return (
    <ToastCtx.Provider value={avisar}>
      {children}
      <div className="toast-zona" role="status">
        {lista.map((t) => (
          <div key={t.id} className={`toast${t.error ? ' error' : ''}`}>
            <Icono n={t.error ? 'alerta' : 'check'} />
            {t.texto}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/** Carga datos de la API y expone `recargar`. Si `ruta` es null no consulta. */
export function useDatos<T>(ruta: string | null) {
  const [datos, setDatos] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const recargar = useCallback(() => {
    if (!ruta) return Promise.resolve();
    setCargando(true);
    return api<T>(ruta)
      .then((d) => { setDatos(d); setError(''); })
      .catch((e) => setError(mensajeError(e)))
      .finally(() => setCargando(false));
  }, [ruta]);
  useEffect(() => { recargar(); }, [recargar]);
  return { datos, error, cargando, recargar, setDatos };
}
