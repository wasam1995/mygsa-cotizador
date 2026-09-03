import { createClient } from '@/lib/supabase/server';
import { requireSesion } from '@/lib/auth';
import InventarioClient from './InventarioClient';
import type { Producto } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function InventarioPage() {
  const sesion = await requireSesion('INVENTARIO_VER');
  const supabase = createClient();
  const { data } = await supabase.from('v_productos_disponibles').select('*').order('codigo');

  return (
    <div>
      <h1 className="mb-5 page-title">Inventario</h1>
      <InventarioClient productos={(data ?? []) as Producto[]} puedeEditar={sesion.permisos.includes('INVENTARIO_EDITAR')} />
    </div>
  );
}
