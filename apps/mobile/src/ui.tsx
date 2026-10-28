import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native';

export const colores = { fondo: '#f6f7f9', texto: '#16191f', suave: '#5d6573', borde: '#dde1e7', acento: '#1f5fbf', error: '#b42318', ok: '#1c7c4a' };

export function Boton({ titulo, onPress, secundario }: { titulo: string; onPress: () => void; secundario?: boolean }) {
  return (
    <Pressable onPress={onPress} style={[s.boton, secundario && s.botonSec]}>
      <Text style={[s.botonTexto, secundario && { color: colores.texto }]}>{titulo}</Text>
    </Pressable>
  );
}

export function Campo({ etiqueta, ...props }: TextInputProps & { etiqueta: string }) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={{ color: colores.suave }}>{etiqueta}</Text>
      <TextInput style={s.input} placeholderTextColor={colores.suave} {...props} />
    </View>
  );
}

export function Tarjeta({ children }: { children: ReactNode }) {
  return <View style={s.tarjeta}>{children}</View>;
}

const s = StyleSheet.create({
  boton: { backgroundColor: colores.acento, padding: 14, borderRadius: 8, alignItems: 'center' },
  botonSec: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colores.borde },
  botonTexto: { color: '#fff', fontWeight: '600' },
  input: { borderWidth: 1, borderColor: colores.borde, borderRadius: 8, padding: 12, backgroundColor: '#fff', color: colores.texto },
  tarjeta: { backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: colores.borde, padding: 14, gap: 6 },
});
