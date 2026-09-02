import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireSesion } from '@/lib/auth';
import { construirLibroExcel, respuestaExcel } from '@/lib/excel';
import type { EstadoCotizacion } from '@/lib/types';

export async function GET(req: NextRequest) {
  await requireSesion('REPORTES_VER');
  const supabase = createClient();
  const sp = req.nextUrl.searchParams;

  let query = supabase.from('cotizaciones')
    .select('numero_interno, numero_sistema_externo, fecha_emision, estado, subtotal, total_descuentos, base_gravable, iva_monto, total_cotizado, isr_retencion, iva_retencion, pago_neto_empresa, cliente:clientes(nombre_razon), vendedor:vendedores(nombre_completo)')
    .order('fecha_emision', { ascending: false });

  const desde = sp.get('desde'); const hasta = sp.get('hasta'); const estado = sp.get('estado');
  if (desde) query = query.gte('fecha_emision', desde);
  if (hasta) query = query.lte('fecha_emision', hasta);
  if (estado) query = query.eq('estado', estado as EstadoCotizacion);

  const { data } = await query.limit(5000);
  const filas = (data ?? []).map((c: any) => ({
    'No. Interno': c.numero_interno,
    'No. ERP': c.numero_sistema_externo ?? '',
    Fecha: c.fecha_emision,
    Cliente: c.cliente?.nombre_razon ?? '',
    Vendedor: c.vendedor?.nombre_completo ?? '',
    Estado: c.estado,
    Subtotal: Number(c.subtotal),
    Descuentos: Number(c.total_descuentos),
    'Base Gravable': Number(c.base_gravable),
    IVA: Number(c.iva_monto),
    Total: Number(c.total_cotizado),
    'Retención ISR': Number(c.isr_retencion),
    'Retención IVA': Number(c.iva_retencion),
    'Pago Neto Empresa': Number(c.pago_neto_empresa),
  }));

  const buffer = construirLibroExcel([{ nombre: 'Cotizaciones', filas }]);
  return respuestaExcel(buffer, 'reporte_cotizaciones.xlsx');
}
