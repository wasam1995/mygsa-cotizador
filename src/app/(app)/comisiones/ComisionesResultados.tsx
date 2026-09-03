'use client';

import { Fragment, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatQ, formatFecha } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import StatCard from '@/components/StatCard';
import {
  crearLiquidacion, crearLiquidacionesGrupo, marcarLiquidacionPagada, reabrirLiquidacion,
  actualizarComentarioComision, actualizarLiquidacion, eliminarLiquidacion,
} from './actions';
import type { ComisionCalculada, DescuentoOtro, LiquidacionComision, Vendedor } from '@/lib/types';

type ComisionFila = ComisionCalculada & {
  vendedor: { codigo: string; nombre_completo: string } | null;
  cotizacion: { numero_interno: string; numero_sistema_externo: string | null } | null;
  liquidacion: { numero: string; estado: string } | null;
};
type LiquidacionFila = LiquidacionComision & { vendedor: { codigo: string; nombre_completo: string } | null };

export default function ComisionesResultados({
  comisiones, vendedores, liquidaciones, verTodas, puedeLiquidar, vendedorPropioId, searchParams,
}: {
  comisiones: ComisionFila[];
  vendedores: Vendedor[];
  liquidaciones: LiquidacionFila[];
  verTodas: boolean;
  puedeLiquidar: boolean;
  vendedorPropioId: string | null;
  searchParams: { desde?: string; hasta?: string; vendedor_id?: string };
}) {
  const router = useRouter();
  const [mostrarNuevaLiquidacion, setMostrarNuevaLiquidacion] = useState(false);

  const siguienteNumero = (() => {
    const numeros = liquidaciones
      .map((l) => /^LIQ-(\d+)$/.exec(l.numero)?.[1])
      .filter(Boolean)
      .map((n) => Number(n));
    const siguiente = (numeros.length > 0 ? Math.max(...numeros) : 0) + 1;
    return `LIQ-${String(siguiente).padStart(4, '0')}`;
  })();

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
        <h1 className="page-title">Comisiones {verTodas ? 'por vendedor' : ''}</h1>
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
          <h2 className="mb-3 section-title">Resumen por vendedor</h2>
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className="table-head-row">
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

      <div className="card">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="section-title">Liquidaciones de comisiones</h2>
          {puedeLiquidar && (
            <button className="btn btn-orange" onClick={() => setMostrarNuevaLiquidacion(true)}>+ Nueva liquidación</button>
          )}
        </div>
        <p className="mb-3 text-xs text-slate-500">
          Una liquidación agrupa las comisiones ya facturadas y aún no liquidadas de un vendedor en un rango de
          fechas, permite aplicar descuentos (ISR, IGSS u otros, cada uno con su justificación) y calcula el neto a
          pagar. Mientras una comisión no esté en ninguna liquidación, aparece como &quot;Pendiente&quot; en el
          detalle de abajo.
        </p>

        {mostrarNuevaLiquidacion && (
          <NuevaLiquidacionForm
            vendedores={verTodas ? vendedores : []}
            vendedorFijoId={!verTodas ? vendedorPropioId : null}
            numeroSugerido={siguienteNumero}
            onClose={() => { setMostrarNuevaLiquidacion(false); router.refresh(); }}
          />
        )}

        <TablaLiquidaciones liquidaciones={liquidaciones} puedeLiquidar={puedeLiquidar} onCambio={() => router.refresh()} />
      </div>

      <div className="card overflow-x-auto">
        <h2 className="mb-3 section-title">Detalle</h2>
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="table-head-row">
              <th className="py-2 pr-2">Fecha</th><th className="py-2 pr-2">Cotización</th>
              {verTodas && <th className="py-2 pr-2">Vendedor</th>}
              <th className="py-2 pr-2">Base</th><th className="py-2 pr-2">%</th><th className="py-2 pr-2">Comisión</th>
              <th className="py-2 pr-2">Pago</th><th className="py-2 pr-2">Comentario</th>
            </tr>
          </thead>
          <tbody>
            {comisiones.map((c) => (
              <FilaComision key={c.id} c={c} verTodas={verTodas} puedeLiquidar={puedeLiquidar} onCambio={() => router.refresh()} />
            ))}
            {comisiones.length === 0 && <tr><td colSpan={8} className="py-8 text-center text-slate-400">Sin comisiones calculadas aún.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FilaComision({
  c, verTodas, puedeLiquidar, onCambio,
}: { c: ComisionFila; verTodas: boolean; puedeLiquidar: boolean; onCambio: () => void }) {
  const [editando, setEditando] = useState(false);
  const [comentario, setComentario] = useState(c.comentario ?? '');
  const [guardando, setGuardando] = useState(false);

  return (
    <tr className="border-b border-slate-100 last:border-0 align-top">
      <td className="py-2 pr-2 text-slate-500">{formatFecha(c.fecha_facturacion)}</td>
      <td className="py-2 pr-2 text-navy-700">{c.cotizacion?.numero_sistema_externo ?? c.cotizacion?.numero_interno}</td>
      {verTodas && <td className="py-2 pr-2">{c.vendedor?.nombre_completo}</td>}
      <td className="py-2 pr-2">{formatQ(c.base_calculo)}</td>
      <td className="py-2 pr-2">{c.porcentaje_aplicado}%</td>
      <td className="py-2 pr-2 font-semibold text-emerald-700">{formatQ(c.monto_comision)}</td>
      <td className="py-2 pr-2">
        {c.liquidacion ? (
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${c.liquidacion.estado === 'PAGADA' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
            {c.liquidacion.estado === 'PAGADA' ? 'Pagada' : 'En liquidación'} · {c.liquidacion.numero}
          </span>
        ) : (
          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-500">Pendiente</span>
        )}
      </td>
      <td className="py-2 pr-2 min-w-[200px]">
        {editando ? (
          <div className="flex items-center gap-1">
            <input className="input" value={comentario} onChange={(e) => setComentario(e.target.value)} />
            <button disabled={guardando} className="text-xs font-semibold text-emerald-600 hover:underline" onClick={async () => {
              setGuardando(true);
              await actualizarComentarioComision(c.id, comentario);
              setGuardando(false);
              setEditando(false);
              onCambio();
            }}>✓</button>
            <button className="text-xs font-semibold text-slate-400 hover:underline" onClick={() => { setComentario(c.comentario ?? ''); setEditando(false); }}>✕</button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-slate-500">{c.comentario || '—'}</span>
            {puedeLiquidar && <button className="text-xs text-navy-600 hover:underline" onClick={() => setEditando(true)}>editar</button>}
          </div>
        )}
      </td>
    </tr>
  );
}

function NuevaLiquidacionForm({
  vendedores, vendedorFijoId, numeroSugerido, onClose,
}: { vendedores: Vendedor[]; vendedorFijoId: string | null; numeroSugerido: string; onClose: () => void }) {
  const [modo, setModo] = useState<'individual' | 'grupal'>('individual');
  const [vendedorId, setVendedorId] = useState(vendedorFijoId ?? '');
  const [vendedoresGrupo, setVendedoresGrupo] = useState<Set<string>>(new Set());
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [numero, setNumero] = useState(numeroSugerido);
  const [generandoGrupo, setGenerandoGrupo] = useState(false);
  const [resultadoGrupo, setResultadoGrupo] = useState<{ creadas: number; omitidos: number } | null>(null);
  const [pendientes, setPendientes] = useState<{ id: string; monto_comision: number }[] | null>(null);
  const [cargandoPendientes, setCargandoPendientes] = useState(false);
  const [aplicaIsr, setAplicaIsr] = useState(false);
  const [descuentoIsr, setDescuentoIsr] = useState(0);
  const [justificacionIsr, setJustificacionIsr] = useState('');
  const [aplicaIgss, setAplicaIgss] = useState(false);
  const [descuentoIgss, setDescuentoIgss] = useState(0);
  const [justificacionIgss, setJustificacionIgss] = useState('');
  const [otros, setOtros] = useState<DescuentoOtro[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function buscarPendientes() {
    if (!vendedorId || !desde || !hasta) { setPendientes(null); return; }
    setCargandoPendientes(true);
    setError(null);
    const supabase = createClient();
    const { data, error: err } = await supabase
      .from('comisiones_calculadas')
      .select('id, monto_comision')
      .eq('vendedor_id', vendedorId)
      .is('liquidacion_id', null)
      .gte('fecha_facturacion', desde)
      .lte('fecha_facturacion', hasta);
    setCargandoPendientes(false);
    if (err) { setError(err.message); return; }
    setPendientes(data ?? []);
  }

  const totalComisiones = (pendientes ?? []).reduce((a, c) => a + Number(c.monto_comision), 0);
  const totalOtros = otros.reduce((a, d) => a + Number(d.monto || 0), 0);
  const totalNeto = totalComisiones - (aplicaIsr ? descuentoIsr : 0) - (aplicaIgss ? descuentoIgss : 0) - totalOtros;

  function agregarOtro() { setOtros((prev) => [...prev, { concepto: '', monto: 0, justificacion: '' }]); }
  function actualizarOtro(idx: number, patch: Partial<DescuentoOtro>) {
    setOtros((prev) => prev.map((d, i) => (i === idx ? { ...d, ...patch } : d)));
  }
  function eliminarOtro(idx: number) { setOtros((prev) => prev.filter((_, i) => i !== idx)); }

  async function generarGrupo() {
    setGenerandoGrupo(true);
    setError(null);
    setResultadoGrupo(null);
    const r = await crearLiquidacionesGrupo({
      numeroBase: numero,
      vendedorIds: [...vendedoresGrupo],
      fecha_desde: desde,
      fecha_hasta: hasta,
    });
    setGenerandoGrupo(false);
    if (r?.error) { setError(r.error); return; }
    setResultadoGrupo({ creadas: r.creadas ?? 0, omitidos: r.omitidos ?? 0 });
  }

  function alternarVendedorGrupo(id: string) {
    setVendedoresGrupo((prev) => {
      const nuevo = new Set(prev);
      if (nuevo.has(id)) nuevo.delete(id); else nuevo.add(id);
      return nuevo;
    });
  }

  return (
    <div className="card mb-4 border-navy-200 bg-navy-50/40">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="section-title">Nueva liquidación</h3>
        {vendedores.length > 0 && (
          <div className="flex gap-1 rounded-lg border border-navy-200 bg-white p-0.5 text-xs">
            <button
              className={`rounded px-3 py-1 font-semibold ${modo === 'individual' ? 'bg-navy-100 text-navy-800' : 'text-slate-500'}`}
              onClick={() => { setModo('individual'); setError(null); setResultadoGrupo(null); }}
            >
              Un vendedor
            </button>
            <button
              className={`rounded px-3 py-1 font-semibold ${modo === 'grupal' ? 'bg-navy-100 text-navy-800' : 'text-slate-500'}`}
              onClick={() => { setModo('grupal'); setError(null); setResultadoGrupo(null); }}
            >
              Grupo de vendedores
            </button>
          </div>
        )}
      </div>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

      {modo === 'grupal' && vendedores.length > 0 ? (
        <div>
          <p className="mb-3 text-xs text-slate-500">
            Genera una liquidación independiente por cada vendedor seleccionado que tenga comisiones pendientes en el
            rango — sin descuentos (varían por persona). Después puede editar cada una para aplicarle su ISR/IGSS/otros.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div><label className="label">Número base (consecutivo)</label><input className="input" value={numero} onChange={(e) => setNumero(e.target.value)} /></div>
            <div><label className="label">Desde</label><input type="date" className="input" value={desde} onChange={(e) => { setDesde(e.target.value); setResultadoGrupo(null); }} /></div>
            <div><label className="label">Hasta</label><input type="date" className="input" value={hasta} onChange={(e) => { setHasta(e.target.value); setResultadoGrupo(null); }} /></div>
          </div>
          <div className="mt-3 rounded-lg border border-slate-200 p-3">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Vendedores incluidos</p>
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3">
              {vendedores.map((v) => (
                <label key={v.id} className="flex items-center gap-2 text-sm text-slate-600">
                  <input type="checkbox" checked={vendedoresGrupo.has(v.id)} onChange={() => alternarVendedorGrupo(v.id)} />
                  {v.nombre_completo}
                </label>
              ))}
            </div>
          </div>
          {resultadoGrupo && (
            <div className="mt-3 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800">
              Se crearon <b>{resultadoGrupo.creadas}</b> liquidación(es).
              {resultadoGrupo.omitidos > 0 && ` ${resultadoGrupo.omitidos} vendedor(es) se omitieron por no tener comisiones pendientes en ese rango.`}
            </div>
          )}
          <div className="mt-3 flex gap-2">
            <button
              disabled={generandoGrupo || vendedoresGrupo.size === 0 || !desde || !hasta || !numero}
              className="btn btn-orange"
              onClick={generarGrupo}
            >
              {generandoGrupo ? 'Generando…' : 'Generar liquidaciones'}
            </button>
            <button className="btn btn-ghost" onClick={onClose}>Cerrar</button>
          </div>
        </div>
      ) : (
        <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div><label className="label">Número</label><input className="input" value={numero} onChange={(e) => setNumero(e.target.value)} /></div>
        {vendedores.length > 0 ? (
          <div>
            <label className="label">Vendedor</label>
            <select className="input" value={vendedorId} onChange={(e) => { setVendedorId(e.target.value); setPendientes(null); }}>
              <option value="">Seleccione…</option>
              {vendedores.map((v) => <option key={v.id} value={v.id}>{v.nombre_completo}</option>)}
            </select>
          </div>
        ) : null}
        <div><label className="label">Desde</label><input type="date" className="input" value={desde} onChange={(e) => { setDesde(e.target.value); setPendientes(null); }} /></div>
        <div><label className="label">Hasta</label><input type="date" className="input" value={hasta} onChange={(e) => { setHasta(e.target.value); setPendientes(null); }} /></div>
      </div>
      <div className="mt-3">
        <button className="btn btn-secondary" disabled={!vendedorId || !desde || !hasta || cargandoPendientes} onClick={buscarPendientes}>
          {cargandoPendientes ? 'Buscando…' : 'Buscar comisiones pendientes en ese rango'}
        </button>
      </div>

      {pendientes !== null && (
        <div className="mt-3 rounded-lg border border-navy-200 bg-white p-3">
          <p className="text-sm">
            <b>{pendientes.length}</b> comisión(es) pendiente(s) de pago en ese rango — total{' '}
            <b className="text-emerald-700">{formatQ(totalComisiones)}</b>
          </p>
          {pendientes.length === 0 && <p className="mt-1 text-xs text-slate-500">No hay nada que liquidar en ese rango para este vendedor.</p>}
        </div>
      )}

      {pendientes !== null && pendientes.length > 0 && (
        <div className="mt-4 space-y-3">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Descuentos a aplicar (opcional)</p>

          <div className="rounded-lg border border-slate-200 p-3">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input type="checkbox" checked={aplicaIsr} onChange={(e) => setAplicaIsr(e.target.checked)} />
              Descuento de ISR (si corresponde)
            </label>
            {aplicaIsr && (
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <input type="number" step="0.01" className="input" placeholder="Monto" value={descuentoIsr} onChange={(e) => setDescuentoIsr(Number(e.target.value))} />
                <input className="input sm:col-span-2" placeholder="Justificación" value={justificacionIsr} onChange={(e) => setJustificacionIsr(e.target.value)} />
              </div>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 p-3">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input type="checkbox" checked={aplicaIgss} onChange={(e) => setAplicaIgss(e.target.checked)} />
              Descuento de IGSS
            </label>
            {aplicaIgss && (
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <input type="number" step="0.01" className="input" placeholder="Monto" value={descuentoIgss} onChange={(e) => setDescuentoIgss(Number(e.target.value))} />
                <input className="input sm:col-span-2" placeholder="Justificación" value={justificacionIgss} onChange={(e) => setJustificacionIgss(e.target.value)} />
              </div>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-700">Otros descuentos</p>
              <button className="text-xs font-semibold text-navy-600 hover:underline" onClick={agregarOtro}>+ Agregar descuento</button>
            </div>
            {otros.map((d, idx) => (
              <div key={idx} className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-6">
                <input className="input sm:col-span-2" placeholder="Concepto" value={d.concepto} onChange={(e) => actualizarOtro(idx, { concepto: e.target.value })} />
                <input type="number" step="0.01" className="input" placeholder="Monto" value={d.monto} onChange={(e) => actualizarOtro(idx, { monto: Number(e.target.value) })} />
                <input className="input sm:col-span-2" placeholder="Justificación" value={d.justificacion} onChange={(e) => actualizarOtro(idx, { justificacion: e.target.value })} />
                <button className="text-xs font-semibold text-red-500 hover:underline" onClick={() => eliminarOtro(idx)}>Quitar</button>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-right">
            <p className="text-xs font-semibold uppercase text-emerald-700">Neto a pagar</p>
            <p className="text-xl font-black text-emerald-800">{formatQ(totalNeto)}</p>
          </div>
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <button
          disabled={guardando || !pendientes || pendientes.length === 0 || !numero}
          className="btn btn-orange"
          onClick={async () => {
            setGuardando(true);
            setError(null);
            const r = await crearLiquidacion({
              numero,
              vendedor_id: vendedorId,
              fecha_desde: desde,
              fecha_hasta: hasta,
              descuento_isr: aplicaIsr ? descuentoIsr : 0,
              justificacion_isr: aplicaIsr ? justificacionIsr : null,
              descuento_igss: aplicaIgss ? descuentoIgss : 0,
              justificacion_igss: aplicaIgss ? justificacionIgss : null,
              descuentos_otros: otros,
            });
            setGuardando(false);
            if (r?.error) setError(r.error); else onClose();
          }}
        >
          {guardando ? 'Creando…' : 'Crear liquidación'}
        </button>
        <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
      </div>
        </>
      )}
    </div>
  );
}

function TablaLiquidaciones({
  liquidaciones, puedeLiquidar, onCambio,
}: { liquidaciones: LiquidacionFila[]; puedeLiquidar: boolean; onCambio: () => void }) {
  const [pagando, setPagando] = useState<string | null>(null);
  const [comentarioPago, setComentarioPago] = useState('');
  const [expandida, setExpandida] = useState<string | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const [confirmandoEliminar, setConfirmandoEliminar] = useState<string | null>(null);
  const [procesando, setProcesando] = useState(false);

  if (liquidaciones.length === 0) {
    return <p className="text-sm text-slate-400">Sin liquidaciones registradas todavía.</p>;
  }

  return (
    <table className="w-full min-w-[900px] text-sm">
      <thead>
        <tr className="table-head-row">
          <th className="py-2 pr-2">Número</th><th className="py-2 pr-2">Vendedor</th>
          <th className="py-2 pr-2">Rango</th><th className="py-2 pr-2">Comisiones</th>
          <th className="py-2 pr-2">Descuentos</th><th className="py-2 pr-2">Neto</th>
          <th className="py-2 pr-2">Estado</th><th className="py-2 pr-2"></th>
        </tr>
      </thead>
      <tbody>
        {liquidaciones.map((l) => {
          const totalDescuentos = Number(l.descuento_isr) + Number(l.descuento_igss) + l.descuentos_otros.reduce((a, d) => a + Number(d.monto || 0), 0);
          return (
            <Fragment key={l.id}>
              <tr className="border-b border-slate-100 last:border-0">
                <td className="py-2 pr-2 font-mono text-xs text-slate-500">{l.numero}</td>
                <td className="py-2 pr-2">{l.vendedor?.nombre_completo}</td>
                <td className="py-2 pr-2 text-slate-500">{formatFecha(l.fecha_desde)} – {formatFecha(l.fecha_hasta)}</td>
                <td className="py-2 pr-2">{formatQ(l.total_comisiones)}</td>
                <td className="py-2 pr-2 text-orange-700">{totalDescuentos > 0 ? `-${formatQ(totalDescuentos)}` : '—'}</td>
                <td className="py-2 pr-2 font-semibold text-emerald-700">{formatQ(l.total_neto)}</td>
                <td className="py-2 pr-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${l.estado === 'PAGADA' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {l.estado === 'PAGADA' ? 'Pagada' : 'Pendiente de pago'}
                  </span>
                </td>
                <td className="py-2 pr-2 whitespace-nowrap">
                  <button className="mr-2 text-xs font-semibold text-navy-600 hover:underline" onClick={() => setExpandida(expandida === l.id ? null : l.id)}>
                    {expandida === l.id ? 'Ocultar' : 'Detalle'}
                  </button>
                  {puedeLiquidar && l.estado === 'PENDIENTE_PAGO' && (
                    <button className="mr-2 text-xs font-semibold text-emerald-600 hover:underline" onClick={() => { setPagando(l.id); setComentarioPago(''); }}>Marcar pagada</button>
                  )}
                  {puedeLiquidar && l.estado === 'PAGADA' && (
                    <button className="mr-2 text-xs font-semibold text-slate-400 hover:underline" onClick={async () => {
                      setProcesando(true); await reabrirLiquidacion(l.id); setProcesando(false); onCambio();
                    }}>Reabrir</button>
                  )}
                  {puedeLiquidar && l.estado === 'PENDIENTE_PAGO' && (
                    <button className="mr-2 text-xs font-semibold text-navy-600 hover:underline" onClick={() => setEditando(editando === l.id ? null : l.id)}>
                      {editando === l.id ? 'Cerrar edición' : 'Editar'}
                    </button>
                  )}
                  {puedeLiquidar && confirmandoEliminar !== l.id && (
                    <button className="text-xs font-semibold text-red-500 hover:underline" onClick={() => setConfirmandoEliminar(l.id)}>Eliminar</button>
                  )}
                  {puedeLiquidar && confirmandoEliminar === l.id && (
                    <span className="inline-flex items-center gap-1 text-xs">
                      ¿Eliminar?
                      <button className="font-semibold text-red-600 hover:underline" disabled={procesando} onClick={async () => {
                        setProcesando(true); await eliminarLiquidacion(l.id); setProcesando(false); setConfirmandoEliminar(null); onCambio();
                      }}>Sí</button>
                      <button className="text-slate-400 hover:underline" onClick={() => setConfirmandoEliminar(null)}>No</button>
                    </span>
                  )}
                </td>
              </tr>
              {expandida === l.id && (
                <tr className="bg-slate-50">
                  <td colSpan={8} className="p-3 text-sm">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      {Number(l.descuento_isr) > 0 && <p><b>ISR:</b> -{formatQ(l.descuento_isr)} — {l.justificacion_isr || 'sin justificación'}</p>}
                      {Number(l.descuento_igss) > 0 && <p><b>IGSS:</b> -{formatQ(l.descuento_igss)} — {l.justificacion_igss || 'sin justificación'}</p>}
                      {l.descuentos_otros.map((d, idx) => (
                        <p key={idx}><b>{d.concepto || 'Otro descuento'}:</b> -{formatQ(d.monto)} — {d.justificacion || 'sin justificación'}</p>
                      ))}
                      {totalDescuentos === 0 && <p className="text-slate-400">Sin descuentos aplicados.</p>}
                    </div>
                    {l.estado === 'PAGADA' && (
                      <p className="mt-2 text-slate-500">
                        Pagada el {l.fecha_pago ? formatFecha(l.fecha_pago) : '—'}.{l.comentario_pago ? ` Comentario: ${l.comentario_pago}` : ''}
                      </p>
                    )}
                  </td>
                </tr>
              )}
              {editando === l.id && (
                <tr className="bg-navy-50">
                  <td colSpan={8} className="p-3">
                    <EditarLiquidacionForm
                      liquidacion={l}
                      onCerrar={() => setEditando(null)}
                      onGuardado={() => { setEditando(null); onCambio(); }}
                    />
                  </td>
                </tr>
              )}
              {pagando === l.id && (
                <tr className="bg-emerald-50">
                  <td colSpan={8} className="p-3">
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="min-w-[260px] flex-1">
                        <label className="label">Comentario del pago (opcional)</label>
                        <input className="input" value={comentarioPago} onChange={(e) => setComentarioPago(e.target.value)} placeholder="Ej. transferencia, cheque #, referencia…" />
                      </div>
                      <button disabled={procesando} className="btn btn-primary" onClick={async () => {
                        setProcesando(true);
                        await marcarLiquidacionPagada(l.id, comentarioPago);
                        setProcesando(false);
                        setPagando(null);
                        onCambio();
                      }}>Confirmar pago</button>
                      <button className="btn btn-ghost" onClick={() => setPagando(null)}>Cancelar</button>
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}

// Edición de los descuentos (ISR/IGSS/otros) de una liquidación ya creada, mientras
// sigue PENDIENTE_PAGO — reutiliza el mismo patrón de campos que al crearla.
function EditarLiquidacionForm({
  liquidacion, onCerrar, onGuardado,
}: { liquidacion: LiquidacionFila; onCerrar: () => void; onGuardado: () => void }) {
  const [aplicaIsr, setAplicaIsr] = useState(Number(liquidacion.descuento_isr) > 0);
  const [descuentoIsr, setDescuentoIsr] = useState(Number(liquidacion.descuento_isr));
  const [justificacionIsr, setJustificacionIsr] = useState(liquidacion.justificacion_isr ?? '');
  const [aplicaIgss, setAplicaIgss] = useState(Number(liquidacion.descuento_igss) > 0);
  const [descuentoIgss, setDescuentoIgss] = useState(Number(liquidacion.descuento_igss));
  const [justificacionIgss, setJustificacionIgss] = useState(liquidacion.justificacion_igss ?? '');
  const [otros, setOtros] = useState<DescuentoOtro[]>(liquidacion.descuentos_otros ?? []);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const totalOtros = otros.reduce((a, d) => a + Number(d.monto || 0), 0);
  const totalNeto = Number(liquidacion.total_comisiones) - (aplicaIsr ? descuentoIsr : 0) - (aplicaIgss ? descuentoIgss : 0) - totalOtros;

  function agregarOtro() { setOtros((prev) => [...prev, { concepto: '', monto: 0, justificacion: '' }]); }
  function actualizarOtro(idx: number, patch: Partial<DescuentoOtro>) {
    setOtros((prev) => prev.map((d, i) => (i === idx ? { ...d, ...patch } : d)));
  }
  function eliminarOtro(idx: number) { setOtros((prev) => prev.filter((_, i) => i !== idx)); }

  return (
    <div className="space-y-3 text-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
        Editar descuentos de {liquidacion.numero} — base {formatQ(liquidacion.total_comisiones)}
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <input type="checkbox" checked={aplicaIsr} onChange={(e) => setAplicaIsr(e.target.checked)} />
          Descuento de ISR
        </label>
        {aplicaIsr && (
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <input type="number" step="0.01" className="input" placeholder="Monto" value={descuentoIsr} onChange={(e) => setDescuentoIsr(Number(e.target.value))} />
            <input className="input sm:col-span-2" placeholder="Justificación" value={justificacionIsr} onChange={(e) => setJustificacionIsr(e.target.value)} />
          </div>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <input type="checkbox" checked={aplicaIgss} onChange={(e) => setAplicaIgss(e.target.checked)} />
          Descuento de IGSS
        </label>
        {aplicaIgss && (
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <input type="number" step="0.01" className="input" placeholder="Monto" value={descuentoIgss} onChange={(e) => setDescuentoIgss(Number(e.target.value))} />
            <input className="input sm:col-span-2" placeholder="Justificación" value={justificacionIgss} onChange={(e) => setJustificacionIgss(e.target.value)} />
          </div>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-700">Otros descuentos</p>
          <button className="text-xs font-semibold text-navy-600 hover:underline" onClick={agregarOtro}>+ Agregar descuento</button>
        </div>
        {otros.map((d, idx) => (
          <div key={idx} className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-6">
            <input className="input sm:col-span-2" placeholder="Concepto" value={d.concepto} onChange={(e) => actualizarOtro(idx, { concepto: e.target.value })} />
            <input type="number" step="0.01" className="input" placeholder="Monto" value={d.monto} onChange={(e) => actualizarOtro(idx, { monto: Number(e.target.value) })} />
            <input className="input sm:col-span-2" placeholder="Justificación" value={d.justificacion} onChange={(e) => actualizarOtro(idx, { justificacion: e.target.value })} />
            <button className="text-xs font-semibold text-red-500 hover:underline" onClick={() => eliminarOtro(idx)}>Quitar</button>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-right">
        <p className="text-xs font-semibold uppercase text-emerald-700">Neto a pagar</p>
        <p className="text-xl font-black text-emerald-800">{formatQ(totalNeto)}</p>
      </div>

      <div className="flex gap-2">
        <button disabled={guardando} className="btn btn-primary" onClick={async () => {
          setGuardando(true);
          setError(null);
          const r = await actualizarLiquidacion(liquidacion.id, {
            descuento_isr: aplicaIsr ? descuentoIsr : 0,
            justificacion_isr: aplicaIsr ? justificacionIsr : null,
            descuento_igss: aplicaIgss ? descuentoIgss : 0,
            justificacion_igss: aplicaIgss ? justificacionIgss : null,
            descuentos_otros: otros,
          });
          setGuardando(false);
          if (r?.error) setError(r.error); else onGuardado();
        }}>
          {guardando ? 'Guardando…' : 'Guardar cambios'}
        </button>
        <button className="btn btn-ghost" onClick={onCerrar}>Cancelar</button>
      </div>
    </div>
  );
}
