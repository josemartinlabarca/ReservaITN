import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { alExpirarSesion, api, cargarSesion, guardarSesion, tiene, type Sesion } from './api';
import { colores } from './ui';
import { Login } from './comun/Login';
import { Notificaciones } from './comun/Notificaciones';
import { EscanerQR } from './comun/EscanerQR';
import { registrarPush } from './comun/push';
import { Reservar } from './docentes/Reservar';
import { MisReservas } from './docentes/MisReservas';
import { Inventario } from './mantencion/Inventario';
import { ReporteDanio } from './mantencion/ReporteDanio';

type Pestana = 'reservar' | 'mias' | 'inventario' | 'danio' | 'avisos';
const CONSULTA_AVISOS_MS = 30_000;

/**
 * Una sola app con pestañas según los permisos de la persona (ADR 0003):
 * docentes y estudiantes reservan y hacen check-in (E11); aseo y mantención cuentan inventario y
 * reportan daños (E12). Todos ven sus avisos.
 */
export default function App() {
  return (
    <SafeAreaProvider>
      <Contenido />
    </SafeAreaProvider>
  );
}

function Contenido() {
  const [sesion, setSesion] = useState<Sesion | null | undefined>(undefined);
  const [pestana, setPestana] = useState<Pestana>('reservar');
  const [noLeidas, setNoLeidas] = useState(0);
  const [escaner, setEscaner] = useState(false);
  const [version, setVersion] = useState(0); // fuerza recargar listas tras reservar o hacer check-in

  const pestanas: { id: Pestana; texto: string }[] = sesion
    ? [
        ...(tiene('reserva:solicitar') ? [{ id: 'reservar' as const, texto: 'Reservar' }, { id: 'mias' as const, texto: 'Mis reservas' }] : []),
        ...(tiene('inventario:registrar') ? [{ id: 'inventario' as const, texto: 'Inventario' }] : []),
        ...(tiene('danio:reportar') ? [{ id: 'danio' as const, texto: 'Daños' }] : []),
        { id: 'avisos' as const, texto: noLeidas ? `Avisos (${noLeidas})` : 'Avisos' },
      ]
    : [];

  const entrar = useCallback((s: Sesion | null) => {
    setSesion(s);
    if (!s) return;
    setPestana(s.usuario.permisos.includes('reserva:solicitar') ? 'reservar' : s.usuario.permisos.includes('inventario:registrar') ? 'inventario' : 'avisos');
    registrarPush(); // silencioso: en Expo Go no aplica
  }, []);

  useEffect(() => {
    alExpirarSesion(() => setSesion(null));
    cargarSesion().then(entrar);
  }, [entrar]);

  const contarAvisos = useCallback(() => {
    api<{ total: number }>('/notificaciones/no-leidas').then((r) => setNoLeidas(r.total)).catch(() => {});
  }, []);
  useEffect(() => {
    if (!sesion) return;
    contarAvisos();
    const t = setInterval(contarAvisos, CONSULTA_AVISOS_MS);
    return () => clearInterval(t);
  }, [sesion, contarAvisos]);

  if (sesion === undefined) return null;
  if (!sesion)
    return (
      <Login
        onIngreso={async (s) => {
          await guardarSesion(s);
          entrar(s);
        }}
      />
    );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colores.fondo }} edges={['top', 'left', 'right']}>
      <StatusBar style="light" />
      <View style={{ backgroundColor: colores.institucional, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#fff' }}>ReservaITN</Text>
          <Text style={{ color: '#c7d2e8', fontSize: 12 }}>{sesion.usuario.nombre}</Text>
        </View>
        <Pressable onPress={async () => { await guardarSesion(null); setSesion(null); }} hitSlop={10}>
          <Text style={{ color: '#fff' }}>Salir</Text>
        </Pressable>
      </View>

      <View style={{ flex: 1 }}>
        {pestana === 'reservar' && <Reservar alReservar={() => setVersion((v) => v + 1)} />}
        {pestana === 'mias' && <MisReservas abrirEscaner={() => setEscaner(true)} version={version} />}
        {pestana === 'inventario' && <Inventario />}
        {pestana === 'danio' && <ReporteDanio />}
        {pestana === 'avisos' && <Notificaciones alLeer={contarAvisos} version={version} />}
      </View>

      <SafeAreaView edges={['bottom']} style={{ backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: colores.borde }}>
        <View style={{ flexDirection: 'row' }}>
          {pestanas.map((p) => (
            <Pressable key={p.id} onPress={() => { setPestana(p.id); if (p.id === 'avisos') contarAvisos(); }} style={{ flex: 1, paddingVertical: 12, alignItems: 'center', borderTopWidth: 3, borderTopColor: pestana === p.id ? colores.acento : 'transparent' }}>
              <Text style={{ fontSize: 13, fontWeight: pestana === p.id ? '700' : '500', color: pestana === p.id ? colores.acento : colores.suave }}>{p.texto}</Text>
            </Pressable>
          ))}
        </View>
      </SafeAreaView>

      <EscanerQR visible={escaner} onCerrar={() => setEscaner(false)} onListo={() => setVersion((v) => v + 1)} />
    </SafeAreaView>
  );
}
