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
