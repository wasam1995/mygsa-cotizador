'use server';

import { createClient } from '@/lib/supabase/server';
import { requireSesion } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { EstadoCotizacion } from '@/lib/types';
import type { CrearCotizacionPayload } from '../nueva/actions';

const PERMISO_POR_TRANSICION: Partial<Record<EstadoCotizacion, string>> = {
  PEND_AUTORIZAR: 'COTIZACIONES_CREAR',
  ENVIADO_CLIENTE: 'COTIZACIONES_CREAR', // aprobar tambien la puede mover un Autorizador (ver COTIZACIONES_AUTORIZAR abajo)
  AUTORIZADO_CLIENTE: 'COTIZACIONES_CREAR',
  FACTURADO: 'COTIZACIONES_FACTURAR',
  ANULADO: 'COTIZACIONES_ANULAR',
};

export async function cambiarEstado(cotizacionId: string, nuevoEstado: EstadoCotizacion, comentario?: string, motivoAnulacion?: string) {
  const sesion = await requireSesion();
  const supabase = createClient();

  // La aprobación de PEND_AUTORIZAR -> ENVIADO_CLIENTE exige el permiso de Autorizador.
  const { data: actual } = await supabase.from('cotizaciones').select('estado').eq('id', cotizacionId).single();
  const requierePermisoAutorizador = actual?.estado === 'PEND_AUTORIZAR' && nuevoEstado === 'ENVIADO_CLIENTE';

  const permisoNecesario = requierePermisoAutorizador ? 'COTIZACIONES_AUTORIZAR' : PERMISO_POR_TRANSICION[nuevoEstado];
  if (permisoNecesario && !sesion.permisos.includes(permisoNecesario) && !sesion.permisos.includes('COTIZACIONES_VER_TODAS')) {
    return { error: 'No tiene permiso para realizar este cambio de estado.' };
  }

  const payload: Record<string, unknown> = { estado: nuevoEstado };
  if (nuevoEstado === 'ANULADO') payload.motivo_anulacion = motivoAnulacion ?? comentario ?? null;

  const { error } = await supabase.from('cotizaciones').update(payload).eq('id', cotizacionId);
  if (error) return { error: error.message };

  if (comentario) {
    await supabase.from('cotizacion_historial_estados')
      .update({ comentario })
      .eq('cotizacion_id', cotizacionId)
      .order('creado_en', { ascending: false })
      .limit(1);
  }

  revalidatePath(`/cotizaciones/${cotizacionId}`);
  revalidatePath('/cotizaciones');
  return { ok: true };
}

export async function subirPdfCotizacion(cotizacionId: string, formData: FormData) {
  const sesion = await requireSesion();
  const supabase = createClient();
  const archivo = formData.get('archivo') as File | null;
  if (!archivo || archivo.size === 0) return { error: 'Seleccione un archivo PDF.' };
  if (archivo.type !== 'application/pdf') return { error: 'El archivo debe ser un PDF.' };

  const ruta = `${cotizacionId}/${Date.now()}_${archivo.name}`;
  const { error: errSubida } = await supabase.storage.from('cotizaciones-pdf').upload(ruta, archivo, {
    contentType: 'application/pdf',
  });
  if (errSubida) return { error: errSubida.message };

  const { error: errInsert } = await supabase.from('cotizacion_adjuntos').insert({
    cotizacion_id: cotizacionId,
    nombre_archivo: archivo.name,
    ruta_storage: ruta,
    subido_por: sesion.userId,
  });
  if (errInsert) return { error: errInsert.message };

  revalidatePath(`/cotizaciones/${cotizacionId}`);
  return { ok: true };
}

export async function obtenerUrlAdjunto(rutaStorage: string) {
  const supabase = createClient();
  const { data, error } = await supabase.storage.from('cotizaciones-pdf').createSignedUrl(rutaStorage, 60 * 10);
  if (error) return null;
  return data?.signedUrl ?? null;
}

