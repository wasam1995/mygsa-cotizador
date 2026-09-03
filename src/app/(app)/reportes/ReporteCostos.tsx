import { createClient } from '@/lib/supabase/server';
import StatCard from '@/components/StatCard';
import { formatQ, formatPct } from '@/lib/utils';
import { obtenerCostosPorPeriodo, rangoMesActual, type AgruparCostosPor } from '@/lib/reportes';
import type { SesionCompleta } from '@/lib/auth';
import type { Vendedor } from '@/lib/types';

export default async function ReporteCostos({
  sesion, searchParams,
}: {
  sesion: SesionCompleta;
  searchParams: { desde?: string; hasta?: string; vendedor_id?: string; agrupar?: string };
}) {
  const verTodas = sesion.permisos.includes('COMISIONES_VER_TODAS');
  const defecto = rangoMesActual();
  // Para el reporte de costos por período conviene un rango más amplio por defecto (el
  // año en curso) — comparar meses de un solo mes no aporta mucho.
  const desdeDefecto = `${defecto.hasta.slice(0, 4)}-01-01`;
  const desde = searchParams.desde || desdeDefecto;
  const hasta = searchParams.hasta || defecto.hasta;
  const vendedorId = verTodas ? (searchParams.vendedor_id || null) : sesion.vendedorId;
  const agrupar: AgruparCostosPor = searchParams.agrupar === 'vendedor' ? 'vendedor' : 'mes';

  const supabase = createClient();
  const [{ filas, totales }, { data: vendedoresData }] = await Promise.all([
    obtenerCostosPorPeriodo({ desde, hasta, vendedorId, agrupar }),
    verTodas ? supabase.from('vendedores').select('*').eq('activo', true).order('nombre_completo') : Promise.resolve({ data: [] as Vendedor[] }),
  ]);
  const vendedores = (vendedoresData ?? []) as Vendedor[];

  const paramsExport = new URLSearchParams({ desde, hasta, agrupar, ...(vendedorId ? { vendedor_id: vendedorId } : {}) }).toString();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2">
        <a href={`/api/reportes/costos-periodo/csv?${paramsExport}`} className="btn btn-secondary">⬇️ Exportar CSV</a>
        <a href={`/api/reportes/costos-periodo/excel?${paramsExport}`} className="btn btn-secondary">⬇️ Exportar Excel</a>
      </div>

      <form className="card flex flex-wrap items-end gap-3">
        <input type="hidden" name="tab" value="costos" />
        <div><label className="label">Desde</label><input type="date" name="desde" defaultValue={desde} className="input" /></div>
        <div><label className="label">Hasta</label><input type="date" name="hasta" defaultValue={hasta} className="input" /></div>
        <div>
          <label className="label">Agrupar por</label>
          <select name="agrupar" defaultValue={agrupar} className="input">
            <option value="mes">Mes</option>
            {verTodas && <option value="vendedor">Vendedor</option>}
          </select>
        </div>
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
        Cotizaciones facturadas entre el {desde} y el {hasta}, agrupadas por {agrupar === 'mes' ? 'mes de facturación' : 'vendedor'}.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard titulo="Cotizaciones facturadas" valor={String(totales.cotizaciones)} tono="navy" />
        <StatCard titulo="Costo de operación total" valor={formatQ(totales.costo_operacion)} tono="red"
          subtitulo={`Productos ${formatQ(totales.costo_productos)} · Operativos ${formatQ(totales.costos_operativos)}`} />
        <StatCard titulo="Ventas del período" valor={formatQ(totales.venta_total)} tono="orange" />
        <StatCard titulo="Utilidad bruta" valor={formatQ(totales.utilidad_bruta)} subtitulo={`Margen ${formatPct(totales.margen_pct)}`} tono="green" />
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[880px] text-sm">
          <thead>
            <tr className="table-head-row">
              <th className="py-2 pr-2">{agrupar === 'mes' ? 'Mes' : 'Vendedor'}</th>
              <th className="py-2 pr-2 text-right">Cotizaciones</th>
              <th className="py-2 pr-2 text-right">Costo productos</th>
              <th className="py-2 pr-2 text-right">Costos operativos</th>
              <th className="py-2 pr-2 text-right">Costo total operación</th>
              <th className="py-2 pr-2 text-right">Ventas</th>
              <th className="py-2 pr-2 text-right">Utilidad bruta</th>
              <th className="py-2 pr-2 text-right">Margen</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.clave} className="table-row-hover">
                <td className="py-2 pr-2 font-semibold text-slate-700">{f.etiqueta}</td>
                <td className="py-2 pr-2 text-right">{f.cotizaciones}</td>
                <td className="py-2 pr-2 text-right text-red-600">{formatQ(f.costo_productos)}</td>
                <td className="py-2 pr-2 text-right text-red-600">{formatQ(f.costos_operativos)}</td>
                <td className="py-2 pr-2 text-right font-medium text-red-700">{formatQ(f.costo_operacion)}</td>
                <td className="py-2 pr-2 text-right">{formatQ(f.venta_total)}</td>
                <td className="py-2 pr-2 text-right text-emerald-700">{formatQ(f.utilidad_bruta)}</td>
                <td className="py-2 pr-2 text-right">{formatPct(f.margen_pct)}</td>
              </tr>
            ))}
            {filas.length === 0 && (
              <tr><td colSpan={8} className="py-8 text-center text-slate-400">No hay cotizaciones facturadas en este período.</td></tr>
            )}
          </tbody>
          {filas.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-slate-200 font-bold">
                <td className="py-2 pr-2">Total</td>
                <td className="py-2 pr-2 text-right">{totales.cotizaciones}</td>
                <td className="py-2 pr-2 text-right text-red-600">{formatQ(totales.costo_productos)}</td>
                <td className="py-2 pr-2 text-right text-red-600">{formatQ(totales.costos_operativos)}</td>
                <td className="py-2 pr-2 text-right text-red-700">{formatQ(totales.costo_operacion)}</td>
                <td className="py-2 pr-2 text-right">{formatQ(totales.venta_total)}</td>
                <td className="py-2 pr-2 text-right text-emerald-700">{formatQ(totales.utilidad_bruta)}</td>
                <td className="py-2 pr-2 text-right">{formatPct(totales.margen_pct)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
