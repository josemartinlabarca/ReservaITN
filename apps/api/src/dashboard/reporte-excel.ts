import ExcelJS from 'exceljs';
import { distribucionPorJornada } from '@reservaitn/shared';
import type { FilaEspacio, FilaReserva } from './dashboard.service';

/**
 * Reporte de ocupación en Excel (R13 / E9 / WBS 1.4.7). Cuatro hojas:
 * Resumen (indicadores del Plan de Beneficios), Ocupación por espacio, Reservas (detalle con
 * trazabilidad) y Uso por jornada (mapa de calor). Tablas de Excel con filtros, formatos de número,
 * formato condicional e impresión en horizontal ajustada al ancho.
 */
export interface DatosReporte {
  institucion: string;
  desde: Date;
  hasta: Date; // exclusivo (inicio del día siguiente al último incluido)
  sede: string | null;
  generadoPor: string;
  ocupacion: { indiceGlobal: number; porEspacio: FilaEspacio[]; reservas: { inicio: Date; fin: Date }[] };
  indicadores: {
    aprobadas: number;
    pendientes: number;
    rechazadas: number;
    canceladas: number;
    liberadas: number;
    expiradas: number;
    totalReservas: number;
    B3_reservasNoUsadas: number;
    B6_tiempoPromedioAprobacionHoras: number | null;
    B6_trazabilidadCompleta: number;
  };
  reservas: FilaReserva[];
}

const COLOR = {
  primario: 'FF1F3864', // azul institucional
  primarioClaro: 'FFD9E2F3',
  texto: 'FF1F2937',
  suave: 'FF6B7280',
  borde: 'FFD1D5DB',
  verde: 'FFE2F0D9',
  ambar: 'FFFFF2CC',
  rojo: 'FFFBE4E4',
  gris: 'FFEDEDED',
};
const FUENTE = 'Calibri';
const ESTADO: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  APROBADA: 'Aprobada',
  RECHAZADA: 'Rechazada',
  CANCELADA: 'Cancelada',
  EXPIRADA: 'Expirada',
  LIBERADA: 'Liberada',
};
const ORIGEN: Record<string, string> = { SOLICITUD: 'Solicitud', PLANIFICACION: 'Planificación', MANTENCION: 'Mantención' };
const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

/**
 * Excel no tiene zona horaria: se escribe la hora "de reloj" de Chile, para que 08:55 se vea 08:55
 * en cualquier computador.
 */
function horaChile(d: Date): Date {
  const t = d.toLocaleString('sv-SE', { timeZone: 'America/Santiago' }); // "2026-11-10 08:55:00"
  return new Date(`${t.replace(' ', 'T')}Z`);
}
const fechaTexto = (d: Date) => d.toLocaleDateString('es-CL', { timeZone: 'America/Santiago', day: '2-digit', month: '2-digit', year: 'numeric' });

function configurarHoja(ws: ExcelJS.Worksheet, titulo: string) {
  ws.pageSetup = {
    orientation: 'landscape',
    paperSize: 9, // A4
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.4, right: 0.4, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 },
  };
  ws.headerFooter = {
    oddHeader: `&L&"${FUENTE},Bold"ReservaITN&R${titulo}`,
    oddFooter: '&LInstituto Técnico del Norte&RPágina &P de &N',
  };
  ws.properties.defaultRowHeight = 18;
}

/** Encabezado de cada hoja: título, subtítulo y período. Devuelve la fila siguiente libre. */
function encabezado(ws: ExcelJS.Worksheet, d: DatosReporte, titulo: string, columnas: number): number {
  const ultima = ws.getColumn(columnas).letter;
  ws.mergeCells(`A1:${ultima}1`);
  const t = ws.getCell('A1');
  t.value = titulo;
  t.font = { name: FUENTE, size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.primario } };
  t.alignment = { vertical: 'middle', indent: 1 };
  ws.getRow(1).height = 32;

  ws.mergeCells(`A2:${ultima}2`);
  const s = ws.getCell('A2');
  const ultimoDia = new Date(d.hasta.getTime() - 1);
  s.value = `${d.institucion} · Período: ${fechaTexto(d.desde)} al ${fechaTexto(ultimoDia)} · Sede: ${d.sede ?? 'Todas'}`;
  s.font = { name: FUENTE, size: 10, color: { argb: COLOR.suave } };
  s.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.primarioClaro } };
  s.alignment = { vertical: 'middle', indent: 1 };
  ws.getRow(2).height = 20;
  return 4;
}

/**
 * Formato explícito de una tabla: encabezado, filas alternadas y totales. No depende del estilo de
 * tabla de Excel, que LibreOffice y Google Sheets no muestran: el reporte se ve igual en todos.
 */
