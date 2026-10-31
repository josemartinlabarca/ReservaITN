'use client';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { api, guardarSesion, type Sesion } from '@/lib/api';

export default function Login() {
  const router = useRouter();
  const [error, setError] = useState('');
  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      const s = await api<Sesion>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: f.get('email'), password: f.get('password') }),
      });
      guardarSesion(s);
      // Quien no ve el dashboard (docentes, estudiantes) entra directo a reservar
      router.replace(s.usuario.permisos.includes('dashboard:ver') ? '/dashboard' : '/reservar');
    } catch (err) {
      setError((err as Error).message);
    }
  }
  return (
    <main style={{ maxWidth: 380, marginTop: '10vh' }}>
      <form className="card" onSubmit={enviar} style={{ display: 'grid', gap: '1rem' }}>
        <h1 style={{ margin: 0 }}>ReservaITN</h1>
        <label>Correo institucional<input name="email" type="email" required defaultValue="subdireccion@itn.cl" /></label>
        <label>Contraseña<input name="password" type="password" required /></label>
        {error && <p className="error">{error}</p>}
        <button type="submit">Ingresar</button>
      </form>
    </main>
  );
}
