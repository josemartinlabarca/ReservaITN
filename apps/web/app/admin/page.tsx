'use client';
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { ROLES, espacioCreateSchema, espacioUpdateSchema, usuarioCreateSchema, usuarioUpdateSchema, type Rol } from '@reservaitn/shared';
import { Encabezado } from '../Encabezado';
import { api, sesion } from '@/lib/api';

interface Edificio { id: string; codigo: string; nombre: string }
interface Sede { id: string; codigo: string; nombre: string; edificio: Edificio[] }
interface Catalogo { id: string; codigo: string; nombre: string }
interface Espacio {
  id: string;
  codigo: string;
  nombre: string;
  piso: number;
  capacidad: number;
  accesible: boolean;
  reservable: boolean;
  activo: boolean;
  tipo_espacio: Catalogo;
  edificio: { id: string; codigo: string; nombre: string; sede: { id: string; nombre: string } };
  espacio_item: { cantidad_esperada: number; item: Catalogo }[];
}
interface Usuario {
  id: string;
  estado: 'ACTIVO' | 'BLOQUEADO';
  ultimo_acceso: string | null;
  persona: { nombres: string; apellido_paterno: string; email: string | null; tipo_documento: string; numero_documento: string };
  usuario_rol: { rol: { codigo: Rol }; sede_id: string | null; carrera_id: string | null }[];
}
interface RolFila { rol: Rol; carreraId: string; sedeId: string }

const NOMBRE_ROL: Record<Rol, string> = {
  ESTUDIANTE: 'Estudiante',
  DOCENTE: 'Docente',
  DIRECTOR_CARRERA: 'Director de carrera',
  DIRECCION_ACADEMICA: 'Dirección académica',
  SUBDIRECCION: 'Subdirección',
  DATD: 'DATD',
  OPERACIONES: 'Operaciones',
  ASEO_MANTENCION: 'Aseo y mantención',
  ADMIN_TI: 'Encargado de informática',
};
const errores = (r: { success: false; error: { issues: { path: (string | number)[]; message: string }[] } }) =>
  [...new Set(r.error.issues.map((i) => `${i.path.join('.') || 'datos'}: ${i.message}`))].join(' · ');

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

