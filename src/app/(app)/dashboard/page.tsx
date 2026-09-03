import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireSesion } from '@/lib/auth';
import StatCard from '@/components/StatCard';
import StatusBadge from '@/components/StatusBadge';
import PageHeader from '@/components/PageHeader';
import { formatQ, formatFecha } from '@/lib/utils';
import type { Cotizacion } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const sesion = await requireSesion();
  const supabase = createClient();

  const verTodas = sesion.permisos.includes('COTIZACIONES_VER_TODAS');
  let query = supabase.from('cotizaciones').select('*, cliente:clientes(nombre_razon)').order('creado_en', { ascending: false });
  if (!verTodas && sesion.vendedorId) query = query.eq('vendedor_id', sesion.vendedorId);

  const { data: cotizaciones } = await query.limit(200);
  const lista = (cotizaciones ?? []) as (Cotizacion & { cliente: { nombre_razon: string } | null })[];

  const activos = lista.filter((c) => !['FACTURADO', 'ANULADO'].includes(c.estado));
  const pendAutorizar = lista.filter((c) => c.estado === 'PEND_AUTORIZAR');
  const facturadas = lista.filter((c) => c.estado === 'FACTURADO');
  const totalFacturado = facturadas.reduce((a, c) => a + Number(c.base_gravable), 0);
  const recientes = lista.slice(0, 8);

  return (
    <div className="space-y-6">
      <PageHeader titulo="Panel" subtitulo={`Bienvenido, ${sesion.nombreCompleto.split(' ')[0]} — así va la operación hoy.`} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard titulo="Cotizaciones activas" valor={String(activos.length)} tono="navy" />
        <StatCard titulo="Pend. de autorización" valor={String(pendAutorizar.length)} tono="orange"
          subtitulo={pendAutorizar.length > 0 ? 'Descuento mayor al 5%' : undefined} />
        <StatCard titulo="Facturadas" valor={String(facturadas.length)} tono="green" />
        <StatCard titulo="Base gravable facturada" valor={formatQ(totalFacturado)} tono="green" />
      </div>

      <div className="card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="section-title">Cotizaciones recientes</h2>
          <Link href="/cotizaciones" className="text-xs font-semibold text-navy-600 hover:underline">Ver todas →</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="table-head-row">
                <th className="py-2 pr-3">No.</th>
                <th className="py-2 pr-3">Fecha</th>
                <th className="py-2 pr-3">Cliente</th>
                <th className="py-2 pr-3">Total</th>
                <th className="py-2 pr-3">Estado</th>
              </tr>
            </thead>
            <tbody>
              {recientes.map((c) => (
                <tr key={c.id} className="table-row-hover">
                  <td className="py-2.5 pr-3">
                    <Link href={`/cotizaciones/${c.id}`} className="font-semibold text-navy-700 hover:underline">
                      {c.numero_interno}
                    </Link>
                  </td>
                  <td className="py-2.5 pr-3 text-slate-500">{formatFecha(c.fecha_emision)}</td>
                  <td className="py-2.5 pr-3">{c.cliente?.nombre_razon ?? c.cliente_nombre_libre ?? '—'}</td>
                  <td className="py-2.5 pr-3 font-medium">{formatQ(c.total_cotizado)}</td>
                  <td className="py-2.5 pr-3"><StatusBadge estado={c.estado} /></td>
                </tr>
              ))}
              {recientes.length === 0 && (
                <tr><td colSpan={5} className="py-8 text-center text-slate-400">Aún no hay cotizaciones.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
