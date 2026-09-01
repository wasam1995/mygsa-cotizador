'use server';

import { createClient } from '@/lib/supabase/server';
import { requireSesion } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import type { ParametrosFiscales } from '@/lib/types';

export async function actualizarParametros(payload: Partial<ParametrosFiscales>) {
  await requireSesion('PARAMETROS_EDITAR');
  const supabase = createClient();

  const { error } = await supabase.from('parametros_fiscales').update(payload).eq('id', 1);
  if (error) return { error: error.message };

  revalidatePath('/parametros');
  revalidatePath('/cotizaciones/nueva');
  return { ok: true };
}