/** Administración de espacios (WBS 1.4.2) y usuarios con roles y ámbito (WBS 1.4.1, D2). */
export default function Administracion() {
  const permisos = sesion()?.usuario.permisos ?? [];
  const puedeEspacios = permisos.includes('recurso:gestionar');
  const puedeUsuarios = permisos.includes('usuario:gestionar');
  const [pestana, setPestana] = useState<'espacios' | 'usuarios'>(puedeEspacios ? 'espacios' : 'usuarios');

  return (
    <>
      <Encabezado />
      <main style={{ display: 'grid', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {puedeEspacios && <button className={pestana === 'espacios' ? '' : 'sec'} onClick={() => setPestana('espacios')}>Espacios</button>}
          {puedeUsuarios && <button className={pestana === 'usuarios' ? '' : 'sec'} onClick={() => setPestana('usuarios')}>Usuarios</button>}
        </div>
        {!puedeEspacios && !puedeUsuarios && <p className="error">Su rol no tiene acceso a la administración.</p>}
        {pestana === 'espacios' && puedeEspacios && <AdminEspacios />}
        {pestana === 'usuarios' && puedeUsuarios && <AdminUsuarios />}
      </main>
    </>
  );
}

/* ───────────────────────────── Espacios ───────────────────────────── */

function AdminEspacios() {
  const [espacios, setEspacios] = useState<Espacio[]>([]);
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [tipos, setTipos] = useState<Catalogo[]>([]);
  const [items, setItems] = useState<Catalogo[]>([]);
  const [editando, setEditando] = useState<Espacio | 'nuevo' | null>(null);
  const [aviso, setAviso] = useState('');
  const cargar = useCallback(() => api<Espacio[]>('/espacios?todos=true').then(setEspacios), []);

  useEffect(() => {
    cargar();
    api<Sede[]>('/sedes').then(setSedes);
    api<{ tiposEspacio: Catalogo[]; items: Catalogo[] }>('/catalogos').then((c) => { setTipos(c.tiposEspacio); setItems(c.items); });
  }, [cargar]);

  return (
    <section className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
        <h2>Espacios</h2>
        <button onClick={() => setEditando('nuevo')}>+ Nuevo espacio</button>
      </div>
      {aviso && <p className="ok">{aviso}</p>}
      <div className="tabla-scroll">
        <table>
          <thead>
            <tr><th>Código</th><th>Nombre</th><th>Sede · edificio</th><th>Tipo</th><th>Capacidad</th><th>Equipamiento</th><th>Estado</th><th></th></tr>
          </thead>
          <tbody>
            {espacios.map((e) => (
              <tr key={e.id} style={{ opacity: e.activo ? 1 : 0.55 }}>
                <td><strong>{e.codigo}</strong></td>
                <td>{e.nombre}{e.accesible && <span title="Accesible"> ♿</span>}</td>
                <td>{e.edificio.sede.nombre} · {e.edificio.nombre} · piso {e.piso}</td>
                <td>{e.tipo_espacio.nombre}</td>
                <td>{e.capacidad}</td>
                <td className="etiqueta">{e.espacio_item.map((i) => `${i.item.nombre} (${i.cantidad_esperada})`).join(', ') || '—'}</td>
                <td>
                  {!e.activo ? <span className="estado estado-CANCELADA">Inactivo</span>
                    : !e.reservable ? <span className="estado estado-PENDIENTE">No reservable</span>
                    : <span className="estado estado-APROBADA">Activo</span>}
                </td>
                <td><button className="sec chico" onClick={() => setEditando(e)}>Editar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editando && (
        <FormEspacio
          espacio={editando === 'nuevo' ? null : editando}
          sedes={sedes}
          tipos={tipos}
          items={items}
          onCerrar={() => setEditando(null)}
          onGuardado={(texto) => { setEditando(null); setAviso(texto); cargar(); }}
        />
      )}
    </section>
  );
}

function FormEspacio({ espacio, sedes, tipos, items, onCerrar, onGuardado }: {
  espacio: Espacio | null; sedes: Sede[]; tipos: Catalogo[]; items: Catalogo[];
  onCerrar: () => void; onGuardado: (texto: string) => void;
}) {
  const [f, setF] = useState({
    edificioId: espacio?.edificio.id ?? sedes[0]?.edificio[0]?.id ?? '',
    tipoEspacioId: espacio?.tipo_espacio.id ?? tipos[0]?.id ?? '',
    codigo: espacio?.codigo ?? '',
    nombre: espacio?.nombre ?? '',
    piso: String(espacio?.piso ?? 1),
    capacidad: String(espacio?.capacidad ?? 30),
    accesible: espacio?.accesible ?? false,
    reservable: espacio?.reservable ?? true,
    activo: espacio?.activo ?? true,
  });
  const [cantidades, setCantidades] = useState<Record<string, string>>(
    Object.fromEntries((espacio?.espacio_item ?? []).map((i) => [i.item.id, String(i.cantidad_esperada)])),
  );
  const [error, setError] = useState('');
  const cambiar = (k: keyof typeof f, v: string | boolean) => setF((x) => ({ ...x, [k]: v }));

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setError('');
    const datos = {
      ...f,
      piso: Number(f.piso),
      capacidad: Number(f.capacidad),
      items: Object.entries(cantidades).filter(([, c]) => Number(c) > 0).map(([itemId, c]) => ({ itemId, cantidad: Number(c) })),
    };
    const v = espacio ? espacioUpdateSchema.safeParse(datos) : espacioCreateSchema.safeParse(datos);
    if (!v.success) return setError(errores(v));
    try {
      if (espacio) await api(`/espacios/${espacio.id}`, { method: 'PATCH', body: JSON.stringify(v.data) });
      else await api('/espacios', { method: 'POST', body: JSON.stringify(v.data) });
      onGuardado(espacio ? `Espacio ${datos.codigo} actualizado.` : `Espacio ${datos.codigo} creado.`);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <Dialogo titulo={espacio ? `Editar ${espacio.codigo}` : 'Nuevo espacio'} onCerrar={onCerrar}>
      <form onSubmit={guardar} style={{ display: 'grid', gap: '0.75rem' }}>
        <div className="campos">
          <label>
            Sede · edificio
            <select value={f.edificioId} disabled={!!espacio} onChange={(e) => cambiar('edificioId', e.target.value)}>
              {sedes.flatMap((s) => s.edificio.map((ed) => <option key={ed.id} value={ed.id}>{s.nombre} · {ed.nombre}</option>))}
            </select>
          </label>
          <label>
            Tipo
            <select value={f.tipoEspacioId} onChange={(e) => cambiar('tipoEspacioId', e.target.value)}>
              {tipos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
          </label>
          <label>Código<input value={f.codigo} onChange={(e) => cambiar('codigo', e.target.value.toUpperCase())} placeholder="A-301" required /></label>
          <label>Nombre<input value={f.nombre} onChange={(e) => cambiar('nombre', e.target.value)} placeholder="Sala A-301" required /></label>
          <label>Piso<input type="number" value={f.piso} onChange={(e) => cambiar('piso', e.target.value)} /></label>
          <label>Capacidad<input type="number" min={1} value={f.capacidad} onChange={(e) => cambiar('capacidad', e.target.value)} required /></label>
        </div>
        <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
          <label className="check"><input type="checkbox" checked={f.accesible} onChange={(e) => cambiar('accesible', e.target.checked)} /> Accesible (silla de ruedas)</label>
          <label className="check"><input type="checkbox" checked={f.reservable} onChange={(e) => cambiar('reservable', e.target.checked)} /> Se puede reservar</label>
          {espacio && <label className="check"><input type="checkbox" checked={f.activo} onChange={(e) => cambiar('activo', e.target.checked)} /> Activo</label>}
        </div>
        <fieldset className="grupo">
          <legend>Equipamiento e inventario (cantidad; 0 = no tiene)</legend>
          <div className="campos">
            {items.map((i) => (
              <label key={i.id}>
                {i.nombre}
                <input type="number" min={0} value={cantidades[i.id] ?? '0'} onChange={(e) => setCantidades((c) => ({ ...c, [i.id]: e.target.value }))} />
              </label>
            ))}
          </div>
        </fieldset>
        {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="sec" onClick={onCerrar}>Volver</button>
          <button type="submit">{espacio ? 'Guardar cambios' : 'Crear espacio'}</button>
        </div>
      </form>
    </Dialogo>
  );
}

/* ───────────────────────────── Usuarios ───────────────────────────── */

function AdminUsuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [carreras, setCarreras] = useState<Catalogo[]>([]);
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [editando, setEditando] = useState<Usuario | 'nuevo' | null>(null);
  const [filtro, setFiltro] = useState('');
  const [aviso, setAviso] = useState('');
  const cargar = useCallback(() => api<Usuario[]>('/usuarios').then(setUsuarios), []);

  useEffect(() => {
    cargar();
    api<Catalogo[]>('/carreras').then(setCarreras);
    api<Sede[]>('/sedes').then(setSedes);
  }, [cargar]);

  const nombreCarrera = (id: string | null) => carreras.find((c) => c.id === id)?.codigo;
  const nombreSede = (id: string | null) => sedes.find((s) => s.id === id)?.nombre;
  const visibles = usuarios.filter((u) =>
    `${u.persona.nombres} ${u.persona.apellido_paterno} ${u.persona.email} ${u.persona.numero_documento}`.toLowerCase().includes(filtro.toLowerCase()),
  );

  return (
    <section className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
        <h2>Usuarios</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <input placeholder="Buscar por nombre, correo o documento" value={filtro} onChange={(e) => setFiltro(e.target.value)} />
          <button onClick={() => setEditando('nuevo')}>+ Nuevo usuario</button>
        </div>
      </div>
      {aviso && <p className="ok">{aviso}</p>}
      <div className="tabla-scroll">
        <table>
          <thead><tr><th>Nombre</th><th>Correo</th><th>Documento</th><th>Roles</th><th>Estado</th><th>Último acceso</th><th></th></tr></thead>
          <tbody>
            {visibles.map((u) => (
              <tr key={u.id}>
                <td>{u.persona.nombres} {u.persona.apellido_paterno}</td>
                <td>{u.persona.email ?? '—'}</td>
                <td className="etiqueta">{u.persona.tipo_documento} {u.persona.numero_documento}</td>
                <td>
                  {u.usuario_rol.map((r, k) => (
                    <div key={k}>
                      {NOMBRE_ROL[r.rol.codigo]}
                      {(r.carrera_id || r.sede_id) && <span className="etiqueta"> · {[nombreCarrera(r.carrera_id), nombreSede(r.sede_id)].filter(Boolean).join(' · ')}</span>}
                    </div>
                  ))}
                </td>
                <td><span className={`estado ${u.estado === 'ACTIVO' ? 'estado-APROBADA' : 'estado-CANCELADA'}`}>{u.estado === 'ACTIVO' ? 'Activo' : 'Bloqueado'}</span></td>
                <td className="etiqueta">{u.ultimo_acceso ? new Date(u.ultimo_acceso).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' }) : 'Nunca'}</td>
                <td><button className="sec chico" onClick={() => setEditando(u)}>Editar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editando && (
        <FormUsuario
          usuario={editando === 'nuevo' ? null : editando}
          carreras={carreras}
          sedes={sedes}
          onCerrar={() => setEditando(null)}
          onGuardado={(texto) => { setEditando(null); setAviso(texto); cargar(); }}
        />
      )}
    </section>
  );
}

function FormUsuario({ usuario, carreras, sedes, onCerrar, onGuardado }: {
  usuario: Usuario | null; carreras: Catalogo[]; sedes: Sede[]; onCerrar: () => void; onGuardado: (texto: string) => void;
}) {
  const [persona, setPersona] = useState({ tipoDocumento: 'RUT', numeroDocumento: '', nombres: '', apellidoPaterno: '', apellidoMaterno: '', email: '' });
  const [password, setPassword] = useState('');
  const [estado, setEstado] = useState<'ACTIVO' | 'BLOQUEADO'>(usuario?.estado ?? 'ACTIVO');
  const [roles, setRoles] = useState<RolFila[]>(
    usuario?.usuario_rol.map((r) => ({ rol: r.rol.codigo, carreraId: r.carrera_id ?? '', sedeId: r.sede_id ?? '' })) ?? [{ rol: 'DOCENTE', carreraId: '', sedeId: '' }],
  );
  const [error, setError] = useState('');
  const rolesApi = roles.map((r) => ({ rol: r.rol, carreraId: r.carreraId || null, sedeId: r.sedeId || null }));
  const cambiarRol = (k: number, campo: keyof RolFila, v: string) => setRoles((rs) => rs.map((r, i) => (i === k ? { ...r, [campo]: v } : r)));

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      if (usuario) {
        const v = usuarioUpdateSchema.safeParse({ estado, roles: rolesApi, ...(password ? { password } : {}) });
        if (!v.success) return setError(errores(v));
        await api(`/usuarios/${usuario.id}`, { method: 'PATCH', body: JSON.stringify(v.data) });
        onGuardado(`Usuario ${usuario.persona.nombres} ${usuario.persona.apellido_paterno} actualizado.`);
      } else {
        const v = usuarioCreateSchema.safeParse({
          ...persona,
          apellidoMaterno: persona.apellidoMaterno || undefined,
          password: password || undefined,
          roles: rolesApi,
        });
        if (!v.success) return setError(errores(v));
        await api('/usuarios', { method: 'POST', body: JSON.stringify(v.data) });
        onGuardado(`Usuario ${persona.nombres} ${persona.apellidoPaterno} creado.`);
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <Dialogo titulo={usuario ? `Editar a ${usuario.persona.nombres} ${usuario.persona.apellido_paterno}` : 'Nuevo usuario'} onCerrar={onCerrar}>
      <form onSubmit={guardar} style={{ display: 'grid', gap: '0.75rem' }}>
        {!usuario && (
          <div className="campos">
            <label>
              Documento
              <select value={persona.tipoDocumento} onChange={(e) => setPersona({ ...persona, tipoDocumento: e.target.value })}>
                <option value="RUT">RUT</option><option value="PAS">Pasaporte</option><option value="DNI">DNI extranjero</option>
              </select>
            </label>
            <label>Número<input value={persona.numeroDocumento} onChange={(e) => setPersona({ ...persona, numeroDocumento: e.target.value })} placeholder={persona.tipoDocumento === 'RUT' ? '12.345.678-5' : ''} required /></label>
            <label>Nombres<input value={persona.nombres} onChange={(e) => setPersona({ ...persona, nombres: e.target.value })} required /></label>
            <label>Apellido paterno<input value={persona.apellidoPaterno} onChange={(e) => setPersona({ ...persona, apellidoPaterno: e.target.value })} required /></label>
            <label>Apellido materno<input value={persona.apellidoMaterno} onChange={(e) => setPersona({ ...persona, apellidoMaterno: e.target.value })} /></label>
            <label>Correo institucional<input type="email" value={persona.email} onChange={(e) => setPersona({ ...persona, email: e.target.value })} required /></label>
          </div>
        )}
        <div className="campos">
          <label>
            {usuario ? 'Nueva contraseña (opcional)' : 'Contraseña inicial (opcional si entrará con cuenta institucional)'}
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} autoComplete="new-password" />
          </label>
          {usuario && (
            <label>
              Estado
              <select value={estado} onChange={(e) => setEstado(e.target.value as 'ACTIVO' | 'BLOQUEADO')}>
                <option value="ACTIVO">Activo</option><option value="BLOQUEADO">Bloqueado (no puede entrar)</option>
              </select>
            </label>
          )}
        </div>
        <fieldset className="grupo">
          <legend>Roles y ámbito (sin carrera ni sede = toda la institución)</legend>
          {roles.map((r, k) => (
            <div key={k} className="campos" style={{ alignItems: 'end', marginBottom: 8 }}>
              <label>
                Rol
                <select value={r.rol} onChange={(e) => cambiarRol(k, 'rol', e.target.value)}>
                  {ROLES.map((x) => <option key={x} value={x}>{NOMBRE_ROL[x]}</option>)}
                </select>
              </label>
              <label>
                Carrera
                <select value={r.carreraId} onChange={(e) => cambiarRol(k, 'carreraId', e.target.value)}>
                  <option value="">Todas</option>
                  {carreras.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </label>
              <label>
                Sede
                <select value={r.sedeId} onChange={(e) => cambiarRol(k, 'sedeId', e.target.value)}>
                  <option value="">Todas</option>
                  {sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              </label>
              <div><button type="button" className="sec chico" disabled={roles.length === 1} onClick={() => setRoles(roles.filter((_, i) => i !== k))}>Quitar</button></div>
            </div>
          ))}
          <button type="button" className="sec chico" onClick={() => setRoles([...roles, { rol: 'DOCENTE', carreraId: '', sedeId: '' }])}>+ Agregar rol</button>
        </fieldset>
        {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="sec" onClick={onCerrar}>Volver</button>
          <button type="submit">{usuario ? 'Guardar cambios' : 'Crear usuario'}</button>
        </div>
      </form>
    </Dialogo>
  );
}
