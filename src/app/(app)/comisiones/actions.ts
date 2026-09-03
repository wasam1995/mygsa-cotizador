'use server';

import { createClient } from '@/lib/supabase/server';
import { requireSesion } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import type { DescuentoOtro } from '@/lib/types';

// Crea una liquidación de comisiones: toma TODAS las comisiones de ese vendedor, ya
// facturadas y aún sin liquidar (liquidacion_id is null), dentro del rango de fechas
// dado — recalculado aquí en el servidor (no se confía en lo que mande el cliente) — las
// asocia a la liquidación nueva y calcula el neto a pagar tras los descuentos.
export async function crearLiquidacion(payload: {
  numero: string;
  vendedor_id: string;
  fecha_desde: string;
  fecha_hasta: string;
  descuento_isr: number;
  justificacion_isr: string | null;
  descuento_igss: number;
  justificacion_igss: string | null;
  descuentos_otros: DescuentoOtro[];
}) {
  const sesion = await requireSesion('COMISIONES_LIQUIDAR');
  const supabase = createClient();

  const { data: pendientes, error: errPendientes } = await supabase
    .from('comisiones_calculadas')
    .select('id, monto_comision')
    .eq('vendedor_id', payload.vendedor_id)
    .is('liquidacion_id', null)
    .gte('fecha_facturacion', payload.fecha_desde)
    .lte('fecha_facturacion', payload.fecha_hasta);

  if (errPendientes) return { error: errPendientes.message };
  if (!pendientes || pendientes.length === 0) {
    return { error: 'No hay comisiones pendientes de pago para ese vendedor en ese rango de fechas.' };
  }

  const totalComisiones = pendientes.reduce((a, c) => a + Number(c.monto_comision), 0);
  const totalOtros = payload.descuentos_otros.reduce((a, d) => a + Number(d.monto || 0), 0);
  const totalNeto = totalComisiones - (payload.descuento_isr || 0) - (payload.descuento_igss || 0) - totalOtros;

  const { data: liquidacion, error: errLiq } = await supabase.from('liquidaciones_comisiones').insert({
    numero: payload.numero,
    vendedor_id: payload.vendedor_id,
    fecha_desde: payload.fecha_desde,
    fecha_hasta: payload.fecha_hasta,
    total_comisiones: totalComisiones,
    descuento_isr: payload.descuento_isr || 0,
    justificacion_isr: payload.descuento_isr > 0 ? (payload.justificacion_isr || null) : null,
    descuento_igss: payload.descuento_igss || 0,
    justificacion_igss: payload.descuento_igss > 0 ? (payload.justificacion_igss || null) : null,
    descuentos_otros: payload.descuentos_otros.filter((d) => d.concepto || d.monto),
    total_neto: totalNeto,
    estado: 'PENDIENTE_PAGO',
    creado_por: sesion.userId,
  }).select('id').single();

  if (errLiq || !liquidacion) return { error: errLiq?.message ?? 'No se pudo crear la liquidación.' };

  const { error: errAsociar } = await supabase
    .from('comisiones_calculadas')
    .update({ liquidacion_id: liquidacion.id })
    .eq('vendedor_id', payload.vendedor_id)
    .is('liquidacion_id', null)
    .gte('fecha_facturacion', payload.fecha_desde)
    .lte('fecha_facturacion', payload.fecha_hasta);

  if (errAsociar) return { error: `La liquidación se creó pero no se pudieron asociar las comisiones: ${errAsociar.message}` };

  revalidatePath('/comisiones');
  return { ok: true, id: liquidacion.id };
}

export async function marcarLiquidacionPagada(id: string, comentarioPago: string) {
  const sesion = await requireSesion('COMISIONES_LIQUIDAR');
  const supabase = createClient();
  const { error } = await supabase.from('liquidaciones_comisiones').update({
    estado: 'PAGADA',
    comentario_pago: comentarioPago || null,
    fecha_pago: new Date().toISOString().slice(0, 10),
    pagado_por: sesion.userId,
  }).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/comisiones');
  return { ok: true };
}

export async function reabrirLiquidacion(id: string) {
  await requireSesion('COMISIONES_LIQUIDAR');
  const supabase = createClient();
  const { error } = await supabase.from('liquidaciones_comisiones').update({
    estado: 'PENDIENTE_PAGO', comentario_pago: null, fecha_pago: null, pagado_por: null,
  }).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/comisiones');
  return { ok: true };
}

export async function actualizarComentarioComision(id: string, comentario: string) {
  await requireSesion('COMISIONES_LIQUIDAR');
  const supabase = createClient();
  const { error } = await supabase.from('comisiones_calculadas').update({ comentario: comentario || null }).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/comisiones');
  return { ok: true };
}
