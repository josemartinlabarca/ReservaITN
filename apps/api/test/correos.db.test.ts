import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import nodemailer from 'nodemailer';
import { SMTPServer } from 'smtp-server';
import { simpleParser, type ParsedMail } from 'mailparser';
import type { AddressInfo } from 'node:net';
import { ReservasService } from '../src/reservas/reservas.service';
import { NotificacionesService } from '../src/notificaciones/notificaciones.module';
import { EnviosService } from '../src/notificaciones/envios.service';
import { a, espacio, lunesAlAzar, prisma, sesion } from './ayuda';

/** Envío real de correos (R6): un servidor SMTP de prueba captura cada mensaje. */
const recibidos: ParsedMail[] = [];
const smtp = new SMTPServer({
  authOptional: true,
  disabledCommands: ['STARTTLS'],
  onData(stream, _sesion, listo) {
    simpleParser(stream).then((m) => { recibidos.push(m); listo(); }, listo);
  },
});
let puerto = 0;
const envios = new EnviosService(prisma);
const reservas = new ReservasService(prisma, new NotificacionesService());
const lunes = lunesAlAzar();

beforeAll(async () => {
  await new Promise<void>((ok) => smtp.listen(0, '127.0.0.1', () => ok()));
  puerto = (smtp.server.address() as AddressInfo).port;
});
afterAll(async () => {
  await new Promise<void>((ok) => smtp.close(() => ok()));
  await prisma.$disconnect();
});

const transporte = (p: number) => nodemailer.createTransport({ host: '127.0.0.1', port: p, secure: false, ignoreTLS: true, connectionTimeout: 2000 });

/** Procesa la cola hasta que el envío indicado salga de PENDIENTE o ya no avance (puede haber otros en cola). */
async function procesarHasta(envioId: string) {
  for (let i = 0; i < 50; i++) {
    const e = await prisma.envio.findUniqueOrThrow({ where: { id: envioId } });
    if (e.estado !== 'PENDIENTE' || e.proximo_intento > new Date()) return e;
    await envios.procesar();
  }
  return prisma.envio.findUniqueOrThrow({ where: { id: envioId } });
}

/** Crea una solicitud del docente y devuelve el envío de correo al director de Informática. */
async function solicitudConAviso(dia: number) {
  const [docente, dirInf] = await Promise.all([sesion('docente@itn.cl'), sesion('dir.inf@itn.cl')]);
  const s = await reservas.solicitar(
    { espacioId: (await espacio('A-201')).id, inicio: a(lunes, dia, '08:55'), fin: a(lunes, dia, '10:10'), tipoActividad: 'CLASE', descripcion: 'Clase de recuperación', asistentes: 20 },
    docente,
  );
  return prisma.envio.findFirstOrThrow({
    where: { canal: 'CORREO', notificacion: { solicitud_id: s.id, usuario_id: dirInf.id } },
  });
}

describe('envío de correos (R6)', () => {
  it('envía el aviso al aprobador con diseño HTML, texto plano y enlace a Aprobaciones', async () => {
    envios.usarTransporte(transporte(puerto));
    const envio = await solicitudConAviso(0);
    const final = await procesarHasta(envio.id);
    expect(final).toMatchObject({ estado: 'ENVIADO', intentos: 1, ultimo_error: null });
    expect(final.enviado_en).not.toBeNull();

    const correo = recibidos.find((m) => (m.to as { text: string }).text.includes('dir.inf@itn.cl') && m.text?.includes('Clase de recuperación'))!;
    expect(correo).toBeDefined();
    expect(correo.subject).toBe('ReservaITN · Nueva solicitud de reserva');
    expect(correo.from?.text).toContain('ReservaITN');
    expect(correo.html).toContain('Revisar solicitud');
    expect(correo.html).toContain('http://localhost:3000/aprobaciones');
    expect(correo.text).toContain('Hola, Director:');
  });

  it('si el servidor de correo no responde, programa un reintento con espera creciente', async () => {
    envios.usarTransporte(transporte(1)); // puerto cerrado
    const envio = await solicitudConAviso(1);
    const antes = Date.now();
    const final = await procesarHasta(envio.id);
    expect(final.estado).toBe('PENDIENTE');
    expect(final.intentos).toBe(1);
    expect(final.ultimo_error).toBeTruthy();
    const espera = (final.proximo_intento.getTime() - antes) / 60_000;
    expect(espera).toBeGreaterThan(0.9); // 1 minuto tras el primer fallo
    expect(espera).toBeLessThan(1.5);
  });

  it('al llegar al máximo de intentos lo marca FALLIDO y guarda el error', async () => {
    envios.usarTransporte(transporte(1));
    const envio = await solicitudConAviso(2);
    const maximo = Number((await prisma.parametro.findUniqueOrThrow({ where: { clave: 'correo.intentos_maximos' } })).valor);
    await prisma.envio.update({ where: { id: envio.id }, data: { intentos: maximo - 1 } });
    const final = await procesarHasta(envio.id);
    expect(final).toMatchObject({ estado: 'FALLIDO', intentos: maximo });
    expect(final.ultimo_error).toBeTruthy();
  });

  it('si la persona no tiene correo, falla de inmediato sin reintentar', async () => {
    envios.usarTransporte(transporte(puerto));
    const persona = await prisma.persona.create({
      data: { tipo_documento: 'PAS', numero_documento: `SC${Date.now() % 1_000_000_000}`, nombres: 'Sin', apellido_paterno: 'Correo' },
    });
    const usuario = await prisma.usuario.create({ data: { persona_id: persona.id } });
    const n = await prisma.notificacion.create({
      data: { usuario_id: usuario.id, evento_codigo: 'SOLICITUD_APROBADA', titulo: 'Prueba', cuerpo: 'Prueba', envio: { create: { canal: 'CORREO' } } },
      include: { envio: true },
    });
    const final = await procesarHasta(n.envio[0].id);
    expect(final).toMatchObject({ estado: 'FALLIDO', intentos: 1, ultimo_error: 'La persona no tiene correo registrado' });
  });
});
