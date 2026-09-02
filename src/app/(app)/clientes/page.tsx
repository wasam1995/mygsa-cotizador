import { createClient } from '@/lib/supabase/server';
import { requireSesion } from '@/lib/auth';
import ClientesClient from './ClientesClient';
import type { Cliente } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function ClientesPage() {
  const sesion = await requireSesion();
  const supabase = createClient();
  const { data } = await supabase.from('clientes').select('*').order('nombre_razon');

  return (
    <div>
      <h1 className="mb-5 text-xl font-bold text-slate-800">Clientes</h1>
      <ClientesClient clientes={(data ?? []) as Cliente[]} puedeEditar={sesion.permisos.includes('CLIENTES_EDITAR')} />
    </div>
  );
}
