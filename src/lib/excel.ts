import * as XLSX from 'xlsx';
import { NextResponse } from 'next/server';

// Construye un libro de Excel (.xlsx) a partir de una o más hojas, cada una como un
// arreglo de objetos planos (cada objeto = una fila, sus llaves = encabezados de columna).
// Uso exclusivamente server-side (rutas /api/*) con datos que nosotros mismos armamos —
// nunca se usa para leer/parsear archivos que suba un usuario.
export function construirLibroExcel(hojas: { nombre: string; filas: Record<string, unknown>[] }[]): Buffer {
  const libro = XLSX.utils.book_new();
  for (const hoja of hojas) {
    const filas = hoja.filas.length > 0 ? hoja.filas : [{ 'Sin datos': '' }];
    const ws = XLSX.utils.json_to_sheet(filas);
    // Ancho de columna aproximado según el contenido más largo de cada una.
    const anchos = Object.keys(filas[0]).map((k) => ({
      wch: Math.min(40, Math.max(k.length, ...filas.map((f) => String(f[k] ?? '').length)) + 2),
    }));
    ws['!cols'] = anchos;
    XLSX.utils.book_append_sheet(libro, ws, hoja.nombre.slice(0, 31)); // Excel limita el nombre de hoja a 31 caracteres
  }
  return XLSX.write(libro, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
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
