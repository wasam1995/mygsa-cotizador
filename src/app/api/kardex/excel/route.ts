import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireSesion } from '@/lib/auth';
import { construirLibroExcel, respuestaExcel } from '@/lib/excel';
import type { HojaExcel } from '@/lib/excel';

export async function GET(req: NextRequest) {
  await requireSesion('INVENTARIO_VER');
  const supabase = createClient();
  const sp = req.nextUrl.searchParams;

  let query = supabase.from('movimientos_inventario')
    .select('*, producto:productos(codigo, nombre)')
    .order('creado_en', { ascending: false });

  const tipo = sp.get('tipo'); const cotizacion = sp.get('cotizacion');
  if (tipo) query = query.eq('tipo', tipo);
  if (cotizacion) query = query.ilike('numero_cotizacion', `%${cotizacion}%`);

  const { data } = await query.limit(5000);
  const filas = (data ?? []).map((m: any) => ({
    fecha: m.creado_en,
    tipo: m.tipo,
    cod_producto: m.producto?.codigo ?? '',
    producto: m.producto?.nombre ?? '',
    cantidad: Number(m.cantidad),
    cotizacion: m.numero_cotizacion ?? '',
    cliente: m.cliente_nombre ?? '',
    vendedor: m.vendedor_nombre ?? '',
    stock_resultante: m.stock_resultante ?? '',
    comentario: m.comentario ?? '',
  }));

  const hoja: HojaExcel = {
    nombre: 'Kardex',
    columnas: [
      { header: 'Fecha', key: 'fecha', tipo: 'fecha' },
      { header: 'Tipo', key: 'tipo', tipo: 'texto' },
      { header: 'Código producto', key: 'cod_producto', tipo: 'texto' },
      { header: 'Producto', key: 'producto', tipo: 'texto' },
      { header: 'Cantidad', key: 'cantidad', tipo: 'entero' },
      { header: 'Cotización', key: 'cotizacion', tipo: 'texto' },
      { header: 'Cliente', key: 'cliente', tipo: 'texto' },
      { header: 'Vendedor', key: 'vendedor', tipo: 'texto' },
      { header: 'Stock resultante', key: 'stock_resultante', tipo: 'texto' },
      { header: 'Comentario', key: 'comentario', tipo: 'texto' },
    ],
    filas,
  };

  const buffer = construirLibroExcel([hoja]);
  return respuestaExcel(buffer, 'kardex_inventario.xlsx');
}
