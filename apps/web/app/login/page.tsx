'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { api, guardarSesion, mensajeError, type Sesion } from '@/lib/api';
import { Logo } from '@/components/ui';
import styles from './login.module.css';

/** Cuentas de demostración (packages/db/semillas/demo): completan correo y contraseña. */
const DEMO = [
  ['subdireccion@itn.cl', 'Subdirección'],
  ['dir.inf@itn.cl', 'Director carrera'],
  ['docente@itn.cl', 'Docente'],
  ['estudiante@itn.cl', 'Estudiante'],
  ['operaciones@itn.cl', 'Operaciones'],
  ['aseo@itn.cl', 'Aseo'],
  ['datd@itn.cl', 'DATD'],
] as const;
const CLAVE_DEMO = 'reservaitn';

type NombreIcono = 'mail' | 'lock' | 'eye' | 'eyeOff' | 'arrow' | 'calendar' | 'people' | 'shield' | 'monitor';

function IconoLogin({ nombre }: { nombre: NombreIcono }) {
  const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  let trazos: React.ReactNode;
  switch (nombre) {
    case 'mail': trazos = <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></>; break;
    case 'lock': trazos = <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></>; break;
    case 'eye': trazos = <><path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6Z" /><circle cx="12" cy="12" r="3" /></>; break;
    case 'eyeOff': trazos = <><path d="m3 3 18 18M10.6 6.1A11 11 0 0 1 12 6c6.4 0 10 6 10 6a16 16 0 0 1-3.3 3.7M6 6.8C3.5 8.5 2 12 2 12s3.6 6 10 6a11 11 0 0 0 3.1-.4" /><path d="M10 10a3 3 0 0 0 4 4" /></>; break;
    case 'arrow': trazos = <><path d="M10 17l5-5-5-5M15 12H3" /><path d="M13 4h6a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6" /></>; break;
    case 'calendar': trazos = <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 10h18M8 15h3" /></>; break;
    case 'people': trazos = <><circle cx="9" cy="8" r="3" /><path d="M3 20v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 5v1" /></>; break;
    case 'shield': trazos = <><path d="M12 2 4 5v6c0 5.3 3.5 8.5 8 11 4.5-2.5 8-5.7 8-11V5l-8-3Z" /><path d="m9 12 2 2 4-4" /></>; break;
    case 'monitor': trazos = <><rect x="3" y="4" width="18" height="14" rx="2" /><path d="M8 22h8M12 18v4" /></>; break;
  }
  return <svg {...base} viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">{trazos}</svg>;
}

export default function Login() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [email, setEmail] = useState('subdireccion@itn.cl');
  const [password, setPassword] = useState('');
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function ingresar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      const s = await api<Sesion>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), password }),
      });
      guardarSesion(s);
      router.replace('/inicio');
    } catch (err) {
      setError(mensajeError(err));
      setEnviando(false);
    }
  }

  return (
    <main className={styles.paginaLogin}>
      <section className={styles.panelCampus} aria-label="Instituto Técnico del Norte">
        <div className={styles.fotoCampus} />
        <div className={styles.cintaCampus}>
          <div className={styles.valor}><IconoLogin nombre="calendar" /><span>Gestión de<br />espacios</span></div>
          <div className={styles.valor}><IconoLogin nombre="people" /><span>Uso<br />institucional</span></div>
          <div className={styles.valor}><IconoLogin nombre="shield" /><span>Acceso<br />seguro</span></div>
          <div className={styles.valor}><IconoLogin nombre="monitor" /><span>Plataforma<br />centralizada</span></div>
        </div>
      </section>

      <section className={styles.panelAcceso} aria-label="Acceso a ReservaITN">
        <div className={styles.adornoSuperior} aria-hidden="true" />
        <div className={styles.tarjeta}>
          <div className={styles.encabezado}>
            <div className={styles.marca}>
              <Logo alto={66} />
              <span className={styles.nombreInstituto}>Instituto<br />Técnico<br />del Norte</span>
            </div>
            <div className={styles.lema}>Formación que construye tu futuro</div>
            <h1>Bienvenido a Reserva<span>ITN</span></h1>
            <p>Accede con tu cuenta institucional.</p>
          </div>

          <form className={styles.formulario} onSubmit={ingresar}>
            <div className={styles.grupoCampo}>
              <label htmlFor="login-email">Correo institucional</label>
              <div className={styles.campoConIcono}>
                <IconoLogin nombre="mail" />
                <input id="login-email" name="email" type="email" required autoComplete="username" placeholder="usuario@itn.cl" value={email} onChange={(e) => { setEmail(e.target.value); setError(''); }} />
              </div>
            </div>
            <div className={styles.grupoCampo}>
              <label htmlFor="login-password">Contraseña</label>
              <div className={styles.campoConIcono}>
                <IconoLogin nombre="lock" />
                <input id="login-password" name="password" type={mostrarPassword ? 'text' : 'password'} required autoComplete="current-password" placeholder="Ingresa tu contraseña" value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }} />
                <button className={styles.verPassword} type="button" aria-label={mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={mostrarPassword} onClick={() => setMostrarPassword(!mostrarPassword)}>
                  <IconoLogin nombre={mostrarPassword ? 'eyeOff' : 'eye'} />
                </button>
              </div>
            </div>
            {error && <div role="alert" className={styles.errorLogin}>{error}</div>}
            <button type="submit" className={styles.botonIngresar} disabled={enviando}>
              <IconoLogin nombre="arrow" />{enviando ? 'Ingresando…' : 'Iniciar sesión'}
            </button>
          </form>

          {(process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_MOSTRAR_DEMO === 'true') && (
            <div className={styles.demo}>
              <p>Cuentas de demostración (contraseña <strong>{CLAVE_DEMO}</strong>)</p>
              <div className={styles.chipsDemo}>
                {DEMO.map(([correo, texto]) => (
                  <button key={correo} type="button" className={`${styles.chipDemo} ${email === correo ? styles.chipActivo : ''}`} onClick={() => { setEmail(correo); setPassword(CLAVE_DEMO); setError(''); }}>
                    <IconoLogin nombre="people" />{texto}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
