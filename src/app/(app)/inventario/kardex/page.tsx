import { createClient } from '@/lib/supabase/server';
import { requireSesion } from '@/lib/auth';
import KardexClient from './KardexClient';
import type { MovimientoInventario } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function KardexPage({ searchParams }: { searchParams: { producto?: string; tipo?: string; cotizacion?: string } }) {
  const sesion = await requireSesion('INVENTARIO_VER');
  const supabase = createClient();

  let query = supabase.from('movimientos_inventario')
    .select('*, producto:productos(codigo, nombre)')
    .order('creado_en', { ascending: false })
    .limit(500);

  if (searchParams.tipo) query = query.eq('tipo', searchParams.tipo);
  if (searchParams.cotizacion) query = query.ilike('numero_cotizacion', `%${searchParams.cotizacion}%`);

  const { data } = await query;
  const movimientos = (data ?? []) as (MovimientoInventario & { producto: { codigo: string; nombre: string } | null })[];

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-800">Kardex de inventario</h1>
        <a href={`/api/kardex/excel?${new URLSearchParams(searchParams as Record<string, string>).toString()}`} className="btn btn-secondary">
          ⬇️ Exportar Excel
        </a>
      </div>
      <p className="mb-4 text-sm text-slate-500">
        Historial de entradas, salidas, reservas, anulaciones y ajustes — con cotización, cliente y vendedor asociados.
      </p>

      <form className="mb-4 flex flex-wrap gap-2" action="/inventario/kardex">
        <select name="tipo" defaultValue={searchParams.tipo ?? ''} className="input max-w-[220px]">
          <option value="">Todos los movimientos</option>
          <option value="ENTRADA">Entradas</option>
          <option value="SALIDA">Salidas</option>
          <option value="RESERVA">Reservas</option>
          <option value="LIBERA_RESERVA">Liberación de reserva</option>
          <option value="ANULACION">Anulaciones</option>
          <option value="AJUSTE">Ajustes</option>
        </select>
        <input name="cotizacion" defaultValue={searchParams.cotizacion ?? ''} placeholder="No. de cotización" className="input max-w-[220px]" />
        <button className="btn btn-secondary">Filtrar</button>
      </form>

      <KardexClient movimientos={movimientos} puedeEliminar={sesion.permisos.includes('INVENTARIO_ELIMINAR_KARDEX')} />
    </div>
  );
}
