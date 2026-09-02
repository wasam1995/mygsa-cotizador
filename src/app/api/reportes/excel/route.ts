import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireSesion } from '@/lib/auth';
import { construirLibroExcel, respuestaExcel } from '@/lib/excel';
import type { HojaExcel } from '@/lib/excel';
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
    numero_interno: c.numero_interno,
    numero_erp: c.numero_sistema_externo ?? '',
    fecha: c.fecha_emision,
    cliente: c.cliente?.nombre_razon ?? '',
    vendedor: c.vendedor?.nombre_completo ?? '',
    estado: c.estado,
    subtotal: Number(c.subtotal),
    descuentos: Number(c.total_descuentos),
    base_gravable: Number(c.base_gravable),
    iva: Number(c.iva_monto),
    total: Number(c.total_cotizado),
    retencion_isr: Number(c.isr_retencion),
    retencion_iva: Number(c.iva_retencion),
    pago_neto_empresa: Number(c.pago_neto_empresa),
  }));

  const hoja: HojaExcel = {
    nombre: 'Cotizaciones',
    columnas: [
      { header: 'No. Interno', key: 'numero_interno', tipo: 'texto' },
      { header: 'No. ERP', key: 'numero_erp', tipo: 'texto' },
      { header: 'Fecha', key: 'fecha', tipo: 'fecha' },
      { header: 'Cliente', key: 'cliente', tipo: 'texto' },
      { header: 'Vendedor', key: 'vendedor', tipo: 'texto' },
      { header: 'Estado', key: 'estado', tipo: 'texto' },
      { header: 'Subtotal', key: 'subtotal', tipo: 'moneda' },
      { header: 'Descuentos', key: 'descuentos', tipo: 'moneda' },
      { header: 'Base Gravable', key: 'base_gravable', tipo: 'moneda' },
      { header: 'IVA', key: 'iva', tipo: 'moneda' },
      { header: 'Total', key: 'total', tipo: 'moneda' },
      { header: 'Retención ISR', key: 'retencion_isr', tipo: 'moneda' },
      { header: 'Retención IVA', key: 'retencion_iva', tipo: 'moneda' },
      { header: 'Pago Neto Empresa', key: 'pago_neto_empresa', tipo: 'moneda' },
    ],
    filas,
    totales: ['subtotal', 'descuentos', 'iva', 'total', 'retencion_isr', 'retencion_iva', 'pago_neto_empresa'],
  };

  const buffer = construirLibroExcel([hoja]);
  return respuestaExcel(buffer, 'reporte_cotizaciones.xlsx');
}
