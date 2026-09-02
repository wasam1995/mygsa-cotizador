import { createClient } from '@/lib/supabase/server';
import { requireSesion } from '@/lib/auth';
import { formatQ, formatFecha } from '@/lib/utils';
import StatCard from '@/components/StatCard';
import type { ComisionCalculada, Vendedor } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function ComisionesPage({
  searchParams,
}: { searchParams: { desde?: string; hasta?: string; vendedor_id?: string } }) {
  const sesion = await requireSesion();
  const supabase = createClient();

  const verTodas = sesion.permisos.includes('COMISIONES_VER_TODAS');
  let query = supabase.from('comisiones_calculadas')
    .select('*, vendedor:vendedores(codigo, nombre_completo), cotizacion:cotizaciones(numero_interno, numero_sistema_externo)')
    .order('fecha_facturacion', { ascending: false });
  if (!verTodas && sesion.vendedorId) query = query.eq('vendedor_id', sesion.vendedorId);
  if (searchParams.desde) query = query.gte('fecha_facturacion', searchParams.desde);
  if (searchParams.hasta) query = query.lte('fecha_facturacion', searchParams.hasta);
  if (verTodas && searchParams.vendedor_id) query = query.eq('vendedor_id', searchParams.vendedor_id);

  const [{ data }, { data: vendedoresData }] = await Promise.all([
    query.limit(500),
    verTodas ? supabase.from('vendedores').select('*').eq('activo', true).order('nombre_completo') : Promise.resolve({ data: [] as Vendedor[] }),
  ]);
  const comisiones = (data ?? []) as (ComisionCalculada & {
    vendedor: { codigo: string; nombre_completo: string } | null;
    cotizacion: { numero_interno: string; numero_sistema_externo: string | null } | null;
  })[];
  const vendedores = (vendedoresData ?? []) as Vendedor[];

  const totalComision = comisiones.reduce((a, c) => a + Number(c.monto_comision), 0);
  const totalBase = comisiones.reduce((a, c) => a + Number(c.base_calculo), 0);

  const porVendedor = new Map<string, { nombre: string; base: number; comision: number; cantidad: number }>();
  for (const c of comisiones) {
    const key = c.vendedor?.codigo ?? '—';
    const actual = porVendedor.get(key) ?? { nombre: c.vendedor?.nombre_completo ?? '—', base: 0, comision: 0, cantidad: 0 };
    actual.base += Number(c.base_calculo);
    actual.comision += Number(c.monto_comision);
    actual.cantidad += 1;
    porVendedor.set(key, actual);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-800">Comisiones {verTodas ? 'por vendedor' : ''}</h1>
        <a href={`/api/comisiones/excel?${new URLSearchParams(searchParams as Record<string, string>).toString()}`} className="btn btn-secondary">
          ⬇️ Exportar Excel
        </a>
      </div>

      <form className="card flex flex-wrap items-end gap-3">
        <div><label className="label">Desde</label><input type="date" name="desde" defaultValue={searchParams.desde} className="input" /></div>
        <div><label className="label">Hasta</label><input type="date" name="hasta" defaultValue={searchParams.hasta} className="input" /></div>
        {verTodas && (
          <div>
            <label className="label">Vendedor</label>
            <select name="vendedor_id" defaultValue={searchParams.vendedor_id ?? ''} className="input min-w-[200px]">
              <option value="">Todos</option>
              {vendedores.map((v) => <option key={v.id} value={v.id}>{v.nombre_completo}</option>)}
            </select>
          </div>
        )}
        <button className="btn btn-primary">Filtrar</button>
      </form>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard titulo="Cotizaciones facturadas" valor={String(comisiones.length)} />
        <StatCard titulo="Base de cálculo total" valor={formatQ(totalBase)} />
        <StatCard titulo="Comisión total" valor={formatQ(totalComision)} tono="green" />
      </div>

      {verTodas && (
        <div className="card overflow-x-auto">
          <h2 className="mb-3 text-sm font-bold text-slate-700">Resumen por vendedor</h2>
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-400">
                <th className="py-2 pr-2">Vendedor</th><th className="py-2 pr-2">Cód.</th>
                <th className="py-2 pr-2"># Ventas</th><th className="py-2 pr-2">Base</th><th className="py-2 pr-2">Comisión</th>
              </tr>
            </thead>
            <tbody>
              {[...porVendedor.entries()].map(([codigo, v]) => (
                <tr key={codigo} className="border-b border-slate-100 last:border-0">
                  <td className="py-2 pr-2 font-medium">{v.nombre}</td>
                  <td className="py-2 pr-2 font-mono text-xs text-slate-500">{codigo}</td>
                  <td className="py-2 pr-2">{v.cantidad}</td>
                  <td className="py-2 pr-2">{formatQ(v.base)}</td>
                  <td className="py-2 pr-2 font-semibold text-emerald-700">{formatQ(v.comision)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card overflow-x-auto">
        <h2 className="mb-3 text-sm font-bold text-slate-700">Detalle</h2>
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-400">
              <th className="py-2 pr-2">Fecha</th><th className="py-2 pr-2">Cotización</th>
              {verTodas && <th className="py-2 pr-2">Vendedor</th>}
              <th className="py-2 pr-2">Base</th><th className="py-2 pr-2">%</th><th className="py-2 pr-2">Comisión</th>
            </tr>
          </thead>
          <tbody>
            {comisiones.map((c) => (
              <tr key={c.id} className="border-b border-slate-100 last:border-0">
                <td className="py-2 pr-2 text-slate-500">{formatFecha(c.fecha_facturacion)}</td>
                <td className="py-2 pr-2 text-navy-700">{c.cotizacion?.numero_sistema_externo ?? c.cotizacion?.numero_interno}</td>
                {verTodas && <td className="py-2 pr-2">{c.vendedor?.nombre_completo}</td>}
                <td className="py-2 pr-2">{formatQ(c.base_calculo)}</td>
                <td className="py-2 pr-2">{c.porcentaje_aplicado}%</td>
                <td className="py-2 pr-2 font-semibold text-emerald-700">{formatQ(c.monto_comision)}</td>
              </tr>
            ))}
            {comisiones.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-slate-400">Sin comisiones calculadas aún.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
