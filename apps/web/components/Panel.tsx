'use client';
/**
 * Estructura común de todas las pantallas internas (layout de app/(panel)):
 * menú lateral filtrado por rol, barra superior, guarda de sesión y contadores de avisos y pendientes.
 */
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Permiso } from '@reservaitn/shared';
import { api, guardarSesion, sesion, type Sesion } from '@/lib/api';
import { iniciales, rolPrincipal } from '@/lib/formato';
import { Icono, Logo, ProveedorAvisos, type NombreIcono } from './ui';

interface ItemNav { href: string; texto: string; icono: NombreIcono; permiso?: Permiso | Permiso[]; contador?: 'pendientes' }

/** Menú lateral: cada entrada se muestra solo si el rol tiene alguno de sus permisos (matriz de E4). */
const MENU: { grupo: string; items: ItemNav[] }[] = [
  {
    grupo: 'Reservas',
    items: [
      { href: '/inicio', texto: 'Inicio', icono: 'inicio' },
      { href: '/reservar', texto: 'Nueva reserva', icono: 'reservar', permiso: 'reserva:solicitar' },
      { href: '/calendario', texto: 'Calendario y disponibilidad', icono: 'calendario' },
      { href: '/mis-reservas', texto: 'Mis reservas', icono: 'lista', permiso: 'reserva:solicitar' },
      { href: '/aprobaciones', texto: 'Aprobaciones', icono: 'aprobar', permiso: 'reserva:aprobar', contador: 'pendientes' },
    ],
  },
  {
    grupo: 'Análisis',
    items: [{ href: '/dashboard', texto: 'Dashboard y reportes', icono: 'grafico', permiso: 'dashboard:ver' }],
  },
  {
    grupo: 'Gestión',
    items: [
      { href: '/salas', texto: 'Salas y laboratorios', icono: 'edificio', permiso: 'recurso:gestionar' },
      { href: '/importacion', texto: 'Importar planificación', icono: 'subir', permiso: 'planificacion:importar' },
      { href: '/mantencion', texto: 'Mantención', icono: 'herramienta', permiso: ['danio:gestionar', 'mantencion:planificar'] },
      { href: '/usuarios', texto: 'Usuarios', icono: 'usuarios', permiso: 'usuario:gestionar' },
    ],
  },
];

/**
 * `true` si la sesión tiene el permiso o, con una lista, alguno de ellos. Sin permiso = visible
 * para todos. Los permisos efectivos los calcula la base de datos al iniciar sesión.
 */
export function puede(permisos: readonly string[], permiso?: Permiso | Permiso[]): boolean {
  if (!permiso) return true;
  return (Array.isArray(permiso) ? permiso : [permiso]).some((p) => permisos.includes(p));
}

interface CtxPanel { sesion: Sesion; puede: (p?: Permiso | Permiso[]) => boolean; refrescarContadores: () => void }
const PanelCtx = createContext<CtxPanel | null>(null);
/**
 * Datos del panel para las páginas: sesión actual, `puede(permiso)` y `refrescarContadores()`,
 * que conviene llamar tras aprobar, cancelar o leer avisos para actualizar la campana y el menú.
 */
export function usePanel(): CtxPanel {
  const c = useContext(PanelCtx);
  if (!c) throw new Error('usePanel fuera del Panel');
  return c;
}

