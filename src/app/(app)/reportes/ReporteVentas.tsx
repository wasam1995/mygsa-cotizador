import { createClient } from '@/lib/supabase/server';
import StatCard from '@/components/StatCard';
import { formatQ, formatPct } from '@/lib/utils';
import { obtenerVentasPorProducto, rangoMesActual } from '@/lib/reportes';
import type { SesionCompleta } from '@/lib/auth';
import type { Vendedor } from '@/lib/types';

export default async function ReporteVentas({
  sesion, searchParams,
}: {
  sesion: SesionCompleta;
  searchParams: { desde?: string; hasta?: string; vendedor_id?: string };
}) {
  const verTodas = sesion.permisos.includes('COMISIONES_VER_TODAS');
  const defecto = rangoMesActual();
  const desde = searchParams.desde || defecto.desde;
  const hasta = searchParams.hasta || defecto.hasta;
  const vendedorId = verTodas ? (searchParams.vendedor_id || null) : sesion.vendedorId;

  const supabase = createClient();
  const [{ filas, totales, cotizacionesIncluidas }, { data: vendedoresData }] = await Promise.all([
    obtenerVentasPorProducto({ desde, hasta, vendedorId }),
    verTodas ? supabase.from('vendedores').select('*').eq('activo', true).order('nombre_completo') : Promise.resolve({ data: [] as Vendedor[] }),
  ]);
  const vendedores = (vendedoresData ?? []) as Vendedor[];

  const paramsExport = new URLSearchParams({ desde, hasta, ...(vendedorId ? { vendedor_id: vendedorId } : {}) }).toString();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2">
        <a href={`/api/reportes/ventas-producto/csv?${paramsExport}`} className="btn btn-secondary">⬇️ Exportar CSV</a>
        <a href={`/api/reportes/ventas-producto/excel?${paramsExport}`} className="btn btn-secondary">⬇️ Exportar Excel</a>
      </div>

      <form className="card flex flex-wrap items-end gap-3">
        <input type="hidden" name="tab" value="ventas" />
        <div><label className="label">Desde</label><input type="date" name="desde" defaultValue={desde} className="input" /></div>
        <div><label className="label">Hasta</label><input type="date" name="hasta" defaultValue={hasta} className="input" /></div>
        {verTodas && (
          <div>
            <label className="label">Vendedor</label>
            <select name="vendedor_id" defaultValue={searchParams.vendedor_id ?? ''} className="input">
              <option value="">Todos</option>
              {vendedores.map((v) => <option key={v.id} value={v.id}>{v.nombre_completo}</option>)}
            </select>
          </div>
        )}
        <button className="btn btn-primary">Filtrar</button>
      </form>

      <p className="text-xs text-slate-400">
        Basado en {cotizacionesIncluidas} cotización{cotizacionesIncluidas === 1 ? '' : 'es'} facturada{cotizacionesIncluidas === 1 ? '' : 's'} entre el {desde} y el {hasta} (por fecha de facturación).
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard titulo="Ventas del período" valor={formatQ(totales.venta_total)} tono="navy" />
        <StatCard titulo="Costo total" valor={formatQ(totales.costo_total)} tono="red" />
        <StatCard titulo="Utilidad" valor={formatQ(totales.utilidad)} subtitulo={`Margen ${formatPct(totales.margen_pct)}`} tono="green" />
        <StatCard titulo="Comisión atribuida" valor={formatQ(totales.comision_atribuida)} tono="orange" />
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[880px] text-sm">
          <thead>
            <tr className="table-head-row">
              <th className="py-2 pr-2">Código</th>
              <th className="py-2 pr-2">Producto</th>
              <th className="py-2 pr-2 text-right">Cant. vendida</th>
              <th className="py-2 pr-2 text-right">Costo total</th>
              <th className="py-2 pr-2 text-right">Venta total</th>
              <th className="py-2 pr-2 text-right">Utilidad</th>
              <th className="py-2 pr-2 text-right">Margen</th>
              <th className="py-2 pr-2 text-right">Comisión atrib.</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={`${f.producto_id ?? 'libre'}-${f.codigo}-${f.nombre}`} className="table-row-hover">
                <td className="py-2 pr-2 text-slate-500">{f.codigo}</td>
                <td className="py-2 pr-2">{f.nombre}</td>
                <td className="py-2 pr-2 text-right">{f.cantidad.toLocaleString('es-GT')}</td>
                <td className="py-2 pr-2 text-right text-red-600">{formatQ(f.costo_total)}</td>
                <td className="py-2 pr-2 text-right font-medium">{formatQ(f.venta_total)}</td>
                <td className="py-2 pr-2 text-right text-emerald-700">{formatQ(f.utilidad)}</td>
                <td className="py-2 pr-2 text-right">{formatPct(f.margen_pct)}</td>
                <td className="py-2 pr-2 text-right text-brand-orangeDark">{formatQ(f.comision_atribuida)}</td>
              </tr>
            ))}
            {filas.length === 0 && (
              <tr><td colSpan={8} className="py-8 text-center text-slate-400">No hay ventas facturadas en este período.</td></tr>
            )}
          </tbody>
          {filas.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-slate-200 font-bold">
                <td className="py-2 pr-2" colSpan={2}>Total</td>
                <td className="py-2 pr-2 text-right">{totales.cantidad.toLocaleString('es-GT')}</td>
                <td className="py-2 pr-2 text-right text-red-600">{formatQ(totales.costo_total)}</td>
                <td className="py-2 pr-2 text-right">{formatQ(totales.venta_total)}</td>
                <td className="py-2 pr-2 text-right text-emerald-700">{formatQ(totales.utilidad)}</td>
                <td className="py-2 pr-2 text-right">{formatPct(totales.margen_pct)}</td>
                <td className="py-2 pr-2 text-right text-brand-orangeDark">{formatQ(totales.comision_atribuida)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