function estilizarTabla(
  ws: ExcelJS.Worksheet,
  filaEncabezado: number,
  columnas: number,
  filasDatos: number,
  opciones: { totales?: boolean; centradas?: number[] } = {},
) {
  const borde = { style: 'thin' as const, color: { argb: COLOR.borde } };
  const enc = ws.getRow(filaEncabezado);
  enc.height = 24;
  for (let c = 1; c <= columnas; c++) {
    const celda = enc.getCell(c);
    celda.font = { name: FUENTE, bold: true, color: { argb: 'FFFFFFFF' } };
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.primario } };
    celda.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  }
  for (let k = 1; k <= filasDatos; k++) {
    const fila = ws.getRow(filaEncabezado + k);
    for (let c = 1; c <= columnas; c++) {
      const celda = fila.getCell(c);
      celda.font = { name: FUENTE, size: 10, color: { argb: COLOR.texto }, ...(celda.font?.bold ? { bold: true } : {}) };
      celda.border = { bottom: borde };
      if (k % 2 === 0 && !celda.fill) celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F6FB' } };
      if (opciones.centradas?.includes(c)) celda.alignment = { ...celda.alignment, horizontal: 'center' };
      celda.alignment = { vertical: 'middle', ...celda.alignment };
    }
  }
  if (opciones.totales) {
    const tot = ws.getRow(filaEncabezado + filasDatos + 1);
    for (let c = 1; c <= columnas; c++) {
      const celda = tot.getCell(c);
      celda.font = { name: FUENTE, bold: true, color: { argb: COLOR.primario } };
      celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.primarioClaro } };
      celda.border = { top: { style: 'medium', color: { argb: COLOR.primario } } };
      if (opciones.centradas?.includes(c)) celda.alignment = { horizontal: 'center' };
    }
  }
}

function tituloSeccion(ws: ExcelJS.Worksheet, fila: number, texto: string) {
  const c = ws.getCell(`A${fila}`);
  c.value = texto;
  c.font = { name: FUENTE, size: 12, bold: true, color: { argb: COLOR.primario } };
  ws.getRow(fila).height = 22;
}

