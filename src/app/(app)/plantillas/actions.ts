'use server';

import { createClient } from '@/lib/supabase/server';
import { requireSesion } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import type { ApartadoPlantilla } from '@/lib/types';

export interface PlantillaPayload {
  nombre: string;
  condiciones_comerciales: string;
  leyenda_pie: string;
  texto_institucional: string;
  titulo_tabla_items: string;
  texto_firma_emisor: string;
  texto_firma_cliente: string;
  apartados: ApartadoPlantilla[];
}

export async function crearPlantilla(payload: PlantillaPayload) {
  await requireSesion('PLANTILLAS_EDITAR');
  const supabase = createClient();
  if (!payload.nombre.trim()) return { error: 'El nombre es obligatorio.' };

  const { error } = await supabase.from('plantillas_cotizacion').insert(payload);
  if (error) return { error: error.message };

  revalidatePath('/plantillas');
  revalidatePath('/cotizaciones/nueva');
  return { ok: true };
}

export async function actualizarPlantilla(id: string, payload: PlantillaPayload) {
  await requireSesion('PLANTILLAS_EDITAR');
  const supabase = createClient();
  if (!payload.nombre.trim()) return { error: 'El nombre es obligatorio.' };

  const { error } = await supabase.from('plantillas_cotizacion').update(payload).eq('id', id);
  if (error) return { error: error.message };

  revalidatePath('/plantillas');
  revalidatePath('/cotizaciones/nueva');
  return { ok: true };
}

export async function marcarPredeterminada(id: string) {
  await requireSesion('PLANTILLAS_EDITAR');
  const supabase = createClient();

  // RPC en lugar de dos updates desde aquí: la base garantiza que solo una plantilla
  // quede marcada como predeterminada a la vez (índice único), operación atómica.
  const { error } = await supabase.rpc('marcar_plantilla_predeterminada', { p_id: id });
  if (error) return { error: error.message };

  revalidatePath('/plantillas');
  revalidatePath('/cotizaciones/nueva');
  return { ok: true };
}

export async function activarDesactivarPlantilla(id: string, activo: boolean) {
  await requireSesion('PLANTILLAS_EDITAR');
  const supabase = createClient();

  const { error } = await supabase.from('plantillas_cotizacion').update({ activo }).eq('id', id);
  if (error) return { error: error.message };

  revalidatePath('/plantillas');
  revalidatePath('/cotizaciones/nueva');
  return { ok: true };
}
