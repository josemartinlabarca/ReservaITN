import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, Text } from 'react-native';
import { api } from '../api';
import { Tarjeta, colores } from '../ui';

interface Notificacion { id: string; titulo: string; cuerpo: string; leida: boolean; creadaEn: string }

/** Bandeja de avisos (R6). Las notificaciones push se agregan en el sprint 3 (expo-notifications). */
export function Notificaciones() {
  const [items, setItems] = useState<Notificacion[]>([]);
  const [cargando, setCargando] = useState(false);
  const cargar = useCallback(async () => {
    setCargando(true);
    try { setItems(await api<Notificacion[]>('/notificaciones/mias')); } finally { setCargando(false); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 10 }}
      data={items}
      keyExtractor={(n) => n.id}
      refreshControl={<RefreshControl refreshing={cargando} onRefresh={cargar} />}
      ListEmptyComponent={<Text style={{ color: colores.suave }}>Sin avisos.</Text>}
      renderItem={({ item }) => (
        <Tarjeta>
          <Text style={{ fontWeight: item.leida ? '400' : '700' }}>{item.titulo}</Text>
          <Text style={{ color: colores.suave }}>{item.cuerpo}</Text>
          <Text style={{ color: colores.suave, fontSize: 12 }}>{new Date(item.creadaEn).toLocaleString('es-CL')}</Text>
        </Tarjeta>
      )}
    />
  );
}
