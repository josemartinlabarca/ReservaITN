import { useEffect, useState } from 'react';
import { ScrollView, Switch, Text, View } from 'react-native';
import { reservaCreateSchema } from '@reservaitn/shared';
import { api, esEstudiante, post } from '../api';
import { Aviso, Boton, Campo, Etiqueta, Fichas, Tarjeta, Titulo, colores } from '../ui';
import { CampoFechaHora, fechaLarga, hhmm } from '../comun/CampoFechaHora';

interface Espacio { id: string; codigo: string; nombre: string; capacidad: number; edificio: { sede: { nombre: string } } }
interface Sugerencia { espacio: Espacio; esperaMin: number }
interface TipoActividad { codigo: string; nombre: string }

/** Une el día de `fecha` con la hora de `hora`. */
const combinar = (fecha: Date, hora: Date) => new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), hora.getHours(), hora.getMinutes());
const conHora = (h: number, m: number) => { const d = new Date(); d.setHours(h, m, 0, 0); return d; };
const manana = () => { const d = new Date(Date.now() + 86_400_000); if (d.getDay() === 0) d.setDate(d.getDate() + 1); return d; };

/**
 * Reservar (R2, R3, R10, R11, D13): día y horas al minuto con selectores nativos, actividad,
 * repetición semanal; el sistema sugiere el espacio y alternativas que se liberan pronto.
 * Valida con el mismo esquema que la API antes de enviar.
 */
export function Reservar({ alReservar }: { alReservar: () => void }) {
  const [fecha, setFecha] = useState(manana());
  const [desde, setDesde] = useState(conHora(8, 55));
  const [hasta, setHasta] = useState(conHora(10, 10));
  const [asistentes, setAsistentes] = useState(esEstudiante() ? '4' : '20');
  const [motivo, setMotivo] = useState('');
  const [actividades, setActividades] = useState<TipoActividad[]>([]);
  const [actividad, setActividad] = useState(esEstudiante() ? 'ESTUDIO' : 'CLASE');
  const [semanal, setSemanal] = useState(false);
  const [repetirHasta, setRepetirHasta] = useState(new Date(Date.now() + 28 * 86_400_000));
  const [opciones, setOpciones] = useState<Sugerencia[] | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    api<{ tiposActividad: TipoActividad[] }>('/catalogos')
      .then((c) => setActividades(c.tiposActividad.filter((a) => a.codigo !== 'MANTENCION')))
      .catch(() => setActividades([]));
  }, []);

  const inicio = combinar(fecha, desde);
  const fin = combinar(fecha, hasta);
  const limpiar = () => { setOpciones(null); setMsg(null); };

  async function buscar() {
    setMsg(null);
    setOcupado(true);
    try {
      const r = await post<{ sugerida: Sugerencia | null; alternativas: Sugerencia[] }>('/sugerencia', { inicio, fin, asistentes: Number(asistentes) });
      const lista = [...(r.sugerida ? [r.sugerida] : []), ...r.alternativas];
      setOpciones(lista);
      if (!lista.length) setMsg({ ok: false, texto: 'No hay espacios libres para ese horario y esa cantidad de personas.' });
    } catch (e) {
      setMsg({ ok: false, texto: (e as Error).message });
    } finally {
      setOcupado(false);
    }
  }

  async function solicitar(o: Sugerencia) {
    const corrido = (d: Date) => new Date(d.getTime() + o.esperaMin * 60_000);
    const datos = {
      espacioId: o.espacio.id,
      inicio: corrido(inicio),
      fin: corrido(fin),
      tipoActividad: actividad,
      descripcion: motivo,
      asistentes: Number(asistentes),
      ...(semanal ? { repetirHasta: repetirHasta.toLocaleDateString('sv-SE') } : {}),
    };
    const v = reservaCreateSchema().safeParse(datos);
    if (!v.success) return setMsg({ ok: false, texto: [...new Set(v.error.issues.map((i) => i.message))].join('\n') });
    setOcupado(true);
    try {
      const r = await post<{ reserva: { estado: string }[] }>('/reservas', datos);
      const n = r.reserva.length;
      const aprobada = r.reserva[0]?.estado === 'APROBADA';
      setMsg({
        ok: true,
        texto: aprobada
          ? `Reserva confirmada en ${o.espacio.codigo}${n > 1 ? ` (${n} fechas)` : ''}.`
          : `Solicitud enviada para ${o.espacio.codigo}${n > 1 ? ` (${n} fechas)` : ''}. El horario queda bloqueado mientras se aprueba; recibirás un aviso.`,
      });
      setOpciones(null);
      setMotivo('');
      alReservar();
    } catch (e) {
      setMsg({ ok: false, texto: (e as Error).message });
    } finally {
      setOcupado(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }} keyboardShouldPersistTaps="handled">
      <Titulo>Nueva reserva</Titulo>
      <CampoFechaHora etiqueta="Día" modo="date" valor={fecha} minimo={new Date()} onCambio={(d) => { setFecha(d); limpiar(); }} />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <CampoFechaHora etiqueta="Desde" modo="time" valor={desde} onCambio={(d) => { setDesde(d); limpiar(); }} />
        <CampoFechaHora etiqueta="Hasta" modo="time" valor={hasta} onCambio={(d) => { setHasta(d); limpiar(); }} />
      </View>
      <Text style={{ color: colores.suave, fontSize: 12 }}>De lunes a sábado, de 08:00 a 23:00. Mínimo 30 minutos.</Text>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Campo etiqueta="Asistentes" value={asistentes} onChangeText={(t) => { setAsistentes(t.replace(/\D/g, '')); limpiar(); }} keyboardType="number-pad" />
      </View>
      {actividades.length > 0 && (
        <View style={{ gap: 6 }}>
          <Etiqueta>Actividad</Etiqueta>
          <Fichas opciones={actividades.map((a) => ({ valor: a.codigo, texto: a.nombre }))} valor={actividad} onCambio={setActividad} />
        </View>
      )}
      <Campo etiqueta="Motivo" value={motivo} onChangeText={setMotivo} placeholder="Ej. clase de recuperación de Redes" />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: colores.texto, fontSize: 15 }}>Repetir cada semana</Text>
        <Switch value={semanal} onValueChange={setSemanal} />
      </View>
      {semanal && <CampoFechaHora etiqueta="Repetir hasta" modo="date" valor={repetirHasta} minimo={fecha} onCambio={setRepetirHasta} />}

      <Boton titulo={`Buscar sala · ${fechaLarga(fecha)}, ${hhmm(desde)}–${hhmm(hasta)}`} onPress={buscar} cargando={ocupado && !opciones} />
      {msg && <Aviso ok={msg.ok} texto={msg.texto} />}

      {opciones?.map((o, i) => (
        <Tarjeta key={o.espacio.id}>
          <Text style={{ fontWeight: '700', fontSize: 16 }}>
            {i === 0 && o.esperaMin === 0 ? '★ Sugerida: ' : ''}{o.espacio.codigo} · {o.espacio.nombre}
          </Text>
          <Text style={{ color: colores.suave }}>
            {o.espacio.edificio.sede.nombre} · capacidad {o.espacio.capacidad}
            {o.esperaMin > 0 ? ` · se libera en ${o.esperaMin} min` : ' · libre'}
          </Text>
          <Boton titulo={o.esperaMin > 0 ? `Solicitar desde ${hhmm(new Date(inicio.getTime() + o.esperaMin * 60_000))}` : 'Solicitar'} onPress={() => solicitar(o)} deshabilitado={ocupado} />
        </Tarjeta>
      ))}
    </ScrollView>
  );
}
