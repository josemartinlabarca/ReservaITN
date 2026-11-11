import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { api } from '../api';
import { Aviso, colores } from '../ui';

interface Notificacion { id: string; titulo: string; cuerpo: string; leida_en: string | null; creado_en: string }

/** Bandeja de avisos (R6). Al tocar un aviso se marca como leído. */
export function Notificaciones({ alLeer, version }: { alLeer: () => void; version: number }) {
  const [items, setItems] = useState<Notificacion[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setItems(await api<Notificacion[]>('/notificaciones/mias'));
      setError('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar, version]);

  async function leer(n: Notificacion) {
    if (n.leida_en) return;
    setItems((xs) => xs.map((x) => (x.id === n.id ? { ...x, leida_en: new Date().toISOString() } : x)));
    await api(`/notificaciones/${n.id}/leida`, { method: 'PATCH' }).catch(() => {});
    alLeer();
  }

  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 10 }}
      data={items}
      keyExtractor={(n) => n.id}
      refreshControl={<RefreshControl refreshing={cargando} onRefresh={cargar} />}
      ListHeaderComponent={error ? <Aviso ok={false} texto={error} /> : undefined}
      ListEmptyComponent={!cargando ? <Text style={{ color: colores.suave }}>Sin avisos por ahora.</Text> : undefined}
      renderItem={({ item }) => (
        <Pressable onPress={() => leer(item)}>
          <View style={{ backgroundColor: item.leida_en ? '#fff' : '#eef3fc', borderRadius: 10, borderWidth: 1, borderColor: item.leida_en ? colores.borde : '#b9cdf0', padding: 14, gap: 4 }}>
            <Text style={{ fontWeight: item.leida_en ? '500' : '700', fontSize: 15 }}>{!item.leida_en ? '● ' : ''}{item.titulo}</Text>
            <Text style={{ color: colores.texto }}>{item.cuerpo}</Text>
            <Text style={{ color: colores.suave, fontSize: 12 }}>{new Date(item.creado_en).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })}</Text>
          </View>
        </Pressable>
      )}
    />
  );
}
