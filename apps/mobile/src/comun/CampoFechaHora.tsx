import { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { colores } from '../ui';

const dosDigitos = (n: number) => String(n).padStart(2, '0');
export const hhmm = (d: Date) => `${dosDigitos(d.getHours())}:${dosDigitos(d.getMinutes())}`;
export const fechaLarga = (d: Date) => d.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });

/**
 * Selector nativo de fecha u hora (al minuto). En Android abre el diálogo del sistema al tocar el
 * campo; en iOS se muestra el selector compacto integrado.
 */
export function CampoFechaHora({ etiqueta, valor, modo, onCambio, minimo }: {
  etiqueta: string;
  valor: Date;
  modo: 'date' | 'time';
  onCambio: (d: Date) => void;
  minimo?: Date;
}) {
  const [abierto, setAbierto] = useState(false);
  const alCambiar = (e: DateTimePickerEvent, d?: Date) => {
    setAbierto(false);
    if (e.type === 'set' && d) onCambio(d);
  };

  return (
    <View style={{ gap: 4, flex: 1 }}>
      <Text style={{ color: colores.suave, fontSize: 13 }}>{etiqueta}</Text>
      {Platform.OS === 'ios' ? (
        <DateTimePicker value={valor} mode={modo} display="compact" locale="es-CL" minimumDate={minimo} onChange={alCambiar} style={{ alignSelf: 'flex-start' }} />
      ) : (
        <>
          <Pressable
            onPress={() => setAbierto(true)}
            style={{ borderWidth: 1, borderColor: colores.borde, borderRadius: 8, padding: 12, backgroundColor: '#fff' }}
          >
            <Text style={{ fontSize: 15, color: colores.texto }}>{modo === 'date' ? fechaLarga(valor) : hhmm(valor)}</Text>
          </Pressable>
          {abierto && <DateTimePicker value={valor} mode={modo} is24Hour minimumDate={minimo} onChange={alCambiar} />}
        </>
      )}
    </View>
  );
}
