'use server';

import { createClient } from '@/lib/supabase/server';
import { requireSesion } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export async function crearVendedor(payload: {
  codigo: string; nombre_completo: string; telefono: string | null; correo: string | null;
  porcentaje_comision: number; usuario_id: string | null;
}) {
  await requireSesion('VENDEDORES_EDITAR');
  const supabase = createClient();
  const { error } = await supabase.from('vendedores').insert(payload);
  if (error) return { error: error.message };
  revalidatePath('/vendedores');
  revalidatePath('/cotizaciones/nueva');
  return { ok: true };
}

export async function actualizarVendedor(id: string, patch: {
  nombre_completo?: string; telefono?: string | null; correo?: string | null;
  porcentaje_comision?: number; usuario_id?: string | null; activo?: boolean;
}) {
  await requireSesion('VENDEDORES_EDITAR');
  const supabase = createClient();
  const { error } = await supabase.from('vendedores').update(patch).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/vendedores');
  revalidatePath('/cotizaciones/nueva');
  return { ok: true };
}

// Elimina definitivamente un vendedor. Solo es posible si no tiene cotizaciones,
// comisiones o liquidaciones asociadas (relaciones RESTRICT a propósito, para no perder
// trazabilidad financiera) — si las tiene, se debe usar "Desactivar" en su lugar.
export async function eliminarVendedor(id: string) {
  await requireSesion('VENDEDORES_EDITAR');
  const supabase = createClient();
  const { error } = await supabase.from('vendedores').delete().eq('id', id);
  if (error) {
    if (error.code === '23503') {
      return { error: 'Este vendedor tiene cotizaciones, comisiones o liquidaciones asociadas — no se puede eliminar. Use "Desactivar" en su lugar para quitarlo de las listas sin perder el historial.' };
    }
    return { error: error.message };
  }
  revalidatePath('/vendedores');
  revalidatePath('/cotizaciones/nueva');
  return { ok: true };
}
