import { useState } from 'react';
import { SafeAreaView, Text, View } from 'react-native';
import { api, type Sesion } from '../api';
import { Boton, Campo, colores } from '../ui';

export function Login({ onIngreso }: { onIngreso: (s: Sesion) => void }) {
  const [email, setEmail] = useState('docente@itn.cl');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function ingresar() {
    try {
      onIngreso(await api<Sesion>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, justifyContent: 'center', backgroundColor: colores.fondo }}>
      <View style={{ padding: 24, gap: 14 }}>
        <Text style={{ fontSize: 26, fontWeight: '700' }}>ReservaITN</Text>
        <Campo etiqueta="Correo institucional" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <Campo etiqueta="Contraseña" value={password} onChangeText={setPassword} secureTextEntry />
        {!!error && <Text style={{ color: colores.error }}>{error}</Text>}
        <Boton titulo="Ingresar" onPress={ingresar} />
      </View>
    </SafeAreaView>
  );
}
