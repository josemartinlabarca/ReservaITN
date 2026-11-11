import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, RefreshControl, Text, View } from 'react-native';
import { api, post } from '../api';
import { Aviso, Boton, Insignia, Tarjeta, colores } from '../ui';
import { fechaLarga, hhmm } from '../comun/CampoFechaHora';

interface MiReserva {
  id: string;
  inicio: string;
  fin: string;
  estado: string;
  espacio: { codigo: string; nombre: string };
  solicitud: { descripcion: string };
  check_in: { registrado_en: string } | null;
  cancelacion: { motivo: string | null } | null;
}

const ANTICIPACION_CHECK_IN_MIN = 15;

/** ¿Se puede hacer check-in ahora? Aprobada, sin check-in y entre 15 min antes y el término. */
export function puedeCheckIn(r: MiReserva, ahora = new Date()) {
  const ini = new Date(r.inicio).getTime() - ANTICIPACION_CHECK_IN_MIN * 60_000;
  return r.estado === 'APROBADA' && !r.check_in && ahora.getTime() >= ini && ahora < new Date(r.fin);
}

/** Mis reservas: estado, motivo si se canceló, check-in con QR (R18) y cancelación. */
export function MisReservas({ abrirEscaner, version }: { abrirEscaner: () => void; version: number }) {
  const [items, setItems] = useState<MiReserva[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setItems(await api<MiReserva[]>('/reservas/mias'));
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

  function cancelar(r: MiReserva) {
    Alert.alert('Cancelar reserva', `¿Cancelar ${r.espacio.codigo} el ${fechaLarga(new Date(r.inicio))}?`, [
      { text: 'Volver', style: 'cancel' },
      {
        text: 'Cancelar reserva',
        style: 'destructive',
        onPress: () => post(`/reservas/${r.id}/cancelar`).then(cargar).catch((e) => setError((e as Error).message)),
      },
    ]);
  }

  const proximaConCheckIn = items.find((r) => puedeCheckIn(r));

  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 10 }}
      data={items}
      keyExtractor={(r) => r.id}
      refreshControl={<RefreshControl refreshing={cargando} onRefresh={cargar} />}
      ListHeaderComponent={
        <View style={{ gap: 10, marginBottom: 4 }}>
          {proximaConCheckIn && (
            <Tarjeta>
              <Text style={{ fontWeight: '700' }}>Tu reserva en {proximaConCheckIn.espacio.codigo} ya comenzó o está por comenzar</Text>
              <Text style={{ color: colores.suave }}>Escanea el código QR de la sala para confirmar que la estás usando. Si no, se libera a los 15 minutos.</Text>
              <Boton titulo="📷 Hacer check-in" onPress={abrirEscaner} />
            </Tarjeta>
          )}
          {error ? <Aviso ok={false} texto={error} /> : null}
        </View>
      }
      ListEmptyComponent={!cargando ? <Text style={{ color: colores.suave }}>No tienes reservas próximas.</Text> : undefined}
      renderItem={({ item: r }) => {
        const activa = r.estado === 'PENDIENTE' || r.estado === 'APROBADA';
        return (
          <Tarjeta>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontWeight: '700', fontSize: 16, flexShrink: 1 }}>{r.espacio.codigo} · {r.espacio.nombre}</Text>
              <Insignia estado={r.estado} />
            </View>
            <Text style={{ color: colores.texto }}>
              {fechaLarga(new Date(r.inicio))}, {hhmm(new Date(r.inicio))}–{hhmm(new Date(r.fin))}
            </Text>
            <Text style={{ color: colores.suave }}>{r.solicitud.descripcion}</Text>
            {r.check_in && <Text style={{ color: colores.ok }}>✓ Check-in a las {hhmm(new Date(r.check_in.registrado_en))}</Text>}
            {r.cancelacion?.motivo && <Text style={{ color: colores.error }}>Motivo: {r.cancelacion.motivo}</Text>}
            {activa && new Date(r.fin) > new Date() && (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {puedeCheckIn(r) && <View style={{ flex: 1 }}><Boton titulo="Check-in" onPress={abrirEscaner} /></View>}
                <View style={{ flex: 1 }}><Boton titulo="Cancelar" variante="secundario" onPress={() => cancelar(r)} /></View>
              </View>
            )}
          </Tarjeta>
        );
      }}
    />
  );
}