function hojaResumen(wb: ExcelJS.Workbook, d: DatosReporte) {
  const ws = wb.addWorksheet('Resumen', { views: [{ showGridLines: false }], properties: { tabColor: { argb: COLOR.primario } } });
  configurarHoja(ws, 'Resumen');
  ws.columns = [{ width: 44 }, { width: 18 }, { width: 18 }, { width: 22 }, { width: 18 }];
  let f = encabezado(ws, d, 'Reporte de ocupación de salas y laboratorios', 5);

  // Datos del reporte
  const meta: [string, string][] = [
    ['Generado por', d.generadoPor],
    ['Fecha de generación', new Date().toLocaleString('es-CL', { timeZone: 'America/Santiago', dateStyle: 'short', timeStyle: 'short' })],
  ];
  for (const [k, v] of meta) {
    ws.getCell(`A${f}`).value = k;
    ws.getCell(`A${f}`).font = { name: FUENTE, color: { argb: COLOR.suave } };
    ws.getCell(`B${f}`).value = v;
    ws.getCell(`B${f}`).font = { name: FUENTE, bold: true };
    f++;
  }
  f++;

  // Indicadores (Plan de Gestión de Beneficios)
  tituloSeccion(ws, f++, 'Indicadores del período');
  const i = d.indicadores;
  ws.addTable({
    name: 'Indicadores',
    ref: `A${f}`,
    headerRow: true,
    style: { theme: 'TableStyleMedium2', showRowStripes: true },
    columns: [{ name: 'Indicador' }, { name: 'Valor' }, { name: 'Meta' }, { name: 'Beneficio' }],
    rows: [
      ['Índice de ocupación global', d.ocupacion.indiceGlobal, '+10 pp vs. línea base', 'B3'],
      ['Reservas aprobadas', i.aprobadas, '—', 'B2'],
      ['Pendientes de aprobación', i.pendientes, '—', 'B6'],
      ['Rechazadas', i.rechazadas, '—', 'B6'],
      ['Canceladas', i.canceladas, '—', 'R5'],
      ['Expiradas sin respuesta', i.expiradas, '0', 'B6'],
      ['Liberadas por falta de check-in', i.liberadas, '—', 'B3'],
      ['Reservas no usadas', i.B3_reservasNoUsadas, '≤ 10 %', 'B3'],
      ['Tiempo promedio de aprobación (horas)', i.B6_tiempoPromedioAprobacionHoras ?? '—', '≤ 24 h', 'B6'],
      ['Reservas con trazabilidad completa', i.B6_trazabilidadCompleta, '100 %', 'B6'],
    ],
  });
  estilizarTabla(ws, f, 4, 10, { centradas: [3, 4] });
  const filaPct = (n: number) => ws.getCell(`B${f + n}`);
  [1, 8, 10].forEach((n) => (filaPct(n).numFmt = '0.0%'));
  filaPct(9).numFmt = '0.0';
  for (let n = f + 1; n <= f + 10; n++) {
    ws.getCell(`B${n}`).alignment = { horizontal: 'right' };
    ws.getCell(`C${n}`).alignment = { horizontal: 'center' };
    ws.getCell(`D${n}`).alignment = { horizontal: 'center' };
  }
  f += 12;

  // Ocupación por sede
  tituloSeccion(ws, f++, 'Ocupación por sede');
  const sedes = new Map<string, { espacios: number; horas: number; disponibles: number }>();
  for (const e of d.ocupacion.porEspacio) {
    const s = sedes.get(e.sede) ?? { espacios: 0, horas: 0, disponibles: 0 };
    s.espacios++;
    s.horas += e.horasReservadas;
    s.disponibles += e.horasDisponibles;
    sedes.set(e.sede, s);
  }
  const filasSede = [...sedes].map(([sede, s]) => [sede, s.espacios, s.horas, s.disponibles, s.disponibles ? s.horas / s.disponibles : 0]);
  ws.addTable({
    name: 'OcupacionPorSede',
    ref: `A${f}`,
    headerRow: true,
    style: { theme: 'TableStyleMedium2', showRowStripes: true },
    columns: [{ name: 'Sede' }, { name: 'Espacios' }, { name: 'Horas reservadas' }, { name: 'Horas disponibles' }, { name: 'Índice' }],
    rows: filasSede.length ? filasSede : [['Sin espacios', 0, 0, 0, 0]],
  });
  estilizarTabla(ws, f, 5, Math.max(1, filasSede.length), { centradas: [2] });
  for (let n = f + 1; n <= f + Math.max(1, filasSede.length); n++) {
    ws.getCell(`C${n}`).numFmt = '#,##0.0';
    ws.getCell(`D${n}`).numFmt = '#,##0';
    ws.getCell(`E${n}`).numFmt = '0.0%';
  }
  f += Math.max(1, filasSede.length) + 2;

  const nota = ws.getCell(`A${f}`);
  ws.mergeCells(`A${f}:E${f + 1}`);
  nota.value =
    'Índice de ocupación = horas de reservas aprobadas (sin mantención) ÷ horas disponibles ' +
    '(lunes a sábado, 08:00 a 23:00). Detalle en las hojas "Ocupación por espacio", "Reservas" y "Uso por jornada".';
  nota.font = { name: FUENTE, size: 9, italic: true, color: { argb: COLOR.suave } };
  nota.alignment = { wrapText: true, vertical: 'top' };
}

function hojaOcupacion(wb: ExcelJS.Workbook, d: DatosReporte) {
  const ws = wb.addWorksheet('Ocupación por espacio', { views: [{ showGridLines: false, state: 'frozen', ySplit: 4 }] });
  configurarHoja(ws, 'Ocupación por espacio');
  ws.columns = [{ width: 12 }, { width: 34 }, { width: 16 }, { width: 18 }, { width: 12 }, { width: 18 }, { width: 18 }, { width: 22 }];
  const f = encabezado(ws, d, 'Ocupación por espacio', 8);
  const filas = d.ocupacion.porEspacio.map((e) => [e.codigo, e.nombre, e.sede, e.tipo, e.capacidad, e.horasReservadas, e.horasDisponibles, e.indice]);
  ws.addTable({
    name: 'OcupacionPorEspacio',
    ref: `A${f}`,
    headerRow: true,
    totalsRow: true,
    style: { theme: 'TableStyleMedium2', showRowStripes: true },
    columns: [
      { name: 'Código', totalsRowLabel: 'Total' },
      { name: 'Nombre' },
      { name: 'Sede' },
      { name: 'Tipo' },
      { name: 'Capacidad', totalsRowFunction: 'sum' },
      { name: 'Horas reservadas', totalsRowFunction: 'sum' },
      { name: 'Horas disponibles', totalsRowFunction: 'sum' },
      // Fórmula con celdas normales: las referencias de tabla ([Columna]) no funcionan fuera de Excel
      { name: 'Índice de ocupación', totalsRowFunction: 'custom', totalsRowFormula: `IFERROR(F${f + Math.max(1, d.ocupacion.porEspacio.length) + 1}/G${f + Math.max(1, d.ocupacion.porEspacio.length) + 1},0)` },
    ],
    rows: filas.length ? filas : [['—', 'Sin espacios', '', '', 0, 0, 0, 0]],
  });
  const ultima = f + Math.max(1, filas.length) + 1; // incluye fila de totales
  estilizarTabla(ws, f, 8, Math.max(1, filas.length), { totales: true, centradas: [1, 5] });
  ws.pageSetup.printTitlesRow = `${f}:${f}`;
  for (let n = f + 1; n <= ultima; n++) {
    ws.getCell(`F${n}`).numFmt = '#,##0.0';
    ws.getCell(`G${n}`).numFmt = '#,##0';
    ws.getCell(`H${n}`).numFmt = '0.0%';
  }
  // Barra de datos en el índice (sin la fila de totales)
  ws.addConditionalFormatting({
    ref: `H${f + 1}:H${ultima - 1}`,
    rules: [
      {
        type: 'dataBar',
        priority: 1,
        minLength: 0,
        maxLength: 100,
        cfvo: [{ type: 'num', value: 0 }, { type: 'max' }], // la sala más ocupada llena la barra
        color: { argb: 'FF5B9BD5' },
      } as unknown as ExcelJS.ConditionalFormattingRule,
    ],
  });
}

