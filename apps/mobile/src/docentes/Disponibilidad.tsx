import { useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { reservaCreateSchema } from '@reservaitn/shared';
import { api } from '../api';
import { Boton, Campo, Tarjeta, colores } from '../ui';

interface Sugerencia { sala: { id: string; codigo: string; capacidad: number }; esperaMin: number }

/**
 * App de docentes y estudiantes (WBS 1.4.9): consulta de disponibilidad + solicitud (R3, R10, R11).
 * El usuario indica fecha, horario y asistentes; el sistema sugiere sala y alternativas.
 * TODO sprint 3: reemplazar los campos de texto por selectores de fecha/hora nativos.
 */
export function Disponibilidad() {
  const manana = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const [fecha, setFecha] = useState(manana);
  const [desde, setDesde] = useState('10:00');
  const [hasta, setHasta] = useState('11:30');
  const [asistentes, setAsistentes] = useState('20');
  const [motivo, setMotivo] = useState('');
  const [opciones, setOpciones] = useState<Sugerencia[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);

  const intervalo = () => ({ inicio: new Date(`${fecha}T${desde}:00`), fin: new Date(`${fecha}T${hasta}:00`) });

  async function buscar() {
    setMsg(null);
    try {
      const r = await api<{ sugerida: Sugerencia | null; alternativas: Sugerencia[] }>('/sugerencia', {
        method: 'POST',
        body: JSON.stringify({ ...intervalo(), asistentes: Number(asistentes) }),
      });
      setOpciones([...(r.sugerida ? [r.sugerida] : []), ...r.alternativas]);
      if (!r.sugerida && r.alternativas.length === 0) setMsg({ ok: false, texto: 'No hay salas disponibles' });
    } catch (e) {
      setMsg({ ok: false, texto: (e as Error).message });
    }
  }

  async function solicitar(o: Sugerencia) {
    const { inicio, fin } = intervalo();
    const desplazado = (d: Date) => new Date(d.getTime() + o.esperaMin * 60_000);
    const datos = { salaId: o.sala.id, inicio: desplazado(inicio), fin: desplazado(fin), motivo, asistentes: Number(asistentes) };
    // Misma validación que el servidor, antes de enviar.
    const v = reservaCreateSchema().safeParse(datos);
    if (!v.success) return setMsg({ ok: false, texto: v.error.issues.map((i) => i.message).join('\n') });
    try {
      const r = await api<{ estado: string }>('/reservas', { method: 'POST', body: JSON.stringify(datos) });
      setMsg({ ok: true, texto: r.estado === 'APROBADA' ? 'Reserva confirmada' : 'Solicitud enviada; recibirás un aviso al ser aprobada' });
      setOpciones([]);
    } catch (e) {
      setMsg({ ok: false, texto: (e as Error).message });
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Campo etiqueta="Fecha (AAAA-MM-DD)" value={fecha} onChangeText={setFecha} />
      <Campo etiqueta="Desde (HH:MM)" value={desde} onChangeText={setDesde} />
      <Campo etiqueta="Hasta (HH:MM)" value={hasta} onChangeText={setHasta} />
      <Campo etiqueta="Asistentes" value={asistentes} onChangeText={setAsistentes} keyboardType="number-pad" />
      <Campo etiqueta="Motivo" value={motivo} onChangeText={setMotivo} placeholder="Ej. clase de recuperación" />
      <Boton titulo="Buscar sala" onPress={buscar} />
      {msg && <Text style={{ color: msg.ok ? colores.ok : colores.error }}>{msg.texto}</Text>}
      {opciones.map((o, i) => (
        <Tarjeta key={o.sala.id}>
          <Text style={{ fontWeight: '700' }}>{i === 0 && o.esperaMin === 0 ? 'Sugerida: ' : ''}{o.sala.codigo}</Text>
          <Text style={{ color: colores.suave }}>
            Capacidad {o.sala.capacidad}{o.esperaMin > 0 ? ` · se libera en ${o.esperaMin} min` : ' · libre'}
          </Text>
          <Boton titulo="Solicitar" onPress={() => solicitar(o)} />
        </Tarjeta>
      ))}
    </ScrollView>
  );
}
