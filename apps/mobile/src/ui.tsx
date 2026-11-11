import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native';

export const colores = {
  fondo: '#f3f5f9',
  superficie: '#ffffff',
  texto: '#16191f',
  suave: '#5d6573',
  borde: '#dde1e7',
  acento: '#1f5fbf',
  institucional: '#1f3864',
  error: '#b42318',
  ok: '#1c7c4a',
};

const ESTADOS: Record<string, { fondo: string; texto: string; nombre: string }> = {
  APROBADA: { fondo: '#e2f0d9', texto: '#1c5a32', nombre: 'Aprobada' },
  PENDIENTE: { fondo: '#fff2cc', texto: '#7a5500', nombre: 'Pendiente' },
  CANCELADA: { fondo: '#fbe4e4', texto: '#9b1c1c', nombre: 'Cancelada' },
  RECHAZADA: { fondo: '#fbe4e4', texto: '#9b1c1c', nombre: 'Rechazada' },
  EXPIRADA: { fondo: '#ededed', texto: '#444', nombre: 'Expiró' },
  LIBERADA: { fondo: '#ededed', texto: '#444', nombre: 'Liberada' },
};

export function Boton({ titulo, onPress, variante = 'primario', deshabilitado, cargando }: {
  titulo: string;
  onPress: () => void;
  variante?: 'primario' | 'secundario' | 'peligro';
  deshabilitado?: boolean;
  cargando?: boolean;
}) {
  const inactivo = deshabilitado || cargando;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactivo}
      style={({ pressed }) => [s.boton, s[variante], inactivo && { opacity: 0.45 }, pressed && { opacity: 0.8 }]}
    >
      {cargando ? (
        <ActivityIndicator color={variante === 'secundario' ? colores.texto : '#fff'} />
      ) : (
        <Text style={[s.botonTexto, variante === 'secundario' && { color: colores.texto }]}>{titulo}</Text>
      )}
    </Pressable>
  );
}

export function Campo({ etiqueta, ...props }: TextInputProps & { etiqueta: string }) {
  return (
    <View style={{ gap: 4, flex: 1 }}>
      <Text style={s.etiqueta}>{etiqueta}</Text>
      <TextInput style={s.input} placeholderTextColor={colores.suave} {...props} />
    </View>
  );
}

export function Tarjeta({ children }: { children: ReactNode }) {
  return <View style={s.tarjeta}>{children}</View>;
}

export function Titulo({ children }: { children: ReactNode }) {
  return <Text style={s.titulo}>{children}</Text>;
}

export function Etiqueta({ children }: { children: ReactNode }) {
  return <Text style={s.etiqueta}>{children}</Text>;
}

export function Insignia({ estado }: { estado: string }) {
  const e = ESTADOS[estado] ?? { fondo: '#eee', texto: '#333', nombre: estado };
  return (
    <View style={[s.insignia, { backgroundColor: e.fondo }]}>
      <Text style={{ color: e.texto, fontWeight: '700', fontSize: 12 }}>{e.nombre}</Text>
    </View>
  );
}

export function Aviso({ ok, texto }: { ok: boolean; texto: string }) {
  return (
    <View style={[s.aviso, { borderColor: ok ? colores.ok : colores.error, backgroundColor: ok ? '#eef8f1' : '#fdf0ef' }]}>
      <Text style={{ color: ok ? colores.ok : colores.error }}>{texto}</Text>
    </View>
  );
}

/** Opciones como fichas tocables (alternativa simple a un selector desplegable). */
export function Fichas<T extends string>({ opciones, valor, onCambio }: {
  opciones: { valor: T; texto: string }[];
  valor: T | null;
  onCambio: (v: T) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {opciones.map((o) => (
        <Pressable key={o.valor} onPress={() => onCambio(o.valor)} style={[s.ficha, valor === o.valor && s.fichaActiva]}>
          <Text style={{ color: valor === o.valor ? '#fff' : colores.texto, fontWeight: '600' }}>{o.texto}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  boton: { paddingVertical: 13, paddingHorizontal: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', minHeight: 46 },
  primario: { backgroundColor: colores.acento },
  secundario: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colores.borde },
  peligro: { backgroundColor: colores.error },
  botonTexto: { color: '#fff', fontWeight: '600', fontSize: 15 },
  etiqueta: { color: colores.suave, fontSize: 13 },
  input: { borderWidth: 1, borderColor: colores.borde, borderRadius: 8, padding: 12, backgroundColor: '#fff', color: colores.texto, fontSize: 15 },
  tarjeta: { backgroundColor: colores.superficie, borderRadius: 10, borderWidth: 1, borderColor: colores.borde, padding: 14, gap: 8 },
  titulo: { fontSize: 18, fontWeight: '700', color: colores.texto },
  insignia: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  aviso: { borderWidth: 1, borderRadius: 8, padding: 12 },
  ficha: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: colores.borde, backgroundColor: '#fff' },
  fichaActiva: { backgroundColor: colores.acento, borderColor: colores.acento },
});
