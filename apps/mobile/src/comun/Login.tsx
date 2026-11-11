import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { API_URL, api, type Sesion } from '../api';
import { Aviso, Boton, Campo, colores } from '../ui';

export function Login({ onIngreso }: { onIngreso: (s: Sesion) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  async function ingresar() {
    setError('');
    setCargando(true);
    try {
      onIngreso(await api<Sesion>('/auth/login', { method: 'POST', body: JSON.stringify({ email: email.trim(), password }) }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colores.fondo }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'center' }}>
        <View style={{ padding: 24, gap: 14 }}>
          <View style={{ backgroundColor: colores.institucional, borderRadius: 12, padding: 20 }}>
            <Text style={{ fontSize: 26, fontWeight: '700', color: '#fff' }}>ReservaITN</Text>
            <Text style={{ color: '#c7d2e8' }}>Instituto Técnico del Norte · Reservas de salas y laboratorios</Text>
          </View>
          <Campo etiqueta="Correo institucional" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" placeholder="nombre@itn.cl" />
          <Campo etiqueta="Contraseña" value={password} onChangeText={setPassword} secureTextEntry />
          {!!error && <Aviso ok={false} texto={error} />}
          <Boton titulo="Ingresar" onPress={ingresar} cargando={cargando} deshabilitado={!email || !password} />
          <Text style={{ color: colores.suave, fontSize: 11, textAlign: 'center' }}>Servidor: {API_URL}</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
