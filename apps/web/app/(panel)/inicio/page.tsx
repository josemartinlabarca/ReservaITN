'use client';

import Link from 'next/link';
import { usePanel } from '@/components/Panel';
import { Badge, Cargando, EstadoBadge, Icono, Vacio, useDatos, type NombreIcono } from '@/components/ui';
import { fecha, hace, rangoHora, rolPrincipal } from '@/lib/formato';
import type { Notificacion, ReservaPropia } from '@/lib/tipos';
import type { Permiso } from '@reservaitn/shared';
import styles from './inicio.module.css';

/** Accesos rápidos: cada uno se muestra solo si la sesión tiene el permiso (los calcula la base de datos). */
const ACCESOS: {
  href: string;
  titulo: string;
  texto: string;
  icono: NombreIcono;
  permiso?: Permiso | Permiso[];
  destacado?: boolean;
}[] = [
  { href: '/reservar', titulo: 'Nueva reserva', texto: 'Solicitar un espacio', icono: 'destello', permiso: 'reserva:solicitar', destacado: true },
  { href: '/calendario', titulo: 'Disponibilidad', texto: 'Calendario semanal', icono: 'calendario' },
  { href: '/aprobaciones', titulo: 'Aprobaciones', texto: 'Revisar solicitudes', icono: 'aprobar', permiso: 'reserva:aprobar' },
  { href: '/dashboard', titulo: 'Dashboard', texto: 'Ocupación y reportes', icono: 'grafico', permiso: 'dashboard:ver' },
  { href: '/importacion', titulo: 'Importar semestre', texto: 'Planificación académica', icono: 'subir', permiso: 'planificacion:importar' },
  { href: '/mantencion', titulo: 'Mantención', texto: 'Daños y órdenes', icono: 'herramienta', permiso: ['danio:gestionar', 'mantencion:planificar'] },
  { href: '/salas', titulo: 'Salas', texto: 'Recursos y equipamiento', icono: 'edificio', permiso: 'recurso:gestionar' },
  { href: '/usuarios', titulo: 'Usuarios', texto: 'Cuentas y roles', icono: 'usuarios', permiso: 'usuario:gestionar' },
];

function saludo() {
  const h = new Date().getHours();
  return h < 12 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches';
}

function diaDeReserva(inicio: string) {
  const d = new Date(inicio);
  return {
    dia: new Intl.DateTimeFormat('es-CL', { day: '2-digit' }).format(d),
    mes: new Intl.DateTimeFormat('es-CL', { month: 'short' }).format(d).replace('.', '').toUpperCase(),
  };
}

