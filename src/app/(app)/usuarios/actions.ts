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

  // Causa real del bug de "se me fueron todos los permisos de Administrador": esto hacía
  // DELETE de todos los permisos del rol y luego INSERT del set nuevo como dos llamadas
  // separadas. La política RLS de roles_permisos exige tener USUARIOS_ADMINISTRAR tanto
  // para borrar como para insertar — si la persona editaba los permisos de SU PROPIO rol y
  // el cambio incluía soltar USUARIOS_ADMINISTRAR, el DELETE la dejaba sin permisos, y para
  // cuando corría el INSERT ya no tenía permiso para escribir: Postgres bloqueaba el INSERT
  // en silencio (RLS no da error, solo 0 filas), y el rol quedaba sin ningún permiso.
  // Ahora se usa una función de base de datos (SECURITY DEFINER, ver database/21_correccion_
  // autobloqueo_permisos_rol.sql) que hace el borrado + inserción como una sola transacción
  // atómica con privilegios propios — nunca puede auto-bloquearse ni quedar a medias.
  const { error } = await supabase.rpc('actualizar_permisos_rol', {
    p_rol_id: rolId,
    p_permiso_codigos: permisoCodigos,
  });
  if (error) return { error: `No se pudieron actualizar los permisos: ${error.message}` };

  revalidatePath('/usuarios');
  return { ok: true };
}

// Elimina definitivamente un usuario (perfil + acceso de inicio de sesión). Solo es
// posible si no tiene historial asociado (cotizaciones creadas/autorizadas/facturadas/
// anuladas por él, adjuntos subidos, etc.) — esas relaciones son RESTRICT a propósito
// para no perder trazabilidad. Si tiene historial, se debe usar "Desactivar" en su lugar.
export async function eliminarUsuario(usuarioId: string) {
  const sesion = await requireSesion('USUARIOS_ADMINISTRAR');
  if (usuarioId === sesion.userId) return { error: 'No puede eliminar su propio usuario.' };

  const supabase = createClient();
  const { error } = await supabase.from('usuarios').delete().eq('id', usuarioId);
  if (error) {
    if (error.code === '23503') {
      return { error: 'Este usuario tiene cotizaciones u otro historial asociado (creadas, autorizadas, facturadas o anuladas por él) — no se puede eliminar. Use "Desactivar" en su lugar para quitarle el acceso sin perder el historial.' };
    }
    return { error: error.message };
  }

  const admin = createAdminClient();
  const { error: errAuth } = await admin.auth.admin.deleteUser(usuarioId);
  if (errAuth) {
    revalidatePath('/usuarios');
    return { error: `Se eliminó el perfil pero no se pudo eliminar el acceso de inicio de sesión: ${errAuth.message}` };
  }

  revalidatePath('/usuarios');
  return { ok: true };
}
