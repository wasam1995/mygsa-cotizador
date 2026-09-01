import { createClient } from '@/lib/supabase/server';
import { requireSesion } from '@/lib/auth';
import UsuariosClient from './UsuariosClient';
import type { Usuario, Rol, Permiso } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function UsuariosPage() {
  await requireSesion('USUARIOS_ADMINISTRAR');
  const supabase = createClient();

  const [{ data: usuarios }, { data: roles }, { data: permisos }, { data: rolesPermisos }] = await Promise.all([
    supabase.from('usuarios').select('*, rol:roles(id, codigo, nombre)').order('nombre_completo'),
    supabase.from('roles').select('*').order('nombre'),
    supabase.from('permisos').select('*').order('modulo'),
    supabase.from('roles_permisos').select('rol_id, permiso:permisos(codigo)'),
  ]);

  const permisosPorRol = new Map<string, string[]>();
  for (const rp of (rolesPermisos ?? []) as any[]) {
    const codigo = Array.isArray(rp.permiso) ? rp.permiso[0]?.codigo : rp.permiso?.codigo;
    if (!codigo) continue;
    const lista = permisosPorRol.get(rp.rol_id) ?? [];
    lista.push(codigo);
    permisosPorRol.set(rp.rol_id, lista);
  }

  return (
    <div>
      <h1 className="mb-5 text-xl font-bold text-slate-800">Usuarios y roles</h1>
      <UsuariosClient
        usuarios={(usuarios ?? []) as (Usuario & { rol: { id: string; codigo: string; nombre: string } | null })[]}
        roles={(roles ?? []) as Rol[]}
        permisos={(permisos ?? []) as Permiso[]}
        permisosPorRolInicial={Object.fromEntries(permisosPorRol)}
      />
    </div>
  );
}
