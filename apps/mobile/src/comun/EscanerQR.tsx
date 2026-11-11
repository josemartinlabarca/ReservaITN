import { useRef, useState } from 'react';
import { Modal, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import { tokenDesdeQr } from '@reservaitn/shared';
import { post } from '../api';
import { Aviso, Boton, colores } from '../ui';

/**
 * Check-in con el código QR pegado en la sala (R18, D15). La API busca la reserva aprobada en
 * curso del usuario en ese espacio y la confirma; así la sala no se libera.
 */
export function EscanerQR({ visible, onCerrar, onListo }: { visible: boolean; onCerrar: () => void; onListo: () => void }) {
  const [permiso, pedirPermiso] = useCameraPermissions();
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const procesando = useRef(false);

  async function leido(texto: string) {
    if (procesando.current || msg?.ok) return;
    procesando.current = true;
    const token = tokenDesdeQr(texto);
    if (!token) {
      setMsg({ ok: false, texto: 'Este código QR no es de ReservaITN. Escanea el que está en la puerta de la sala.' });
      setTimeout(() => (procesando.current = false), 2000);
      return;
    }
    try {
      await post('/reservas/check-in', { token });
      setMsg({ ok: true, texto: '✓ Check-in registrado. ¡Que te vaya bien!' });
      onListo();
    } catch (e) {
      setMsg({ ok: false, texto: (e as Error).message });
      setTimeout(() => (procesando.current = false), 2500);
    }
  }

  function cerrar() {
    setMsg(null);
    procesando.current = false;
    onCerrar();
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={cerrar}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
        <View style={{ padding: 16 }}>
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>Escanea el QR de la sala</Text>
          <Text style={{ color: '#ccc' }}>Apunta la cámara al código pegado en la puerta.</Text>
        </View>
        {!permiso ? null : !permiso.granted ? (
          <View style={{ flex: 1, padding: 16, gap: 12, justifyContent: 'center' }}>
            <Text style={{ color: '#fff' }}>ReservaITN necesita la cámara solo para leer el código QR de la sala.</Text>
            <Boton titulo="Permitir cámara" onPress={pedirPermiso} />
          </View>
        ) : (
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={msg?.ok ? undefined : ({ data }) => leido(data)}
          />
        )}
        <View style={{ padding: 16, gap: 10, backgroundColor: colores.fondo }}>
          {msg && <Aviso ok={msg.ok} texto={msg.texto} />}
          <Boton titulo={msg?.ok ? 'Listo' : 'Cerrar'} variante={msg?.ok ? 'primario' : 'secundario'} onPress={cerrar} />
        </View>
      </SafeAreaView>
    </Modal>
  );
}