/** Inicio: saludo, accesos según permisos, próximas reservas y avisos recientes del usuario. */
export default function Inicio() {
  const { sesion, puede } = usePanel();
  const solicita = puede('reserva:solicitar');
  const aprueba = puede('reserva:aprobar');
  const reservas = useDatos<ReservaPropia[]>(solicita ? '/reservas/mias' : null);
  const notifs = useDatos<Notificacion[]>('/notificaciones/mias');
  const pendientes = useDatos<unknown[]>(aprueba ? '/solicitudes/pendientes' : null);

  const ahora = Date.now();
  const proximas = (reservas.datos ?? [])
    .filter((r) => new Date(r.fin).getTime() > ahora && (r.estado === 'APROBADA' || r.estado === 'PENDIENTE'))
    .sort((a, b) => a.inicio.localeCompare(b.inicio));

  const nombre = sesion.usuario.nombre.split(' ')[0];
  const avisosSinLeer = (notifs.datos ?? []).filter((n) => !n.leida_en).length;
  const accesosVisibles = ACCESOS.filter((a) => puede(a.permiso));
  const tieneIndicadores = solicita || aprueba || Boolean(notifs.datos?.length);

  return (
    <div className={styles.inicio}>
      <section className={styles.bienvenida} aria-label="Bienvenida">
        <div className={styles.bienvenidaTexto}>
          <span className={styles.sobretitulo}>INSTITUTO TÉCNICO DEL NORTE</span>
          <h1>¡{saludo()}, {nombre}!</h1>
          <p>Tu espacio para gestionar actividades y recursos institucionales.</p>
          <div className={styles.etiquetas}>
            <span><Icono n="usuarios" t={16} />{rolPrincipal(sesion.usuario.roles)}</span>
            <span><Icono n="calendario" t={16} />{new Date().toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
          </div>
        </div>
        <div className={styles.imagenBienvenida} aria-hidden="true" />
      </section>

      <nav className={styles.accesos} aria-label="Accesos rápidos">
        {accesosVisibles.map((a) => (
          <Link key={a.href} href={a.href} className={`${styles.acceso} ${a.destacado ? styles.accesoDestacado : ''}`}>
            <span className={styles.iconoAcceso}><Icono n={a.icono} t={24} /></span>
            <span className={styles.textoAcceso}>
              <strong>{a.titulo}</strong>
              <small>{a.texto}</small>
            </span>
            <span className={styles.flecha} aria-hidden="true">›</span>
          </Link>
        ))}
      </nav>

      {tieneIndicadores && (
        <section className={styles.indicadores} aria-label="Resumen personal">
          {solicita && (
            <Link href="/mis-reservas" className={styles.indicador}>
              <span className={styles.iconoIndicador}><Icono n="calendario" t={22} /></span>
              <span>
                <small>Mis próximas reservas</small>
                <strong>{reservas.cargando && !reservas.datos ? '…' : proximas.length}</strong>
              </span>
            </Link>
          )}
          {aprueba && (
            <Link href="/aprobaciones" className={styles.indicador}>
              <span className={styles.iconoIndicador}><Icono n="aprobar" t={22} /></span>
              <span>
                <small>Solicitudes por aprobar</small>
                <strong>{pendientes.cargando && !pendientes.datos ? '…' : (pendientes.datos?.length ?? '—')}</strong>
              </span>
            </Link>
          )}
          <Link href="/notificaciones" className={styles.indicador}>
            <span className={styles.iconoIndicador}><Icono n="campana" t={22} /></span>
            <span>
              <small>Avisos sin leer</small>
              <strong>{notifs.cargando && !notifs.datos ? '…' : avisosSinLeer}</strong>
            </span>
          </Link>
        </section>
      )}

      <div className={`${styles.columnas} ${!solicita ? styles.unaColumna : ''}`}>
        {solicita && (
          <section className={styles.panel}>
            <div className={styles.cabeceraPanel}>
              <div className={styles.tituloPanel}>
                <span className={styles.iconoTitulo}><Icono n="calendario" t={20} /></span>
                <h2>Mis próximas reservas</h2>
              </div>
              <Link href="/mis-reservas">Ver todas <span aria-hidden="true">→</span></Link>
            </div>
            {reservas.cargando && !reservas.datos ? <Cargando /> : proximas.length === 0 ? (
              <div className={styles.vacio}><Vacio titulo="No tienes reservas próximas"><Link href="/reservar">Solicitar una reserva</Link></Vacio></div>
            ) : (
              <ul className={styles.listaReservas}>
                {proximas.slice(0, 5).map((r) => {
                  const { dia, mes } = diaDeReserva(r.inicio);
                  return (
                    <li key={r.id} className={styles.reserva}>
                      <div className={styles.fechaReserva}><span>{mes}</span><strong>{dia}</strong></div>
                      <div className={styles.detalleReserva}>
                        <div className={styles.encabezadoReserva}>
                          <strong>{r.espacio.codigo} · {r.espacio.nombre}</strong>
                          <EstadoBadge estado={r.estado} />
                        </div>
                        <small>{r.espacio.edificio.sede.nombre} · {rangoHora(r.inicio, r.fin)}</small>
                        <p>{r.solicitud.descripcion}</p>
                        <span className={styles.soloLectores}>{fecha(r.inicio)}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}

        <section className={styles.panel}>
          <div className={styles.cabeceraPanel}>
            <div className={styles.tituloPanel}>
              <span className={styles.iconoTitulo}><Icono n="campana" t={20} /></span>
              <h2>Avisos recientes</h2>
            </div>
            <Link href="/notificaciones">Ver todos <span aria-hidden="true">→</span></Link>
          </div>
          {notifs.cargando && !notifs.datos ? <Cargando /> : !notifs.datos?.length ? (
            <div className={styles.sinAvisos}>
              <span className={styles.campanaVacia}><Icono n="campana" t={28} /></span>
              <strong>Sin avisos por ahora</strong>
              <p>Te informaremos aquí sobre cambios, aprobaciones y novedades.</p>
            </div>
          ) : (
            <ul className={styles.listaAvisos}>
              {notifs.datos.slice(0, 5).map((n) => (
                <li key={n.id}>
                  <div className={styles.avisoTitulo}>
                    <strong>{n.titulo}</strong>{!n.leida_en && <Badge tono="naranja">Nuevo</Badge>}
                  </div>
                  <p>{n.cuerpo}</p>
                  <small>{hace(n.creado_en)}</small>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className={styles.disponibilidad}>
        <div className={styles.disponibilidadIcono}><Icono n="calendario" t={26} /></div>
        <div>
          <h2>Consulta la disponibilidad de espacios</h2>
          <p>Revisa los horarios de salas y laboratorios antes de planificar tus actividades.</p>
        </div>
        <Link href="/calendario">Ver disponibilidad <span aria-hidden="true">→</span></Link>
      </section>
    </div>
  );
}