/** Sin sesión redirige a /login. Los contadores se consultan al entrar y cada 60 s. */
export function Panel({ children }: { children: ReactNode }) {
  const router = useRouter();
  const ruta = usePathname();
  const [s, setS] = useState<Sesion | null>(null);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [noLeidas, setNoLeidas] = useState(0);
  const [pendientes, setPendientes] = useState(0);

  useEffect(() => {
    const actual = sesion();
    if (!actual) router.replace('/login');
    setS(actual);
  }, [router]);

  const permisos = s?.usuario.permisos;
  const refrescarContadores = useCallback(() => {
    if (!permisos) return;
    api<{ total: number }>('/notificaciones/no-leidas').then((n) => setNoLeidas(n.total)).catch(() => {});
    if (permisos.includes('reserva:aprobar')) api<unknown[]>('/solicitudes/pendientes').then((p) => setPendientes(p.length)).catch(() => {});
  }, [permisos]);

  useEffect(() => {
    refrescarContadores();
    const t = setInterval(refrescarContadores, 60_000);
    return () => clearInterval(t);
  }, [refrescarContadores]);

  useEffect(() => setMenuAbierto(false), [ruta]);

  if (!s || !permisos) return null;
  const items = MENU.map((g) => ({ ...g, items: g.items.filter((i) => puede(permisos, i.permiso)) })).filter((g) => g.items.length);
  const actual = items.flatMap((g) => g.items).find((i) => ruta.startsWith(i.href));

  return (
    <PanelCtx.Provider value={{ sesion: s, puede: (p) => puede(permisos, p), refrescarContadores }}>
      <ProveedorAvisos>
        <div className="app">
          <aside className={`sidebar${menuAbierto ? ' abierta' : ''}`}>
            <Link href="/inicio" className="marca" style={{ textDecoration: 'none' }}>
              <Logo alto={30} claro />
              <span><strong>ReservaITN</strong><small>Instituto Técnico del Norte</small></span>
            </Link>
            <nav className="nav" aria-label="Principal">
              {items.map((g) => (
                <div key={g.grupo} style={{ display: 'grid', gap: 2 }}>
                  <div className="grupo">{g.grupo}</div>
                  {g.items.map((i) => (
                    <Link key={i.href} href={i.href} className={ruta.startsWith(i.href) ? 'activo' : ''}>
                      <Icono n={i.icono} />
                      {i.texto}
                      {i.contador === 'pendientes' && pendientes > 0 && <span className="contador">{pendientes}</span>}
                    </Link>
                  ))}
                </div>
              ))}
            </nav>
            <div className="pie">
              <div className="lema">Formación que construye tu futuro</div>
              <div style={{ marginTop: 4 }}>Arica · JBG Tech</div>
            </div>
          </aside>
          {menuAbierto && <div className="velo" onClick={() => setMenuAbierto(false)} />}

          <div className="contenido">
            <header className="topbar">
              <button className="icon-btn menu-movil" onClick={() => setMenuAbierto(true)} aria-label="Abrir menú"><Icono n="menu" /></button>
              <span className="titulo">{actual?.texto ?? (ruta.startsWith('/notificaciones') ? 'Notificaciones' : 'Mi cuenta')}</span>
              <Link href="/notificaciones" className="icon-btn" aria-label={`Notificaciones (${noLeidas} sin leer)`}>
                <Icono n="campana" />
                {noLeidas > 0 && <span className="punto">{noLeidas > 9 ? '9+' : noLeidas}</span>}
              </Link>
              <Link href="/perfil" className="usuario-chip">
                <span className="avatar">{iniciales(s.usuario.nombre)}</span>
                <span className="datos"><strong style={{ fontSize: '0.85rem' }}>{s.usuario.nombre}</strong><small>{rolPrincipal(s.usuario.roles)}</small></span>
              </Link>
              <button className="icon-btn" title="Cerrar sesión" aria-label="Cerrar sesión" onClick={() => { guardarSesion(null); router.replace('/login'); }}>
                <Icono n="salir" />
              </button>
            </header>
            <main className="pagina">{children}</main>
          </div>
        </div>
      </ProveedorAvisos>
    </PanelCtx.Provider>
  );
}

/** Muestra el contenido solo a roles con el permiso; si no, un aviso (la API también lo valida). */
export function ConPermiso({ permiso, children }: { permiso: Permiso | Permiso[]; children: ReactNode }) {
  const { puede: p } = usePanel();
  if (p(permiso)) return <>{children}</>;
  return (
    <div className="card">
      <div className="vacio">
        <div className="ico"><Icono n="llave" t={24} /></div>
        <strong>Su rol no tiene acceso a esta sección</strong>
        <Link href="/inicio">Volver al inicio</Link>
      </div>
    </div>
  );
}
