'use server';

import { createClient } from '@/lib/supabase/server';
import { requireSesion } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import type { EscalaComision, ParametrosFiscales } from '@/lib/types';

export async function actualizarParametros(payload: Partial<ParametrosFiscales>) {
  await requireSesion('PARAMETROS_EDITAR');
  const supabase = createClient();

  // Antes esto no revisaba si en verdad se actualizó una fila — si RLS bloqueaba la
  // escritura (o el id=1 no existiera), Supabase no devuelve error, solo 0 filas
  // afectadas, y la pantalla igual mostraba "Parámetros actualizados" sin haber guardado
  // nada. Por eso se pide de vuelta la fila con .select() y se revisa que sí vino.
  const { data, error } = await supabase.from('parametros_fiscales').update(payload).eq('id', 1).select('id');
  if (error) return { error: error.message };
  if (!data || data.length === 0) {
    return { error: 'No se guardó ningún cambio — su usuario no tiene permiso para editar Parámetros a nivel de base de datos (revisar Usuarios → Roles y permisos).' };
  }

  revalidatePath('/parametros');
  revalidatePath('/cotizaciones/nueva');
  return { ok: true };
}

export async function actualizarEscalaComision(rango: number, patch: Partial<Pick<EscalaComision, 'desde_pct' | 'hasta_pct' | 'porcentaje_comision' | 'observacion'>>) {
  await requireSesion('PARAMETROS_EDITAR');
  const supabase = createClient();

  // Mismo punto que actualizarParametros: sin .select() de vuelta, un update bloqueado
  // por RLS (o un rango que ya no existe) se reporta como "éxito" sin haber cambiado nada
  // — que es exactamente el síntoma de "guardo y al volver sigue en 0".
  const { data, error } = await supabase.from('escalas_comision').update(patch).eq('rango', rango).select('rango');
  if (error) return { error: error.message };
  if (!data || data.length === 0) {
    return { error: `No se guardó el rango ${rango} — no tiene permiso a nivel de base de datos, o ese rango ya no existe. Revise Usuarios → Roles y permisos, o recargue la página.` };
  }

  revalidatePath('/parametros');
  revalidatePath('/cotizaciones/nueva');
  return { ok: true };
}

export async function crearEscalaComision() {
  await requireSesion('PARAMETROS_EDITAR');
  const supabase = createClient();

  const { data: max } = await supabase.from('escalas_comision').select('rango').order('rango', { ascending: false }).limit(1).single();
  const siguienteRango = (max?.rango ?? 0) + 1;

  const { data, error } = await supabase.from('escalas_comision').insert({
    rango: siguienteRango, desde_pct: 0, hasta_pct: null, porcentaje_comision: 0, observacion: '',
  }).select('rango');
  if (error) return { error: error.message };
  if (!data || data.length === 0) {
    return { error: 'No se creó el rango nuevo — su usuario no tiene permiso para editar Parámetros a nivel de base de datos.' };
  }

  revalidatePath('/parametros');
  revalidatePath('/cotizaciones/nueva');
  return { ok: true };
}

export async function eliminarEscalaComision(rango: number) {
  await requireSesion('PARAMETROS_EDITAR');
  const supabase = createClient();

  const { data, error } = await supabase.from('escalas_comision').delete().eq('rango', rango).select('rango');
  if (error) return { error: error.message };
  if (!data || data.length === 0) {
    return { error: `No se eliminó el rango ${rango} — no tiene permiso a nivel de base de datos, o ya no existía.` };
  }

  revalidatePath('/parametros');
  revalidatePath('/cotizaciones/nueva');
  return { ok: true };
}
