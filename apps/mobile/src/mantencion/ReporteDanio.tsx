import { useEffect, useState } from 'react';
import { ScrollView } from 'react-native';
import { reporteDanioSchema } from '@reservaitn/shared';
import { api, post } from '../api';
import { Aviso, Boton, Campo, Etiqueta, Fichas, Titulo } from '../ui';

interface Espacio { id: string; codigo: string; nombre: string }
interface ItemEsperado { item: { id: string; nombre: string } }
const SEVERIDADES = [
  { valor: 'BAJA' as const, texto: 'Baja' },
  { valor: 'MEDIA' as const, texto: 'Media' },
  { valor: 'ALTA' as const, texto: 'Alta (impide usar la sala)' },
];

/**
 * Reporte de daños (R17 / E12): sala, ítem dañado (opcional), gravedad y descripción. Llega a
 * Operaciones como aviso y queda en la bandeja de daños para crear la orden de trabajo.
 * Interfaz simple a propósito (riesgo de brecha digital del personal, interesado I5).
 */
export function ReporteDanio() {
  const [espacios, setEspacios] = useState<Espacio[]>([]);
  const [espacioId, setEspacioId] = useState<string | null>(null);
  const [items, setItems] = useState<ItemEsperado[]>([]);
  const [itemId, setItemId] = useState<string | null>(null);
  const [severidad, setSeveridad] = useState<'BAJA' | 'MEDIA' | 'ALTA'>('MEDIA');
  const [descripcion, setDescripcion] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    api<Espacio[]>('/espacios').then(setEspacios).catch((e) => setMsg({ ok: false, texto: (e as Error).message }));
  }, []);
  useEffect(() => {
    setItemId(null);
    if (espacioId) api<ItemEsperado[]>(`/mantencion/espacios/${espacioId}/inventario`).then(setItems).catch(() => setItems([]));
  }, [espacioId]);

  async function enviar() {
    const datos = { espacioId: espacioId ?? '', itemId: itemId ?? undefined, descripcion, severidad };
    const v = reporteDanioSchema.safeParse(datos);
    if (!v.success) return setMsg({ ok: false, texto: espacioId ? v.error.issues[0].message : 'Elige la sala' });
    setEnviando(true);
    try {
      await post('/mantencion/danios', datos);
      setMsg({ ok: true, texto: '✓ Reporte enviado al encargado de operaciones.' });
      setDescripcion('');
      setItemId(null);
    } catch (e) {
      setMsg({ ok: false, texto: (e as Error).message });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }} keyboardShouldPersistTaps="handled">
      <Titulo>Reportar daño</Titulo>
      <Etiqueta>1. Sala</Etiqueta>
      <Fichas opciones={espacios.map((e) => ({ valor: e.id, texto: e.codigo }))} valor={espacioId} onCambio={setEspacioId} />
      {items.length > 0 && (
        <>
          <Etiqueta>2. ¿Qué está dañado? (opcional)</Etiqueta>
          <Fichas opciones={items.map((i) => ({ valor: i.item.id, texto: i.item.nombre }))} valor={itemId} onCambio={setItemId} />
        </>
      )}
      <Etiqueta>3. Gravedad</Etiqueta>
      <Fichas opciones={SEVERIDADES} valor={severidad} onCambio={setSeveridad} />
      <Campo etiqueta="4. ¿Qué pasó?" value={descripcion} onChangeText={setDescripcion} multiline placeholder="Ej. el proyector no enciende" />
      <Boton titulo="Enviar reporte" onPress={enviar} cargando={enviando} />
      {msg && <Aviso ok={msg.ok} texto={msg.texto} />}
    </ScrollView>
  );
}
