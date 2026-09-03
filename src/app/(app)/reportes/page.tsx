import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireSesion } from '@/lib/auth';
import StatusBadge from '@/components/StatusBadge';
import StatCard from '@/components/StatCard';
import { formatQ, formatFecha } from '@/lib/utils';
import { ESTADOS_LABEL, type Cotizacion, type EstadoCotizacion } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function ReportesPage({
  searchParams,
}: { searchParams: { desde?: string; hasta?: string; estado?: string; q?: string } }) {
  await requireSesion('REPORTES_VER');
  const supabase = createClient();

  let query = supabase.from('cotizaciones')
    .select('*, cliente:clientes(nombre_razon), vendedor:vendedores(nombre_completo)')
    .order('fecha_emision', { ascending: false });

  if (searchParams.desde) query = query.gte('fecha_emision', searchParams.desde);
  if (searchParams.hasta) query = query.lte('fecha_emision', searchParams.hasta);
  if (searchParams.estado) query = query.eq('estado', searchParams.estado as EstadoCotizacion);

  const { data } = await query.limit(1000);
  let lista = (data ?? []) as (Cotizacion & { cliente: { nombre_razon: string } | null; vendedor: { nombre_completo: string } | null })[];

  if (searchParams.q) {
    const q = searchParams.q.toLowerCase();
    lista = lista.filter((c) =>
      c.numero_interno.toLowerCase().includes(q)
      || (c.numero_sistema_externo ?? '').toLowerCase().includes(q)
      || (c.cliente?.nombre_razon ?? c.cliente_nombre_libre ?? '').toLowerCase().includes(q)
      || (c.vendedor?.nombre_completo ?? '').toLowerCase().includes(q)
    );
  }

  const totalCotizado = lista.reduce((a, c) => a + Number(c.total_cotizado), 0);
  const totalFacturado = lista.filter((c) => c.estado === 'FACTURADO').reduce((a, c) => a + Number(c.total_cotizado), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="page-title">Reporte general de cotizaciones</h1>
        <div className="flex gap-2">
          <a href={`/api/reportes/csv?${new URLSearchParams(searchParams as Record<string, string>).toString()}`} className="btn btn-secondary">
            ⬇️ Exportar CSV
          </a>
          <a href={`/api/reportes/excel?${new URLSearchParams(searchParams as Record<string, string>).toString()}`} className="btn btn-secondary">
            ⬇️ Exportar Excel
          </a>
        </div>
      </div>

      <form className="card flex flex-wrap items-end gap-3">
        <div><label className="label">Desde</label><input type="date" name="desde" defaultValue={searchParams.desde} className="input" /></div>
        <div><label className="label">Hasta</label><input type="date" name="hasta" defaultValue={searchParams.hasta} className="input" /></div>
        <div>
          <label className="label">Estado</label>
          <select name="estado" defaultValue={searchParams.estado ?? ''} className="input">
            <option value="">Todos</option>
            {Object.entries(ESTADOS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-[200px]"><label className="label">Buscar (cliente, vendedor, No.)</label><input name="q" defaultValue={searchParams.q} className="input" /></div>
        <button className="btn btn-primary">Filtrar</button>
      </form>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard titulo="Cotizaciones" valor={String(lista.length)} />
        <StatCard titulo="Total cotizado (todas)" valor={formatQ(totalCotizado)} />
        <StatCard titulo="Total facturado" valor={formatQ(totalFacturado)} tono="green" />
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[880px] text-sm">
          <thead>
            <tr className="table-head-row">
              <th className="py-2 pr-2">No.</th><th className="py-2 pr-2">Fecha</th><th className="py-2 pr-2">Cliente</th>
              <th className="py-2 pr-2">Vendedor</th><th className="py-2 pr-2">Total</th><th className="py-2 pr-2">Estado</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((c) => (
              <tr key={c.id} className="table-row-hover">
                <td className="py-2 pr-2"><Link href={`/cotizaciones/${c.id}`} className="font-semibold text-navy-700 hover:underline">{c.numero_interno}</Link></td>
                <td className="py-2 pr-2 text-slate-500">{formatFecha(c.fecha_emision)}</td>
                <td className="py-2 pr-2">{c.cliente?.nombre_razon ?? c.cliente_nombre_libre}</td>
                <td className="py-2 pr-2">{c.vendedor?.nombre_completo}</td>
                <td className="py-2 pr-2 font-medium">{formatQ(c.total_cotizado)}</td>
                <td className="py-2 pr-2"><StatusBadge estado={c.estado} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
