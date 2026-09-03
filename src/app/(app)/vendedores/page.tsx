import { createClient } from '@/lib/supabase/server';
import { requireSesion } from '@/lib/auth';
import VendedoresClient from './VendedoresClient';
import type { Vendedor } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function VendedoresPage() {
  const sesion = await requireSesion();
  const supabase = createClient();

  const [{ data: vendedores }, { data: usuarios }] = await Promise.all([
    supabase.from('vendedores').select('*').order('nombre_completo'),
    supabase.from('usuarios').select('id, nombre_completo, correo').eq('activo', true).order('nombre_completo'),
  ]);

  return (
    <div>
      <h1 className="mb-5 page-title">Vendedores</h1>
      <VendedoresClient
        vendedores={(vendedores ?? []) as Vendedor[]}
        usuarios={(usuarios ?? []) as { id: string; nombre_completo: string; correo: string }[]}
        puedeEditar={sesion.permisos.includes('VENDEDORES_EDITAR')}
      />
    </div>
  );
}
