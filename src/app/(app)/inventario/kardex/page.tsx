import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireSesion } from '@/lib/auth';
import { formatFecha } from '@/lib/utils';
import type { MovimientoInventario } from '@/lib/types';

export const dynamic = 'force-dynamic';

const TIPO_COLOR: Record<string, string> = {
  ENTRADA: 'bg-emerald-100 text-emerald-700',
  SALIDA: 'bg-red-100 text-red-700',
  RESERVA: 'bg-amber-100 text-amber-700',
  LIBERA_RESERVA: 'bg-slate-100 text-slate-600',
  ANULACION: 'bg-orange-100 text-orange-700',
  AJUSTE: 'bg-sky-100 text-sky-700',
};

export default async function KardexPage({ searchParams }: { searchParams: { producto?: string; tipo?: string; cotizacion?: string } }) {
  await requireSesion('INVENTARIO_VER');
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

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[920px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-400">
              <th className="py-2 pr-2">Fecha</th><th className="py-2 pr-2">Tipo</th>
              <th className="py-2 pr-2">Producto</th><th className="py-2 pr-2">Cant.</th>
              <th className="py-2 pr-2">Cotización</th><th className="py-2 pr-2">Cliente</th>
              <th className="py-2 pr-2">Vendedor</th><th className="py-2 pr-2">Stock result.</th>
            </tr>
          </thead>
          <tbody>
            {movimientos.map((m) => (
              <tr key={m.id} className="border-b border-slate-100 last:border-0">
                <td className="py-2 pr-2 text-slate-500">{formatFecha(m.creado_en)}</td>
                <td className="py-2 pr-2"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${TIPO_COLOR[m.tipo]}`}>{m.tipo}</span></td>
                <td className="py-2 pr-2">{m.producto?.codigo} — {m.producto?.nombre}</td>
                <td className="py-2 pr-2 font-medium">{m.cantidad}</td>
                <td className="py-2 pr-2 text-navy-700">
                  {m.cotizacion_id ? (
                    <Link href={`/cotizaciones/${m.cotizacion_id}`} className="font-semibold hover:underline">{m.numero_cotizacion ?? 'Ver'}</Link>
                  ) : (m.numero_cotizacion ?? '—')}
                </td>
                <td className="py-2 pr-2">{m.cliente_nombre ?? '—'}</td>
                <td className="py-2 pr-2">{m.vendedor_nombre ?? '—'}</td>
                <td className="py-2 pr-2 text-slate-500">{m.stock_resultante ?? '—'}</td>
              </tr>
            ))}
            {movimientos.length === 0 && <tr><td colSpan={8} className="py-8 text-center text-slate-400">Sin movimientos.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
