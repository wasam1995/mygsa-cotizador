'use server';

import { createClient } from '@/lib/supabase/server';
import { requireSesion } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import type { EscalaComision, ParametrosFiscales } from '@/lib/types';

export async function actualizarParametros(payload: Partial<ParametrosFiscales>) {
  await requireSesion('PARAMETROS_EDITAR');
  const supabase = createClient();

  const { error } = await supabase.from('parametros_fiscales').update(payload).eq('id', 1);
  if (error) return { error: error.message };

  revalidatePath('/parametros');
  revalidatePath('/cotizaciones/nueva');
  return { ok: true };
}

export async function actualizarEscalaComision(rango: number, patch: Partial<Pick<EscalaComision, 'desde_pct' | 'hasta_pct' | 'porcentaje_comision' | 'observacion'>>) {
  await requireSesion('PARAMETROS_EDITAR');
  const supabase = createClient();

  const { error } = await supabase.from('escalas_comision').update(patch).eq('rango', rango);
  if (error) return { error: error.message };

  revalidatePath('/parametros');
  revalidatePath('/cotizaciones/nueva');
  return { ok: true };
}

export async function crearEscalaComision() {
  await requireSesion('PARAMETROS_EDITAR');
  const supabase = createClient();

  const { data: max } = await supabase.from('escalas_comision').select('rango').order('rango', { ascending: false }).limit(1).single();
  const siguienteRango = (max?.rango ?? 0) + 1;

  const { error } = await supabase.from('escalas_comision').insert({
    rango: siguienteRango, desde_pct: 0, hasta_pct: null, porcentaje_comision: 0, observacion: '',
  });
  if (error) return { error: error.message };

  revalidatePath('/parametros');
  revalidatePath('/cotizaciones/nueva');
  return { ok: true };
}

export async function eliminarEscalaComision(rango: number) {
  await requireSesion('PARAMETROS_EDITAR');
  const supabase = createClient();

  const { error } = await supabase.from('escalas_comision').delete().eq('rango', rango);
  if (error) return { error: error.message };

  revalidatePath('/parametros');
  revalidatePath('/cotizaciones/nueva');
  return { ok: true };
}