function hojaReservas(wb: ExcelJS.Workbook, d: DatosReporte) {
  const ws = wb.addWorksheet('Reservas', { views: [{ showGridLines: false, state: 'frozen', ySplit: 4, xSplit: 1 }] });
  configurarHoja(ws, 'Detalle de reservas');
  const anchos = [12, 9, 9, 11, 12, 14, 14, 36, 14, 24, 12, 13, 24, 17, 14, 22, 38];
  ws.columns = anchos.map((width) => ({ width }));
  const f = encabezado(ws, d, 'Detalle de reservas', anchos.length);

  const filas = d.reservas.map((r) => {
    const ini = horaChile(r.inicio);
    const fin = horaChile(r.fin);
    return [
      ini,
      ini,
      fin,
      (r.fin.getTime() - r.inicio.getTime()) / 3_600_000,
      r.espacio,
      r.sede,
      r.tipoActividad,
      r.descripcion,
      ORIGEN[r.origen] ?? r.origen,
      r.solicitante,
      r.asistentes,
      ESTADO[r.estado] ?? r.estado,
      r.aprobacionAutomatica ? 'Automática' : (r.aprobador ?? ''),
      horaChile(r.solicitadoEn),
      r.horasAprobacion === null || r.aprobacionAutomatica ? null : r.horasAprobacion,
      r.canceladoPor ?? '',
      r.motivoCancelacion ?? '',
    ];
  });
  ws.addTable({
    name: 'Reservas',
    ref: `A${f}`,
    headerRow: true,
    style: { theme: 'TableStyleMedium2', showRowStripes: true },
    columns: [
      'Fecha', 'Inicio', 'Término', 'Duración (h)', 'Espacio', 'Sede', 'Actividad', 'Motivo', 'Origen', 'Solicitante',
      'Asistentes', 'Estado', 'Aprobó', 'Solicitado el', 'Aprobación (h)', 'Cancelado por', 'Motivo de cancelación',
    ].map((name) => ({ name, filterButton: true })),
    rows: filas.length ? filas : [[null, null, null, null, '', '', '', 'Sin reservas en el período', '', '', null, '', '', null, null, '', '']],
  });
  const ultima = f + Math.max(1, filas.length);
  estilizarTabla(ws, f, anchos.length, Math.max(1, filas.length), { centradas: [1, 2, 3, 4, 5, 11, 12, 15] });
  ws.pageSetup.printTitlesRow = `${f}:${f}`;
  for (let n = f + 1; n <= ultima; n++) {
    ws.getCell(`A${n}`).numFmt = 'dd-mm-yyyy';
    ws.getCell(`B${n}`).numFmt = 'hh:mm';
    ws.getCell(`C${n}`).numFmt = 'hh:mm';
    ws.getCell(`D${n}`).numFmt = '0.0';
    ws.getCell(`N${n}`).numFmt = 'dd-mm-yyyy hh:mm';
    ws.getCell(`O${n}`).numFmt = '0.0';
    ws.getCell(`H${n}`).alignment = { wrapText: true, vertical: 'top' };
    ws.getCell(`Q${n}`).alignment = { wrapText: true, vertical: 'top' };
  }
  // Color fijo por estado (el reporte es una foto del período; se ve igual en cualquier programa)
  const colores: Record<string, string> = {
    Aprobada: COLOR.verde,
    Pendiente: COLOR.ambar,
    Cancelada: COLOR.rojo,
    Rechazada: COLOR.rojo,
    Liberada: COLOR.gris,
    Expirada: COLOR.gris,
  };
  for (let n = f + 1; n <= ultima; n++) {
    const celda = ws.getCell(`L${n}`);
    const color = colores[String(celda.value)];
    if (color) {
      celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
      celda.font = { name: FUENTE, size: 10, bold: true, color: { argb: COLOR.texto } };
    }
  }
}

