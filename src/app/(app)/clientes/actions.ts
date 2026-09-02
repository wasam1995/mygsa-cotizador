'use server';

import { createClient } from '@/lib/supabase/server';
import { requireSesion } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export async function crearCliente(payload: {
  codigo: string; nombre_razon: string; nit: string | null; direccion: string | null;
  telefono: string | null; contacto: string | null; es_retenedor_iva: boolean;
}) {
  await requireSesion('CLIENTES_EDITAR');
  const supabase = createClient();
  const { error } = await supabase.from('clientes').insert(payload);
  if (error) return { error: error.message };
  revalidatePath('/clientes');
  revalidatePath('/cotizaciones/nueva');
  return { ok: true };
}

export async function actualizarCliente(id: string, patch: {
  nombre_razon?: string; nit?: string | null; direccion?: string | null;
  telefono?: string | null; contacto?: string | null; es_retenedor_iva?: boolean; activo?: boolean;
}) {
  await requireSesion('CLIENTES_EDITAR');
  const supabase = createClient();
  const { error } = await supabase.from('clientes').update(patch).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/clientes');
  revalidatePath('/cotizaciones/nueva');
  return { ok: true };
}
