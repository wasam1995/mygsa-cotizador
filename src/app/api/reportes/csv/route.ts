import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireSesion } from '@/lib/auth';
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
  const filas = data ?? [];

  const encabezados = ['No. Interno', 'No. ERP', 'Fecha', 'Cliente', 'Vendedor', 'Estado', 'Subtotal', 'Descuentos', 'Base Gravable', 'IVA', 'Total', 'Retención ISR', 'Retención IVA', 'Pago Neto Empresa'];
  const lineas = filas.map((c: any) => [
    c.numero_interno, c.numero_sistema_externo ?? '', c.fecha_emision,
    (c.cliente?.nombre_razon ?? '').replace(/,/g, ' '), (c.vendedor?.nombre_completo ?? '').replace(/,/g, ' '),
    c.estado, c.subtotal, c.total_descuentos, c.base_gravable, c.iva_monto, c.total_cotizado, c.isr_retencion, c.iva_retencion, c.pago_neto_empresa,
  ].join(','));

  const csv = '﻿' + [encabezados.join(','), ...lineas].join('\n');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="reporte_cotizaciones.csv"`,
    },
  });
}
