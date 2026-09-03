import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireSesion } from '@/lib/auth';
import StatusBadge from '@/components/StatusBadge';
import { formatQ, formatFecha } from '@/lib/utils';
import { ESTADOS_LABEL, type Cotizacion, type EstadoCotizacion } from '@/lib/types';

export const dynamic = 'force-dynamic';

const COLUMNAS: EstadoCotizacion[] = [
  'PROSPECTO', 'PEND_AUTORIZAR', 'ENVIADO_CLIENTE', 'AUTORIZADO_CLIENTE', 'FACTURADO', 'ANULADO',
];

// Mismo código de color que StatusBadge (ESTADOS_COLOR), pero aplicado al encabezado y al
// borde izquierdo de cada tarjeta del tablero — así el pipeline se distingue por color de
// un vistazo, no solo por la columna en la que está.
const COLUMNA_COLOR: Record<EstadoCotizacion, { header: string; borde: string }> = {
  PROSPECTO: { header: 'bg-slate-100 text-slate-700', borde: 'border-l-slate-400' },
  PEND_AUTORIZAR: { header: 'bg-amber-100 text-amber-800', borde: 'border-l-amber-400' },
  ENVIADO_CLIENTE: { header: 'bg-sky-100 text-sky-800', borde: 'border-l-sky-400' },
  AUTORIZADO_CLIENTE: { header: 'bg-indigo-100 text-indigo-800', borde: 'border-l-indigo-400' },
  FACTURADO: { header: 'bg-emerald-100 text-emerald-800', borde: 'border-l-emerald-400' },
  ANULADO: { header: 'bg-red-100 text-red-700', borde: 'border-l-red-400' },
};

