import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireSesion } from '@/lib/auth';
import { construirLibroExcel, respuestaExcel } from '@/lib/excel';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  await requireSesion();
  const supabase = createClient();

  const { data: cotizacion } = await supabase
    .from('cotizaciones')
    .select('*, cliente:clientes(nombre_razon, nit), vendedor:vendedores(nombre_completo, codigo)')
    .eq('id', params.id)
    .single();

  if (!cotizacion) return NextResponse.json({ error: 'No encontrada' }, { status: 404 });

  const [{ data: lineas }, { data: costosOperativos }] = await Promise.all([
    supabase.from('cotizacion_detalle').select('*').eq('cotizacion_id', params.id).order('linea'),
    supabase.from('cotizacion_costos_operativos').select('*').eq('cotizacion_id', params.id).order('orden'),
  ]);

  const c = cotizacion as any;

  const resumen = [
    { Campo: 'No. Interno', Valor: c.numero_interno },
    { Campo: 'No. ERP', Valor: c.numero_sistema_externo ?? '' },
    { Campo: 'Fecha emisión', Valor: c.fecha_emision },
    { Campo: 'Estado', Valor: c.estado },
    { Campo: 'Cliente', Valor: c.cliente?.nombre_razon ?? c.cliente_nombre_libre ?? '' },
    { Campo: 'Vendedor', Valor: c.vendedor?.nombre_completo ?? '' },
    { Campo: 'Subtotal (con IVA)', Valor: Number(c.subtotal) },
    { Campo: 'Descuentos', Valor: Number(c.total_descuentos) },
    { Campo: 'Base gravable (sin IVA)', Valor: Number(c.base_gravable) },
    { Campo: 'IVA', Valor: Number(c.iva_monto) },
    { Campo: 'Total cotizado (con IVA)', Valor: Number(c.total_cotizado) },
    { Campo: 'Retención ISR', Valor: Number(c.isr_retencion) },
    { Campo: 'Retención IVA', Valor: Number(c.iva_retencion) },
    { Campo: 'Pago neto a la empresa', Valor: Number(c.pago_neto_empresa) },
    { Campo: '— Uso interno —', Valor: '' },
    { Campo: 'Costo total de productos/servicios', Valor: Number(c.costo_total_productos) },
    { Campo: 'Gastos operativos adicionales', Valor: Number(c.costos_operativos_total) },
    { Campo: 'Costo total de operación', Valor: Number(c.costo_total_operacion) },
    { Campo: 'Utilidad bruta', Valor: Number(c.utilidad_bruta) },
    { Campo: '% Margen de utilidad', Valor: Number(c.margen_utilidad_pct) * 100 },
    { Campo: 'Escala de comisión aplicada', Valor: c.escala_comision_rango ? `Rango ${c.escala_comision_rango}` : '' },
    { Campo: '% Comisión al vendedor', Valor: Number(c.comision_estimada_pct) * 100 },
    { Campo: 'Comisión estimada/pagada', Valor: Number(c.comision_estimada_monto) },
    { Campo: 'Ganancia neta para la empresa', Valor: Number(c.ganancia_neta_estimada) },
  ];

  const detalle = (lineas ?? []).map((l: any) => ({
    Línea: l.linea,
    Código: l.codigo_mostrado ?? '',
    Descripción: l.descripcion,
    Cantidad: Number(l.cantidad),
    'Costo unitario': Number(l.costo_unitario),
    'Precio unitario': Number(l.precio_unitario),
    'Descuento %': Number(l.descuento_linea_pct),
    'Descuento monto': Number(l.descuento_linea_monto),
    Subtotal: Number(l.subtotal_linea),
  }));

  const costos = (costosOperativos ?? []).map((co: any) => ({
    Concepto: co.concepto,
    Cantidad: Number(co.cantidad),
    'Días/tiempos': Number(co.dias),
    'Costo unitario': Number(co.costo_unitario),
    Total: Number(co.cantidad) * Number(co.dias) * Number(co.costo_unitario),
  }));

  const hojas: { nombre: string; filas: Record<string, unknown>[] }[] = [
    { nombre: 'Resumen', filas: resumen },
    { nombre: 'Detalle', filas: detalle },
  ];
  if (costos.length > 0) hojas.push({ nombre: 'Costos operativos', filas: costos });

  const buffer = construirLibroExcel(hojas);
  const nombreArchivo = `cotizacion_${(c.numero_sistema_externo || c.numero_interno).replace(/[^a-zA-Z0-9-]/g, '_')}.xlsx`;
  return respuestaExcel(buffer, nombreArchivo);
}
