import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireSesion } from '@/lib/auth';
import { construirLibroExcel, respuestaExcel } from '@/lib/excel';

// La visibilidad de filas ya la impone RLS (sel_comisiones): un vendedor sin
// COMISIONES_VER_TODAS solo puede leer sus propias comisiones sin importar los filtros
// que mande, así que no hace falta repetir esa restricción aquí.
export async function GET(req: NextRequest) {
  await requireSesion();
  const supabase = createClient();
  const sp = req.nextUrl.searchParams;

  let query = supabase.from('comisiones_calculadas')
    .select('*, vendedor:vendedores(codigo, nombre_completo), cotizacion:cotizaciones(numero_interno, numero_sistema_externo)')
    .order('fecha_facturacion', { ascending: false });

  const desde = sp.get('desde'); const hasta = sp.get('hasta'); const vendedorId = sp.get('vendedor_id');
  if (desde) query = query.gte('fecha_facturacion', desde);
  if (hasta) query = query.lte('fecha_facturacion', hasta);
  if (vendedorId) query = query.eq('vendedor_id', vendedorId);

  const { data } = await query.limit(5000);
  const filas = (data ?? []).map((c: any) => ({
    Fecha: c.fecha_facturacion,
    Cotización: c.cotizacion?.numero_sistema_externo ?? c.cotizacion?.numero_interno ?? '',
    'Cód. Vendedor': c.vendedor?.codigo ?? '',
    Vendedor: c.vendedor?.nombre_completo ?? '',
    'Base de cálculo': Number(c.base_calculo),
    '% Aplicado': Number(c.porcentaje_aplicado),
    Comisión: Number(c.monto_comision),
  }));

  const buffer = construirLibroExcel([{ nombre: 'Comisiones', filas }]);
  return respuestaExcel(buffer, 'reporte_comisiones.xlsx');
}
