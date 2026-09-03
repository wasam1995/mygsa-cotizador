import * as XLSX from 'xlsx';
import { NextResponse } from 'next/server';

// Construcción de libros Excel (.xlsx) para descarga, usando la librería libre/community
// de SheetJS ('xlsx'). Uso exclusivamente server-side (rutas /api/*) con datos que
// nosotros mismos armamos — nunca se usa para leer/parsear archivos que suba un usuario.
//
// IMPORTANTE — limitación conocida y verificada de la librería instalada: el color de
// relleno/fuente de las celdas (negritas, fondos de color, etc.) NO se escribe en el
// archivo de salida — SheetJS solo soporta estilos de celda (fills, fonts, colores) en su
// edición de paga "Pro". Por eso la paleta de colores corporativa de la cotización se
// aplica al 100% en el PDF (que sí soporta color, vía html2canvas) pero en el Excel el
// libro se entrega con cuadrícula estándar de Excel (visible por defecto) y las celdas
// de encabezado/totales resaltadas únicamente con el texto en mayúsculas y el signo "Q"
// del formato de moneda — no con relleno de color. Lo que SÍ está 100% soportado y
// incluido: fórmulas reales de Excel (SUM, multiplicaciones de rango, IF condicional) y
// formato de celda con símbolo de moneda "Q" y separador de miles.

export type TipoColumnaExcel = 'texto' | 'numero' | 'entero' | 'moneda' | 'porcentaje' | 'fecha';

export interface ColumnaExcel {
  header: string;
  key: string;
  tipo?: TipoColumnaExcel;
}

export interface HojaExcel {
  nombre: string;
  columnas: ColumnaExcel[];
  filas: Record<string, unknown>[];
  /** Keys de columnas que deben llevar una fila de totales al final, calculada con una fórmula SUM real de Excel (no un valor precalculado). */
  totales?: string[];
}

export const FORMATO_MONEDA = '"Q"#,##0.00';
export const FORMATO_PORCENTAJE = '0.00%';
export const FORMATO_ENTERO = '#,##0';

function formatoDe(tipo?: TipoColumnaExcel): string | undefined {
  if (tipo === 'moneda') return FORMATO_MONEDA;
  if (tipo === 'porcentaje') return FORMATO_PORCENTAJE;
  if (tipo === 'entero') return FORMATO_ENTERO;
  return undefined;
}

