'use server';

import { createClient, createAdminClient } from '@/lib/supabase/server';
import { requireSesion } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export async function crearUsuario(payload: {
  nombre_completo: string; correo: string; telefono: string | null; rol_id: string; password: string; crear_vendedor: boolean; codigo_vendedor?: string; porcentaje_comision?: number;
}) {
  await requireSesion('USUARIOS_ADMINISTRAR');
  const admin = createAdminClient();

  const { data: creado, error: errAuth } = await admin.auth.admin.createUser({
    email: payload.correo,
    password: payload.password,
    email_confirm: true,
  });
  if (errAuth || !creado?.user) return { error: errAuth?.message ?? 'No se pudo crear el usuario.' };

  const supabase = createClient();
  const { error: errPerfil } = await supabase.from('usuarios').insert({
    id: creado.user.id,
    nombre_completo: payload.nombre_completo,
    correo: payload.correo,
    telefono: payload.telefono,
    rol_id: payload.rol_id,
  });
  if (errPerfil) return { error: errPerfil.message };

  if (payload.crear_vendedor && payload.codigo_vendedor) {
    await supabase.from('vendedores').insert({
      usuario_id: creado.user.id,
      codigo: payload.codigo_vendedor,
      nombre_completo: payload.nombre_completo,
      telefono: payload.telefono,
      correo: payload.correo,
      porcentaje_comision: payload.porcentaje_comision ?? 0,
    });
  }

  revalidatePath('/usuarios');
  return { ok: true };
}

export async function cambiarRolUsuario(usuarioId: string, rolId: string) {
  await requireSesion('USUARIOS_ADMINISTRAR');
  const supabase = createClient();
  const { error } = await supabase.from('usuarios').update({ rol_id: rolId }).eq('id', usuarioId);
  if (error) return { error: error.message };
  revalidatePath('/usuarios');
  return { ok: true };
}

export async function activarDesactivarUsuario(usuarioId: string, activo: boolean) {
  await requireSesion('USUARIOS_ADMINISTRAR');
  const supabase = createClient();
  const { error } = await supabase.from('usuarios').update({ activo }).eq('id', usuarioId);
  if (error) return { error: error.message };
  revalidatePath('/usuarios');
  return { ok: true };
}

export async function crearRol(payload: { codigo: string; nombre: string; descripcion: string; permisoCodigos: string[] }) {
  await requireSesion('USUARIOS_ADMINISTRAR');
  const supabase = createClient();

  const { data: rol, error } = await supabase.from('roles')
    .insert({ codigo: payload.codigo.toUpperCase().replace(/\s+/g, '_'), nombre: payload.nombre, descripcion: payload.descripcion, es_sistema: false })
    .select('id').single();
  if (error || !rol) return { error: error?.message ?? 'No se pudo crear el rol.' };

  if (payload.permisoCodigos.length > 0) {
    const { data: permisos } = await supabase.from('permisos').select('id, codigo').in('codigo', payload.permisoCodigos);
    const filas = (permisos ?? []).map((p) => ({ rol_id: rol.id, permiso_id: p.id }));
    if (filas.length > 0) await supabase.from('roles_permisos').insert(filas);
  }

  revalidatePath('/usuarios');
  return { ok: true };
}

export async function actualizarPermisosRol(rolId: string, permisoCodigos: string[]) {
  await requireSesion('USUARIOS_ADMINISTRAR');
  const supabase = createClient();

  await supabase.from('roles_permisos').delete().eq('rol_id', rolId);
  if (permisoCodigos.length > 0) {
    const { data: permisos } = await supabase.from('permisos').select('id, codigo').in('codigo', permisoCodigos);
    const filas = (permisos ?? []).map((p) => ({ rol_id: rolId, permiso_id: p.id }));
    if (filas.length > 0) await supabase.from('roles_permisos').insert(filas);
  }
  revalidatePath('/usuarios');
  return { ok: true };
}
