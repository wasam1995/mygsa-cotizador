import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireSesion } from '@/lib/auth';
import { construirLibroExcel, respuestaExcel } from '@/lib/excel';

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
    Fecha: m.creado_en,
    Tipo: m.tipo,
    'Código producto': m.producto?.codigo ?? '',
    Producto: m.producto?.nombre ?? '',
    Cantidad: Number(m.cantidad),
    Cotización: m.numero_cotizacion ?? '',
    Cliente: m.cliente_nombre ?? '',
    Vendedor: m.vendedor_nombre ?? '',
    'Stock resultante': m.stock_resultante ?? '',
    Comentario: m.comentario ?? '',
  }));

  const buffer = construirLibroExcel([{ nombre: 'Kardex', filas }]);
  return respuestaExcel(buffer, 'kardex_inventario.xlsx');
}
