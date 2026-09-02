'use server';

import { createClient } from '@/lib/supabase/server';
import { requireSesion } from '@/lib/auth';
import { redirect } from 'next/navigation';
import type { ModoPrecioLinea } from '@/lib/types';

export interface LineaPayload {
  producto_id: string | null;
  es_fuera_inventario: boolean;
  codigo_mostrado: string;
  descripcion: string;
  cantidad: number;
  costo_unitario: number;
  precio_unitario: number;
  descuento_linea_pct: number;
  descuento_linea_monto: number;
  modo_precio: ModoPrecioLinea;
  margen_pct: number | null;
}

export interface CostoOperativoPayload {
  concepto: string;
  cantidad: number;
  dias: number;
  costo_unitario: number;
}

export interface CrearCotizacionPayload {
  vendedor_id: string;
  vendedor_telefono: string;
  cliente_id: string | null;
  cliente_nombre_libre: string | null;
  cliente_nit: string | null;
  cliente_direccion: string | null;
  cliente_telefono: string | null;
  cliente_es_retenedor_iva: boolean;
  descuento_global_pct: number;
  descuento_global_monto: number;
  comentario: string | null;
  numero_sistema_externo: string | null;
  lineas: LineaPayload[];
  costos_operativos: CostoOperativoPayload[];
}

// Crea la cotización en estado PROSPECTO junto con sus líneas de detalle y sus costos
// operativos adicionales. El cálculo fiscal y financiero (ISR/IVA/utilidad/comisión) lo
// recalcula automáticamente el trigger de Postgres en cuanto se insertan las líneas — no
// se calcula aquí.
export async function crearCotizacion(payload: CrearCotizacionPayload) {
  const sesion = await requireSesion('COTIZACIONES_CREAR');
  const supabase = createClient();

  if (payload.lineas.length === 0) {
    return { error: 'Agregue al menos una línea de producto o servicio.' };
  }

  const { data: cot, error: errCot } = await supabase
    .from('cotizaciones')
    .insert({
      vendedor_id: payload.vendedor_id,
      vendedor_telefono: payload.vendedor_telefono || null,
      cliente_id: payload.cliente_id,
      cliente_nombre_libre: payload.cliente_nombre_libre,
      cliente_nit: payload.cliente_nit,
      cliente_direccion: payload.cliente_direccion,
      cliente_telefono: payload.cliente_telefono,
      cliente_es_retenedor_iva: payload.cliente_es_retenedor_iva,
      descuento_global_pct: payload.descuento_global_pct,
      descuento_global_monto: payload.descuento_global_monto,
      comentario: payload.comentario,
      numero_sistema_externo: payload.numero_sistema_externo,
      creado_por: sesion.userId,
      estado: 'PROSPECTO',
    })
    .select('id')
    .single();

  if (errCot || !cot) {
    return { error: errCot?.message ?? 'No se pudo crear la cotización.' };
  }

  const filas = payload.lineas.map((l, idx) => ({
    cotizacion_id: cot.id,
    linea: idx + 1,
    producto_id: l.producto_id,
    es_fuera_inventario: l.es_fuera_inventario,
    codigo_mostrado: l.codigo_mostrado,
    descripcion: l.descripcion,
    cantidad: l.cantidad,
    costo_unitario: l.costo_unitario,
    precio_unitario: l.precio_unitario,
    descuento_linea_pct: l.descuento_linea_pct,
    descuento_linea_monto: l.descuento_linea_monto,
    subtotal_linea: l.cantidad * l.precio_unitario - l.descuento_linea_monto,
    modo_precio: l.modo_precio,
    margen_pct: l.margen_pct,
  }));

  const { error: errDet } = await supabase.from('cotizacion_detalle').insert(filas);
  if (errDet) {
    await supabase.from('cotizaciones').delete().eq('id', cot.id);
    return { error: errDet.message };
  }

  const costosValidos = payload.costos_operativos.filter((c) => c.concepto.trim() && (c.cantidad > 0 || c.dias > 0 || c.costo_unitario > 0));
  if (costosValidos.length > 0) {
    const filasCosto = costosValidos.map((c, idx) => ({
      cotizacion_id: cot.id,
      orden: idx + 1,
      concepto: c.concepto,
      cantidad: c.cantidad,
      dias: c.dias,
      costo_unitario: c.costo_unitario,
    }));
    const { error: errCosto } = await supabase.from('cotizacion_costos_operativos').insert(filasCosto);
    if (errCosto) {
      await supabase.from('cotizaciones').delete().eq('id', cot.id);
      return { error: errCosto.message };
    }
  }

  redirect(`/cotizaciones/${cot.id}`);
}