export default async function CotizacionesPage({
  searchParams,
}: { searchParams: { vista?: string; q?: string } }) {
  const sesion = await requireSesion();
  const supabase = createClient();

  const verTodas = sesion.permisos.includes('COTIZACIONES_VER_TODAS');
  let query = supabase.from('cotizaciones')
    .select('*, cliente:clientes(nombre_razon), vendedor:vendedores(nombre_completo)')
    .order('creado_en', { ascending: false });
  if (!verTodas && sesion.vendedorId) query = query.eq('vendedor_id', sesion.vendedorId);

  const { data } = await query.limit(400);
  const listaCompleta = (data ?? []) as (Cotizacion & {
    cliente: { nombre_razon: string } | null;
    vendedor: { nombre_completo: string } | null;
  })[];

  // "Pendientes de terminar": borradores activos (no anulados/facturados) que aún no
  // tienen capturado el número de cotización del sistema ERP externo — sin ese dato no
  // se pueden finalizar (enviar/autorizar/facturar), así que necesitan volver a atenderse.
  const pendientesFinalizar = listaCompleta.filter((c) =>
    !['FACTURADO', 'ANULADO'].includes(c.estado) && (!c.numero_sistema_externo || !c.numero_sistema_externo.trim())
  );

  const soloPendientes = searchParams.vista === 'pendientes';
  const vistaTabla = searchParams.vista === 'tabla';
  const lista = soloPendientes ? pendientesFinalizar : listaCompleta;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">Cotizaciones</h1>
        <div className="flex gap-2">
          <Link href="?vista=bandejas" className={`btn btn-secondary ${!vistaTabla && !soloPendientes ? '!bg-navy-700 !text-white' : ''}`}>🔀 Pipeline</Link>
          <Link href="?vista=tabla" className={`btn btn-secondary ${vistaTabla ? '!bg-navy-700 !text-white' : ''}`}>Tabla</Link>
          {sesion.permisos.includes('COTIZACIONES_CREAR') && (
            <Link href="/cotizaciones/nueva" className="btn btn-orange">+ Nueva</Link>
          )}
        </div>
      </div>

      <Link
        href="?vista=pendientes"
        className={`mb-5 flex items-center justify-between rounded-xl border p-4 transition-colors ${
          soloPendientes ? 'border-amber-400 bg-amber-100' : 'border-amber-200 bg-amber-50 hover:bg-amber-100'
        }`}
      >
        <div>
          <p className="text-sm font-bold text-amber-800">⏳ Pendientes de terminar (sin No. de cotización ERP)</p>
          <p className="text-xs text-amber-700">Borradores que aún no pueden enviarse, autorizarse ni facturarse hasta capturar el número del sistema.</p>
        </div>
        <span className="rounded-full bg-amber-500 px-3 py-1 text-sm font-bold text-white">{pendientesFinalizar.length}</span>
      </Link>
      {soloPendientes && (
        <p className="mb-4">
          <Link href="?vista=bandejas" className="text-xs font-semibold text-navy-600 hover:underline">← Ver todas las bandejas</Link>
        </p>
      )}

      {soloPendientes ? (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="table-head-row">
                <th className="py-2 pr-3">No.</th>
                <th className="py-2 pr-3">Fecha</th>
                <th className="py-2 pr-3">Cliente</th>
                <th className="py-2 pr-3">Vendedor</th>
                <th className="py-2 pr-3">Total</th>
                <th className="py-2 pr-3">Estado</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((c) => (
                <tr key={c.id} className="table-row-hover">
                  <td className="py-2.5 pr-3"><Link href={`/cotizaciones/${c.id}`} className="font-semibold text-navy-700 hover:underline">{c.numero_interno}</Link></td>
                  <td className="py-2.5 pr-3 text-slate-500">{formatFecha(c.fecha_emision)}</td>
                  <td className="py-2.5 pr-3">{c.cliente?.nombre_razon ?? c.cliente_nombre_libre}</td>
                  <td className="py-2.5 pr-3 text-slate-500">{c.vendedor?.nombre_completo}</td>
                  <td className="py-2.5 pr-3 font-medium">{formatQ(c.total_cotizado)}</td>
                  <td className="py-2.5 pr-3"><StatusBadge estado={c.estado} /></td>
                </tr>
              ))}
              {lista.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-slate-400">No hay cotizaciones pendientes de terminar.</td></tr>}
            </tbody>
          </table>
        </div>
      ) : !vistaTabla ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNAS.map((estado) => {
            const items = lista.filter((c) => c.estado === estado);
            return (
              <div key={estado} className="w-72 shrink-0">
                <div className={`mb-2 flex items-center justify-between rounded-lg px-2 py-1.5 ${COLUMNA_COLOR[estado].header}`}>
                  <p className="text-xs font-bold uppercase tracking-wide">{ESTADOS_LABEL[estado]}</p>
                  <span className="rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-semibold">{items.length}</span>
                </div>
                <div className="space-y-2">
                  {items.map((c) => (
                    <Link key={c.id} href={`/cotizaciones/${c.id}`} className={`card block !p-3 border-l-4 hover:border-navy-300 ${COLUMNA_COLOR[estado].borde}`}>
                      <p className="text-sm font-bold text-navy-700">{c.numero_interno}</p>
                      <p className="truncate text-xs text-slate-500">{c.cliente?.nombre_razon ?? c.cliente_nombre_libre}</p>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-sm font-semibold text-slate-700">{formatQ(c.total_cotizado)}</span>
                        <span className="text-[11px] text-slate-400">{formatFecha(c.fecha_emision)}</span>
                      </div>
                      {verTodas && <p className="mt-1 text-[11px] text-slate-400">{c.vendedor?.nombre_completo}</p>}
                    </Link>
                  ))}
                  {items.length === 0 && <p className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-xs text-slate-300">Vacío</p>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="table-head-row">
                <th className="py-2 pr-3">No.</th>
                <th className="py-2 pr-3">Fecha</th>
                <th className="py-2 pr-3">Cliente</th>
                <th className="py-2 pr-3">Vendedor</th>
                <th className="py-2 pr-3">Total</th>
                <th className="py-2 pr-3">Estado</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((c) => (
                <tr key={c.id} className="table-row-hover">
                  <td className="py-2.5 pr-3"><Link href={`/cotizaciones/${c.id}`} className="font-semibold text-navy-700 hover:underline">{c.numero_interno}</Link></td>
                  <td className="py-2.5 pr-3 text-slate-500">{formatFecha(c.fecha_emision)}</td>
                  <td className="py-2.5 pr-3">{c.cliente?.nombre_razon ?? c.cliente_nombre_libre}</td>
                  <td className="py-2.5 pr-3 text-slate-500">{c.vendedor?.nombre_completo}</td>
                  <td className="py-2.5 pr-3 font-medium">{formatQ(c.total_cotizado)}</td>
                  <td className="py-2.5 pr-3"><StatusBadge estado={c.estado} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
