import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import { post } from '../api';

export type ResultadoPush = 'registrado' | 'no-disponible' | 'sin-permiso' | 'error';

/**
 * Registra el celular para notificaciones push (R6). Requiere una compilación propia de la app
 * (EAS) con su projectId: Expo Go ya no recibe push remotos desde la SDK 53, así que ahí se omite
 * sin error y los avisos siguen llegando a la bandeja de la app y por correo.
 */
export async function registrarPush(): Promise<ResultadoPush> {
  const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!Device.isDevice || Constants.executionEnvironment === ExecutionEnvironment.StoreClient || !projectId) return 'no-disponible';
  try {
    const Notifications = await import('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: true }),
    });
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', { name: 'Avisos', importance: Notifications.AndroidImportance.HIGH });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return 'sin-permiso';
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await post('/notificaciones/dispositivos', { token, plataforma: Platform.OS === 'ios' ? 'IOS' : 'ANDROID' });
    return 'registrado';
  } catch {
    return 'error';
  }
}
