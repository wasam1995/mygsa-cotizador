import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export interface SesionCompleta {
  userId: string;
  correo: string;
  nombreCompleto: string;
  telefono: string | null;
  rolCodigo: string;
  rolNombre: string;
  permisos: string[];
  vendedorId: string | null;
}

// Trae el usuario autenticado + su perfil (app.usuarios), rol y permisos resueltos.
// Se usa en cada Server Component protegido para decidir qué renderizar/permitir.
export async function getSesion(): Promise<SesionCompleta | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: usuario } = await supabase
    .from('usuarios')
    .select('id, nombre_completo, correo, telefono, rol:roles(id, codigo, nombre)')
    .eq('id', user.id)
    .single();

  // Si no está el registro en la tabla 'usuarios', devolvemos datos por defecto basados en el Auth user
  if (!usuario) {
    return {
      userId: user.id,
      correo: user.email ?? '',
      nombreCompleto: user.email?.split('@')[0] ?? 'Usuario',
      telefono: null,
      rolCodigo: 'ADMINISTRADOR',
      rolNombre: 'Administrador',
      permisos: [
        'COTIZACIONES_VER_TODAS',
        'COTIZACIONES_CREAR',
        'COTIZACIONES_EDITAR',
        'INVENTARIO_VER',
        'CLIENTES_VER',
      ],
      vendedorId: null,
    };
  }

  const rol = Array.isArray((usuario as any).rol) ? (usuario as any).rol[0] : (usuario as any).rol;

  const { data: permisosRows } = await supabase
    .from('roles_permisos')
    .select('permiso:permisos(codigo)')
    .eq('rol_id', rol?.id);

  const permisos = (permisosRows || []).map((r: any) =>
    Array.isArray(r.permiso) ? r.permiso[0]?.codigo : r.permiso?.codigo
  ).filter(Boolean);

  const { data: vendedor } = await supabase
    .from('vendedores')
    .select('id')
    .eq('usuario_id', user.id)
    .maybeSingle();

  return {
    userId: user.id,
    correo: usuario.correo,
    nombreCompleto: usuario.nombre_completo,
    telefono: usuario.telefono,
    rolCodigo: rol?.codigo ?? 'ADMINISTRADOR',
    rolNombre: rol?.nombre ?? 'Administrador',
    permisos,
    vendedorId: vendedor?.id ?? null,
  };
}

export async function requireSesion(permisoRequerido?: string): Promise<SesionCompleta> {
  const sesion = await getSesion();
  if (!sesion) redirect('/login');
  if (permisoRequerido && !sesion.permisos.includes(permisoRequerido)) {
    redirect('/dashboard?error=sin_permiso');
  }
  return sesion;
}
