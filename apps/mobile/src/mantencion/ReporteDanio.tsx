import { useEffect, useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { reporteDanioSchema } from '@reservaitn/shared';
import { api } from '../api';
import { Boton, Campo, Tarjeta, colores } from '../ui';

interface Sala { id: string; codigo: string; sede: { nombre: string } }
const SEVERIDADES = ['BAJA', 'MEDIA', 'ALTA'] as const;

/**
 * App de aseo y mantención (WBS 1.4.10 / R17 / E12): reporte de daños por sala.
 * Interfaz deliberadamente simple (riesgo de brecha digital, ver Registro de Interesados I5).
 * TODO sprint 4: conteo de inventario y foto con expo-image-picker.
 */
export function ReporteDanio() {
  const [salas, setSalas] = useState<Sala[]>([]);
  const [sala, setSala] = useState<Sala | null>(null);
  const [severidad, setSeveridad] = useState<(typeof SEVERIDADES)[number]>('MEDIA');
  const [descripcion, setDescripcion] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);

  useEffect(() => { api<Sala[]>('/salas').then(setSalas).catch(() => setSalas([])); }, []);

  async function enviar() {
    const datos = { salaId: sala?.id ?? '', descripcion, severidad };
    const v = reporteDanioSchema.safeParse(datos);
    if (!v.success) return setMsg({ ok: false, texto: sala ? v.error.issues[0].message : 'Elija una sala' });
    try {
      await api('/mantencion/danios', { method: 'POST', body: JSON.stringify(datos) });
      setMsg({ ok: true, texto: 'Reporte enviado al encargado de operaciones' });
      setDescripcion('');
    } catch (e) {
      setMsg({ ok: false, texto: (e as Error).message });
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={{ fontWeight: '700' }}>1. Sala</Text>
      {salas.map((s) => (
        <Boton key={s.id} titulo={`${s.codigo} · ${s.sede.nombre}`} secundario={sala?.id !== s.id} onPress={() => setSala(s)} />
      ))}
      <Text style={{ fontWeight: '700' }}>2. Gravedad</Text>
      {SEVERIDADES.map((x) => (
        <Boton key={x} titulo={x} secundario={severidad !== x} onPress={() => setSeveridad(x)} />
      ))}
      <Campo etiqueta="3. ¿Qué pasó?" value={descripcion} onChangeText={setDescripcion} multiline />
      <Boton titulo="Enviar reporte" onPress={enviar} />
      {msg && (
        <Tarjeta>
          <Text style={{ color: msg.ok ? colores.ok : colores.error }}>{msg.texto}</Text>
        </Tarjeta>
      )}
    </ScrollView>
  );
}
