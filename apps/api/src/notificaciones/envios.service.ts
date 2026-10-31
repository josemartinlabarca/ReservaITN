import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';
import { PrismaService } from '../comun/prisma.service';
import { construirCorreo } from './plantilla-correo';

/** Envíos que se toman por vuelta y tiempo durante el cual quedan "reservados" para esta instancia. */
const LOTE = 20;
const RESERVA_MINUTOS = 5;
const INTERVALO_MS = 15_000;

export interface ResultadoVuelta {
  enviados: number;
  reintentos: number;
  fallidos: number;
}

/**
 * Despachador de la cola de salida (R6, D18, patrón outbox).
 * 1. Toma hasta LOTE envíos de CORREO pendientes cuyo próximo intento ya llegó y los "reserva"
 *    moviendo su próximo intento al futuro (FOR UPDATE SKIP LOCKED: varias instancias de la API
 *    no toman el mismo envío).
 * 2. Los envía fuera de la transacción (no deja la base bloqueada esperando al servidor SMTP).
 * 3. Marca ENVIADO, o programa un reintento con espera creciente (1, 2, 4, 8… min); al llegar al
 *    máximo de intentos (parámetro correo.intentos_maximos) lo marca FALLIDO con el error.
 * Los envíos PUSH quedan en cola hasta que la app registre dispositivos (roadmap 1.4.9).
 */
@Injectable()
export class EnviosService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('Envíos');
  private timer?: NodeJS.Timeout;
  private transporte?: Transporter;
  private enCurso = false;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    if (process.env.TAREAS === 'off') return;
    if (!process.env.SMTP_URL) {
      this.log.warn('SMTP_URL no está definido: los correos quedan en cola sin enviarse');
      return;
    }
    this.timer = setInterval(() => this.procesar().catch((e) => this.log.error(e)), INTERVALO_MS);
  }

  onModuleDestroy() {
    clearInterval(this.timer);
    this.transporte?.close();
  }

  /** Permite inyectar otro transporte (pruebas). */
  usarTransporte(t: Transporter) {
    this.transporte = t;
  }

  private obtenerTransporte(): Transporter {
    this.transporte ??= nodemailer.createTransport(process.env.SMTP_URL!);
    return this.transporte;
  }

  /** Procesa una vuelta de la cola. Devuelve cuántos se enviaron, se reprogramaron o fallaron. */
  async procesar(): Promise<ResultadoVuelta> {
    const resultado: ResultadoVuelta = { enviados: 0, reintentos: 0, fallidos: 0 };
    if (this.enCurso) return resultado; // una vuelta a la vez por instancia
    this.enCurso = true;
    try {
      const tomados = await this.prisma.$queryRaw<{ id: string; intentos: number }[]>`
        UPDATE comunicacion.envio
           SET proximo_intento = now() + make_interval(mins => ${RESERVA_MINUTOS}::int)
         WHERE id IN (SELECT id FROM comunicacion.envio
                       WHERE estado = 'PENDIENTE' AND canal = 'CORREO' AND proximo_intento <= now()
                       ORDER BY proximo_intento
                       LIMIT ${LOTE}
                       FOR UPDATE SKIP LOCKED)
        RETURNING id, intentos`;
      if (!tomados.length) return resultado;

      const [param, institucion] = await Promise.all([
        this.prisma.parametro.findUnique({ where: { clave: 'correo.intentos_maximos' } }),
        this.prisma.institucion.findFirst(),
      ]);
      const maximo = Number(param?.valor ?? 8);

      for (const t of tomados) {
        const envio = await this.prisma.envio.findUniqueOrThrow({
          where: { id: t.id },
          include: { notificacion: { include: { usuario: { include: { persona: true } } } } },
        });
        const n = envio.notificacion;
        const persona = n.usuario.persona;
        const intentos = t.intentos + 1;
        try {
          if (!persona.email) throw new SinCorreo();
          const plantilla = await this.prisma.plantilla.findUnique({
            where: { evento_codigo_canal: { evento_codigo: n.evento_codigo, canal: 'CORREO' } },
          });
          const correo = construirCorreo({
            nombre: persona.nombres,
            titulo: n.titulo,
            cuerpo: n.cuerpo,
            evento: n.evento_codigo,
            urlApp: process.env.WEB_URL ?? 'http://localhost:3000',
            institucion: institucion?.nombre ?? 'Instituto Técnico del Norte',
            plantilla,
          });
          await this.obtenerTransporte().sendMail({
            from: process.env.SMTP_FROM ?? 'ReservaITN <no-responder@itn.cl>',
            to: `"${persona.nombres} ${persona.apellido_paterno}" <${persona.email}>`,
            subject: correo.asunto,
            html: correo.html,
            text: correo.texto,
          });
          await this.prisma.envio.update({
            where: { id: t.id },
            data: { estado: 'ENVIADO', enviado_en: new Date(), intentos, ultimo_error: null },
          });
          resultado.enviados++;
        } catch (e) {
          const definitivo = e instanceof SinCorreo || intentos >= maximo;
          const espera = 2 ** (intentos - 1); // 1, 2, 4, 8… minutos
          await this.prisma.envio.update({
            where: { id: t.id },
            data: {
              intentos,
              ultimo_error: String((e as Error).message).slice(0, 500),
              ...(definitivo
                ? { estado: 'FALLIDO' }
                : { proximo_intento: new Date(Date.now() + espera * 60_000) }),
            },
          });
          if (definitivo) resultado.fallidos++;
          else resultado.reintentos++;
        }
      }
      if (resultado.enviados || resultado.fallidos)
        this.log.log(`Correos enviados: ${resultado.enviados} · reintentos: ${resultado.reintentos} · fallidos: ${resultado.fallidos}`);
      return resultado;
    } finally {
      this.enCurso = false;
    }
  }
}

class SinCorreo extends Error {
  constructor() {
    super('La persona no tiene correo registrado');
  }
}