// Reemplaza por completo los datos de una cotización existente: cabecera, líneas y
// costos operativos. Cualquier cotización que NO esté FACTURADA la puede modificar su
// dueño (o quien tenga "ver todas"); una FACTURADA solo quien tenga "ver todas"
// (Autorizador/Administrador) — igual que aplica la seguridad a nivel de base de datos.
export async function actualizarCotizacionCompleta(cotizacionId: string, payload: CrearCotizacionPayload) {
  const sesion = await requireSesion();
  const supabase = createClient();

  const { data: actual } = await supabase.from('cotizaciones').select('estado, vendedor_id').eq('id', cotizacionId).single();
  if (!actual) return { error: 'La cotización ya no existe.' };

  const esDueno = actual.vendedor_id === sesion.vendedorId;
  const puedeGestionarTodas = sesion.permisos.includes('COTIZACIONES_VER_TODAS');
  if (actual.estado === 'FACTURADO' && !puedeGestionarTodas) {
    return { error: 'Esta cotización ya está facturada. Solo un Autorizador o Administrador puede modificarla.' };
  }
  if (actual.estado !== 'FACTURADO' && !esDueno && !puedeGestionarTodas) {
    return { error: 'No tiene permiso para modificar esta cotización.' };
  }
  if (payload.lineas.length === 0) {
    return { error: 'Agregue al menos una línea de producto o servicio.' };
  }

  const { error: errCot } = await supabase.from('cotizaciones').update({
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
    prorratear_costos_operativos: payload.prorratear_costos_operativos,
    mostrar_precios_unitarios_cliente: payload.mostrar_precios_unitarios_cliente,
    mostrar_vendedor_cliente: payload.mostrar_vendedor_cliente,
  }).eq('id', cotizacionId);
  if (errCot) return { error: errCot.message };

  const { error: errDelDet } = await supabase.from('cotizacion_detalle').delete().eq('cotizacion_id', cotizacionId);
  if (errDelDet) return { error: errDelDet.message };

  const filas = payload.lineas.map((l, idx) => ({
    cotizacion_id: cotizacionId,
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
    incluir_foto: l.incluir_foto,
  }));
  const { error: errDet } = await supabase.from('cotizacion_detalle').insert(filas);
  if (errDet) return { error: errDet.message };

  const { error: errDelCosto } = await supabase.from('cotizacion_costos_operativos').delete().eq('cotizacion_id', cotizacionId);
  if (errDelCosto) return { error: errDelCosto.message };

  const costosValidos = payload.costos_operativos.filter((c) => c.concepto.trim() && (c.cantidad > 0 || c.dias > 0 || c.costo_unitario > 0));
  if (costosValidos.length > 0) {
    const filasCosto = costosValidos.map((c, idx) => ({
      cotizacion_id: cotizacionId,
      orden: idx + 1,
      concepto: c.concepto,
      cantidad: c.cantidad,
      dias: c.dias,
      costo_unitario: c.costo_unitario,
    }));
    const { error: errCosto } = await supabase.from('cotizacion_costos_operativos').insert(filasCosto);
    if (errCosto) return { error: errCosto.message };
  }

  revalidatePath(`/cotizaciones/${cotizacionId}`);
  revalidatePath('/cotizaciones');
  redirect(`/cotizaciones/${cotizacionId}`);
}

// Elimina definitivamente una cotización (no es lo mismo que "Anular": esto borra el
// registro). El kardex y las comisiones ya generadas por esta cotización NO se borran,
// solo quedan sin cotización asociada (conservan número, cliente y vendedor).
export async function eliminarCotizacion(cotizacionId: string) {
  const sesion = await requireSesion();
  const supabase = createClient();

  const { data: actual } = await supabase.from('cotizaciones').select('estado, vendedor_id').eq('id', cotizacionId).single();
  if (!actual) return { error: 'La cotización ya no existe.' };

  const esDueno = actual.vendedor_id === sesion.vendedorId;
  const puedeGestionarTodas = sesion.permisos.includes('COTIZACIONES_VER_TODAS');
  if (actual.estado === 'FACTURADO' && !puedeGestionarTodas) {
    return { error: 'Esta cotización ya está facturada. Solo un Autorizador o Administrador puede eliminarla.' };
  }
  if (actual.estado !== 'FACTURADO' && !esDueno && !puedeGestionarTodas) {
    return { error: 'No tiene permiso para eliminar esta cotización.' };
  }

  const { error } = await supabase.from('cotizaciones').delete().eq('id', cotizacionId);
  if (error) return { error: error.message };

  revalidatePath('/cotizaciones');
  redirect('/cotizaciones');
}
