import { useEffect, useState } from 'react';
import { SafeAreaView, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { tienePermiso } from '@reservaitn/shared';
import { cargarSesion, guardarSesion, type Sesion } from './api';
import { Boton, colores } from './ui';
import { Login } from './comun/Login';
import { Disponibilidad } from './docentes/Disponibilidad';
import { Notificaciones } from './comun/Notificaciones';
import { ReporteDanio } from './mantencion/ReporteDanio';

type Pestana = 'reservar' | 'avisos' | 'danio';

/**
 * Una sola app con interfaz según el rol (E11 + E12):
 * docentes/estudiantes reservan; aseo y mantención reportan daños e inventario.
 */
export default function App() {
  const [sesion, setSesion] = useState<Sesion | null | undefined>(undefined);
  const [pestana, setPestana] = useState<Pestana>('reservar');

  useEffect(() => {
    cargarSesion().then((s) => {
      setSesion(s);
      if (s && !tienePermiso(s.usuario.rol, 'reserva:solicitar')) setPestana('danio');
    });
  }, []);

  if (sesion === undefined) return null;
  if (!sesion)
    return (
      <Login
        onIngreso={async (s) => {
          await guardarSesion(s);
          setSesion(s);
          setPestana(tienePermiso(s.usuario.rol, 'reserva:solicitar') ? 'reservar' : 'danio');
        }}
      />
    );

  const rol = sesion.usuario.rol;
  const pestanas: [Pestana, string][] = [
    ...(tienePermiso(rol, 'reserva:solicitar') ? [['reservar', 'Reservar'] as [Pestana, string]] : []),
    ...(tienePermiso(rol, 'danio:reportar') ? [['danio', 'Reportar daño'] as [Pestana, string]] : []),
    ['avisos', 'Avisos'],
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colores.fondo }}>
      <StatusBar style="auto" />
      <View style={{ padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: 18, fontWeight: '700' }}>ReservaITN</Text>
        <Text style={{ color: colores.suave }} onPress={async () => { await guardarSesion(null); setSesion(null); }}>
          {sesion.usuario.nombre} · Salir
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        {pestana === 'reservar' && <Disponibilidad />}
        {pestana === 'avisos' && <Notificaciones />}
        {pestana === 'danio' && <ReporteDanio />}
      </View>
      <View style={{ flexDirection: 'row', gap: 8, padding: 12 }}>
        {pestanas.map(([id, titulo]) => (
          <View key={id} style={{ flex: 1 }}>
            <Boton titulo={titulo} secundario={pestana !== id} onPress={() => setPestana(id)} />
          </View>
        ))}
      </View>
    </SafeAreaView>
  );
}
