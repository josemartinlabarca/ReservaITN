/**
 * Correo de aviso con diseño institucional (R6). HTML con estilos en línea y tablas, porque
 * Outlook y Gmail ignoran la mayoría del CSS moderno; más una versión de texto plano.
 * Si existe una plantilla en comunicacion.plantilla para el evento y el canal CORREO, su asunto y
 * cuerpo reemplazan a los predeterminados ({{nombre}}, {{titulo}} y {{cuerpo}} se sustituyen).
 */
export interface DatosCorreo {
  nombre: string;
  titulo: string;
  cuerpo: string;
  evento: string;
  urlApp: string;
  institucion: string;
  plantilla?: { asunto: string | null; cuerpo: string } | null;
}

const ACCION: Record<string, string> = {
  SOLICITUD_CREADA: 'Revisar solicitud',
  ORDEN_ASIGNADA: 'Ver orden de trabajo',
  DANIO_REPORTADO: 'Ver reporte',
};

const escapar = (t: string) =>
  t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const sustituir = (t: string, d: DatosCorreo) =>
  t.replace(/\{\{\s*nombre\s*\}\}/g, d.nombre).replace(/\{\{\s*titulo\s*\}\}/g, d.titulo).replace(/\{\{\s*cuerpo\s*\}\}/g, d.cuerpo);

/** Ruta de la web a la que lleva el botón según el tipo de aviso. */
function destino(evento: string): string {
  if (evento === 'SOLICITUD_CREADA') return '/aprobaciones';
  if (evento.startsWith('RESERVA_') || evento.startsWith('SOLICITUD_')) return '/reservar';
  return '/';
}

export function construirCorreo(d: DatosCorreo): { asunto: string; html: string; texto: string } {
  const asunto = d.plantilla?.asunto ? sustituir(d.plantilla.asunto, d) : `ReservaITN · ${d.titulo}`;
  const cuerpo = d.plantilla ? sustituir(d.plantilla.cuerpo, d) : d.cuerpo;
  const url = `${d.urlApp.replace(/\/$/, '')}${destino(d.evento)}`;
  const accion = ACCION[d.evento] ?? 'Abrir ReservaITN';

  const html = `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapar(asunto)}</title></head>
<body style="margin:0;padding:0;background:#f3f5f9;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#1f2937;">
  <span style="display:none;max-height:0;overflow:hidden;">${escapar(cuerpo.slice(0, 120))}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f5f9;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #e5e7eb;">
        <tr><td style="background:#1f3864;padding:18px 28px;">
          <div style="color:#ffffff;font-size:18px;font-weight:700;">ReservaITN</div>
          <div style="color:#c7d2e8;font-size:12px;margin-top:2px;">${escapar(d.institucion)} · Reservas de salas y laboratorios</div>
        </td></tr>
        <tr><td style="padding:28px;">
          <p style="margin:0 0 6px;font-size:14px;color:#6b7280;">Hola, ${escapar(d.nombre)}:</p>
          <h1 style="margin:0 0 14px;font-size:20px;line-height:1.3;color:#1f3864;">${escapar(d.titulo)}</h1>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.55;white-space:pre-line;">${escapar(cuerpo)}</p>
          <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:6px;background:#1f5fbf;">
            <a href="${escapar(url)}" style="display:inline-block;padding:11px 22px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;">${escapar(accion)}</a>
          </td></tr></table>
        </td></tr>
        <tr><td style="padding:16px 28px;border-top:1px solid #e5e7eb;font-size:12px;line-height:1.5;color:#6b7280;">
          Este es un aviso automático de ReservaITN; no responda este correo.<br>
          Si no reconoce esta actividad, comuníquese con la Subdirección del instituto.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const texto = `Hola, ${d.nombre}:\n\n${d.titulo}\n\n${cuerpo}\n\n${accion}: ${url}\n\n—\nAviso automático de ReservaITN (${d.institucion}). No responda este correo.`;
  return { asunto, html, texto };
}
