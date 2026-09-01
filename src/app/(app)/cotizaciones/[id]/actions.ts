'use server';

import { createClient } from '@/lib/supabase/server';
import { requireSesion } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import type { EstadoCotizacion } from '@/lib/types';

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
