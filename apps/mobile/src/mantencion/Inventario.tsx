import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { api, post } from '../api';
import { Aviso, Boton, Campo, Etiqueta, Fichas, Tarjeta, Titulo, colores } from '../ui';

interface Espacio { id: string; codigo: string; nombre: string }
interface ItemEsperado { cantidad_esperada: number; item: { id: string; codigo: string; nombre: string } }
interface Diferencia { nombre: string; cantidad_esperada: number; cantidad_contada: number; diferencia: number }

/**
 * Conteo de inventario por sala (R17 / E12 / D17). Parte de la cantidad esperada; quien cuenta
 * ajusta con + y −. Al guardar, el sistema muestra las diferencias (faltantes o sobrantes).
 */
export function Inventario() {
  const [espacios, setEspacios] = useState<Espacio[]>([]);
  const [espacioId, setEspacioId] = useState<string | null>(null);
  const [esperado, setEsperado] = useState<ItemEsperado[]>([]);
  const [conteo, setConteo] = useState<Record<string, number>>({});
  const [observacion, setObservacion] = useState('');
  const [resultado, setResultado] = useState<Diferencia[] | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    api<Espacio[]>('/espacios').then(setEspacios).catch((e) => setMsg({ ok: false, texto: (e as Error).message }));
  }, []);

  useEffect(() => {
    if (!espacioId) return;
    setResultado(null);
    setMsg(null);
    api<ItemEsperado[]>(`/mantencion/espacios/${espacioId}/inventario`)
      .then((items) => {
        setEsperado(items);
        setConteo(Object.fromEntries(items.map((i) => [i.item.id, i.cantidad_esperada])));
      })
      .catch((e) => setMsg({ ok: false, texto: (e as Error).message }));
  }, [espacioId]);

  const ajustar = (id: string, delta: number) => setConteo((c) => ({ ...c, [id]: Math.max(0, (c[id] ?? 0) + delta) }));

  async function guardar() {
    setGuardando(true);
    try {
      const r = await post<{ diferencias: Diferencia[] }>('/mantencion/inspecciones', {
        espacioId,
        observacion: observacion || undefined,
        items: esperado.map((i) => ({ itemId: i.item.id, cantidad: conteo[i.item.id] ?? 0 })),
      });
      setResultado(r.diferencias);
      setObservacion('');
    } catch (e) {
      setMsg({ ok: false, texto: (e as Error).message });
    } finally {
      setGuardando(false);
    }
  }

  const espacio = espacios.find((e) => e.id === espacioId);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }} keyboardShouldPersistTaps="handled">
      <Titulo>Inventario de sala</Titulo>
      <Etiqueta>1. Elige la sala</Etiqueta>
      <Fichas opciones={espacios.map((e) => ({ valor: e.id, texto: e.codigo }))} valor={espacioId} onCambio={setEspacioId} />
      {msg && <Aviso ok={msg.ok} texto={msg.texto} />}

      {espacio && esperado.length === 0 && !msg && <Text style={{ color: colores.suave }}>Esta sala no tiene inventario registrado.</Text>}

      {espacio && esperado.length > 0 && !resultado && (
        <>
          <Etiqueta>2. Cuenta lo que hay en {espacio.codigo} ({espacio.nombre})</Etiqueta>
          {esperado.map((i) => {
            const n = conteo[i.item.id] ?? 0;
            const distinto = n !== i.cantidad_esperada;
            return (
              <Tarjeta key={i.item.id}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexShrink: 1 }}>
                    <Text style={{ fontWeight: '700', fontSize: 16 }}>{i.item.nombre}</Text>
                    <Text style={{ color: distinto ? colores.error : colores.suave }}>Esperado: {i.cantidad_esperada}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <Pressable onPress={() => ajustar(i.item.id, -1)} style={paso} accessibilityLabel={`Restar ${i.item.nombre}`}><Text style={pasoTexto}>−</Text></Pressable>
                    <Text style={{ fontSize: 20, fontWeight: '700', minWidth: 36, textAlign: 'center' }}>{n}</Text>
                    <Pressable onPress={() => ajustar(i.item.id, 1)} style={paso} accessibilityLabel={`Sumar ${i.item.nombre}`}><Text style={pasoTexto}>+</Text></Pressable>
                  </View>
                </View>
              </Tarjeta>
            );
          })}
          <Campo etiqueta="Observación (opcional)" value={observacion} onChangeText={setObservacion} multiline placeholder="Ej. faltan dos sillas, se movieron a A-102" />
          <Boton titulo="Guardar conteo" onPress={guardar} cargando={guardando} />
        </>
      )}

      {resultado && (
        <Tarjeta>
          {resultado.length === 0 ? (
            <Text style={{ color: colores.ok, fontWeight: '700' }}>✓ Inventario completo: todo coincide.</Text>
          ) : (
            <>
              <Text style={{ fontWeight: '700' }}>Conteo guardado. Diferencias encontradas:</Text>
              {resultado.map((d) => (
                <Text key={d.nombre} style={{ color: d.diferencia < 0 ? colores.error : colores.texto }}>
                  {d.nombre}: {d.cantidad_contada} de {d.cantidad_esperada} ({d.diferencia > 0 ? '+' : ''}{d.diferencia})
                </Text>
              ))}
              <Text style={{ color: colores.suave }}>Si falta algo o está dañado, usa “Reportar daño”.</Text>
            </>
          )}
          <Boton titulo="Contar otra sala" variante="secundario" onPress={() => { setEspacioId(null); setResultado(null); setEsperado([]); }} />
        </Tarjeta>
      )}
    </ScrollView>
  );
}

const paso = { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colores.borde, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: '#fff' };
const pasoTexto = { fontSize: 22, fontWeight: '700' as const, color: colores.acento };
