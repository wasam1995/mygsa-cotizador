'use server';

import { createClient } from '@/lib/supabase/server';
import { requireSesion } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export async function crearPlantilla(payload: { nombre: string; condiciones_comerciales: string; leyenda_pie: string }) {
  await requireSesion('PLANTILLAS_EDITAR');
  const supabase = createClient();
  if (!payload.nombre.trim()) return { error: 'El nombre es obligatorio.' };

  const { error } = await supabase.from('plantillas_cotizacion').insert(payload);
  if (error) return { error: error.message };

  revalidatePath('/plantillas');
  revalidatePath('/cotizaciones/nueva');
  return { ok: true };
}

export async function actualizarPlantilla(id: string, payload: { nombre: string; condiciones_comerciales: string; leyenda_pie: string }) {
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