function hojaJornadas(wb: ExcelJS.Workbook, d: DatosReporte) {
  const ws = wb.addWorksheet('Uso por jornada', { views: [{ showGridLines: false }] });
  configurarHoja(ws, 'Uso por día y jornada');
  ws.columns = [{ width: 16 }, { width: 20 }, { width: 20 }, { width: 22 }, { width: 14 }];
  let f = encabezado(ws, d, 'Uso por día y jornada (horas aprobadas)', 5);

  const dist = distribucionPorJornada(d.ocupacion.reservas);
  const filas = [1, 2, 3, 4, 5, 6].map((dia) => {
    const j = dist[dia] ?? { MANANA: 0, TARDE: 0, VESPERTINA: 0 };
    const r = (n: number) => Math.round(n * 10) / 10;
    return [DIAS[dia], r(j.MANANA), r(j.TARDE), r(j.VESPERTINA), r(j.MANANA + j.TARDE + j.VESPERTINA)];
  });
  ws.addTable({
    name: 'UsoPorJornada',
    ref: `A${f}`,
    headerRow: true,
    totalsRow: true,
    style: { theme: 'TableStyleMedium2', showRowStripes: false },
    columns: [
      { name: 'Día', totalsRowLabel: 'Total' },
      { name: 'Mañana (08–13)', totalsRowFunction: 'sum' },
      { name: 'Tarde (13–18)', totalsRowFunction: 'sum' },
      { name: 'Vespertina (18–23)', totalsRowFunction: 'sum' },
      { name: 'Total', totalsRowFunction: 'sum' },
    ],
    rows: filas,
  });
  estilizarTabla(ws, f, 5, 6, { totales: true, centradas: [2, 3, 4, 5] });
  for (let n = f + 1; n <= f + 7; n++) for (const c of ['B', 'C', 'D', 'E']) ws.getCell(`${c}${n}`).numFmt = '0.0';
  // Mapa de calor: blanco (sin uso) → azul (mayor uso)
  ws.addConditionalFormatting({
    ref: `B${f + 1}:D${f + 6}`,
    rules: [
      {
        type: 'colorScale',
        priority: 1,
        cfvo: [{ type: 'min' }, { type: 'max' }],
        color: [{ argb: 'FFFFFFFF' }, { argb: 'FF5B9BD5' }],
      },
    ],
  });
  f += 9;

  // Lectura rápida para la toma de decisiones (R14, B5)
  const bloques = filas.flatMap(([dia, m, t, v]) => [
    { nombre: `${dia} mañana`, horas: m as number },
    { nombre: `${dia} tarde`, horas: t as number },
    { nombre: `${dia} vespertina`, horas: v as number },
  ]);
  const orden = [...bloques].sort((a, b) => b.horas - a.horas);
  tituloSeccion(ws, f++, 'Lectura rápida');
  const lineas = [
    `Mayor uso: ${orden.slice(0, 3).map((b) => `${b.nombre} (${b.horas.toFixed(1)} h)`).join(', ')}.`,
    `Menor uso: ${orden.slice(-3).reverse().map((b) => `${b.nombre} (${b.horas.toFixed(1)} h)`).join(', ')}.`,
    'Los bloques de menor uso son candidatos para nuevos cursos o arriendo de espacios (beneficios B5 y B8).',
  ];
  for (const l of lineas) {
    ws.mergeCells(`A${f}:E${f}`);
    ws.getCell(`A${f}`).value = l;
    ws.getCell(`A${f}`).font = { name: FUENTE, size: 10, color: { argb: COLOR.texto } };
    f++;
  }
}

export async function construirReporteExcel(d: DatosReporte): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ReservaITN';
  wb.company = d.institucion;
  wb.title = 'Reporte de ocupación';
  wb.created = new Date();
  hojaResumen(wb, d);
  hojaOcupacion(wb, d);
  hojaReservas(wb, d);
  hojaJornadas(wb, d);
  return Buffer.from(await wb.xlsx.writeBuffer());
}