function construirHoja(hoja: HojaExcel): XLSX.WorkSheet {
  const { columnas, filas, totales } = hoja;
  const encabezados = columnas.map((c) => c.header);
  const filasDatos = filas.length > 0 ? filas : [];

  const aoa: unknown[][] = [encabezados];
  for (const fila of filasDatos) {
    aoa.push(columnas.map((c) => {
      const v = fila[c.key];
      if (v && typeof v === 'object' && 'f' in (v as Record<string, unknown>)) return v; // celda con fórmula explícita (ver abajo)
      if (c.tipo === 'texto' || c.tipo === 'fecha') return v ?? '';
      return typeof v === 'number' ? v : Number(v ?? 0);
    }));
  }
  if (filasDatos.length === 0) aoa.push(columnas.map(() => ''));

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Reemplaza las celdas marcadas como { f: 'FORMULA' } por fórmulas reales de Excel
  // (aoa_to_sheet las escribe como objeto plano, así que se corrigen después).
  filasDatos.forEach((fila, filaIdx) => {
    columnas.forEach((c, colIdx) => {
      const v = fila[c.key];
      if (v && typeof v === 'object' && 'f' in (v as Record<string, unknown>)) {
        const addr = XLSX.utils.encode_cell({ r: filaIdx + 1, c: colIdx });
        ws[addr] = { t: 'n', f: (v as { f: string }).f, z: formatoDe(c.tipo) };
      }
    });
  });

  // Formato numérico/moneda/porcentaje por columna (celdas de datos, no encabezado).
  columnas.forEach((col, colIdx) => {
    const formato = formatoDe(col.tipo);
    if (!formato) return;
    for (let r = 1; r <= filasDatos.length; r++) {
      const addr = XLSX.utils.encode_cell({ r, c: colIdx });
      if (ws[addr] && !ws[addr].z) ws[addr].z = formato;
    }
  });

  // Fila de totales con fórmulas SUM reales sobre el rango de datos de cada columna.
  let ultimaFila = filasDatos.length; // 0-based: encabezado es la fila 0
  if (totales && totales.length > 0 && filasDatos.length > 0) {
    const filaTotalIdx = filasDatos.length + 1;
    const primeraColKey = columnas[0]?.key;
    columnas.forEach((col, colIdx) => {
      const addr = XLSX.utils.encode_cell({ r: filaTotalIdx, c: colIdx });
      if (col.key === primeraColKey) {
        ws[addr] = { t: 's', v: 'TOTAL' };
        return;
      }
      if (!totales.includes(col.key)) return;
      const colLetra = XLSX.utils.encode_col(colIdx);
      const rango = `${colLetra}2:${colLetra}${filasDatos.length + 1}`;
      ws[addr] = { t: 'n', f: `SUM(${rango})`, z: formatoDe(col.tipo) ?? FORMATO_MONEDA };
    });
    ultimaFila = filaTotalIdx;
  }

  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: ultimaFila, c: Math.max(columnas.length - 1, 0) } });

  // Ancho de columna aproximado según el contenido más largo de cada una.
  ws['!cols'] = columnas.map((c) => ({
    wch: Math.min(40, Math.max(c.header.length, ...filasDatos.map((f) => String(f[c.key] ?? '').length), 8) + 2),
  }));

  // Congela la fila de encabezados para que se mantenga visible al desplazarse.
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };
  (ws as unknown as { '!panes'?: unknown })['!panes'] = [{ ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft', state: 'frozen' }];

  return ws;
}

// Arma el libro (XLSX.WorkBook) sin convertirlo todavía a buffer — úsese cuando una hoja
// necesite ajustes manuales después de construida (p. ej. una fórmula condicional que
// depende de la posición exacta de otra celda), antes de llamar libroABuffer().
export function construirLibro(hojas: HojaExcel[]): XLSX.WorkBook {
  const libro = XLSX.utils.book_new();
  for (const hoja of hojas) {
    const ws = construirHoja(hoja);
    XLSX.utils.book_append_sheet(libro, ws, hoja.nombre.slice(0, 31)); // Excel limita el nombre de hoja a 31 caracteres
  }
  return libro;
}

export function libroABuffer(libro: XLSX.WorkBook): Buffer {
  return XLSX.write(libro, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

export function construirLibroExcel(hojas: HojaExcel[]): Buffer {
  return libroABuffer(construirLibro(hojas));
}

/** Envuelve una fórmula de Excel para que construirHoja la reconozca y la escriba como fórmula real (no como texto). */
export function formula(f: string) {
  return { f };
}

export type CeldaLibre = string | number | { f: string; formato?: string } | null | undefined;

/**
 * Construye una hoja "libre" (no tabular) a partir de una matriz de filas — cada celda es
 * un valor simple o { f: 'FORMULA' } — con celdas combinadas (merges) opcionales. Se usa
 * para las hojas "Cotización" (cliente/interna) que necesitan verse como el documento
 * impreso: bloques de encabezado, tarjetas de info, tabla de ítems y totales, todo en una
 * sola hoja continua — algo que HojaExcel/construirHoja (pensada para tablas columna×fila
 * uniformes) no puede armar. Los merges SÍ están soportados por la librería community de
 * SheetJS (a diferencia de los colores/rellenos — ver nota al inicio del archivo).
 */
export function construirHojaLibre(
  filas: CeldaLibre[][],
  opciones?: { merges?: string[]; anchoColumnas?: number[]; altoFilas?: number[] }
): XLSX.WorkSheet {
  const aoa = filas.map((fila) => fila.map((c) => {
    if (c === null || c === undefined) return '';
    if (typeof c === 'object' && 'f' in c) return ''; // se reemplaza abajo por la fórmula real
    return c;
  }));
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  filas.forEach((fila, r) => {
    fila.forEach((c, colIdx) => {
      if (c && typeof c === 'object' && 'f' in c) {
        const addr = XLSX.utils.encode_cell({ r, c: colIdx });
        ws[addr] = { t: 'n', f: c.f, z: c.formato ?? FORMATO_MONEDA };
      }
    });
  });

  if (opciones?.merges && opciones.merges.length > 0) {
    ws['!merges'] = opciones.merges.map((rango) => XLSX.utils.decode_range(rango));
  }
  if (opciones?.anchoColumnas) {
    ws['!cols'] = opciones.anchoColumnas.map((wch) => ({ wch }));
  }
  if (opciones?.altoFilas) {
    ws['!rows'] = opciones.altoFilas.map((hpt) => ({ hpt }));
  }

  return ws;
}

/** Agrega una hoja ya construida (p. ej. con construirHojaLibre) a un libro existente. */
export function agregarHoja(libro: XLSX.WorkBook, ws: XLSX.WorkSheet, nombre: string) {
  XLSX.utils.book_append_sheet(libro, ws, nombre.slice(0, 31));
}

export function libroNuevo(): XLSX.WorkBook {
  return XLSX.utils.book_new();
}

export function respuestaExcel(buffer: Buffer, nombreArchivo: string) {
  // Buffer<ArrayBufferLike> no encaja exactamente con los tipos DOM de BlobPart/BodyInit
  // en TS aunque en tiempo de ejecución es válido (Buffer es un Uint8Array) — se castea
  // explícitamente en vez de copiar el contenido.
  return new NextResponse(new Blob([buffer as unknown as BlobPart]), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${nombreArchivo}"`,
    },
  });
}
