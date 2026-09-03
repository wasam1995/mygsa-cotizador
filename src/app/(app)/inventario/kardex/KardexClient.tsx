'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatFecha } from '@/lib/utils';
import { eliminarMovimientoKardex } from './actions';
import type { MovimientoInventario } from '@/lib/types';

const TIPO_COLOR: Record<string, string> = {
  ENTRADA: 'bg-emerald-100 text-emerald-700',
  SALIDA: 'bg-red-100 text-red-700',
  RESERVA: 'bg-amber-100 text-amber-700',
  LIBERA_RESERVA: 'bg-slate-100 text-slate-600',
  ANULACION: 'bg-orange-100 text-orange-700',
  AJUSTE: 'bg-sky-100 text-sky-700',
};

type MovimientoFila = MovimientoInventario & { producto: { codigo: string; nombre: string } | null };

export default function KardexClient({ movimientos, puedeEliminar }: { movimientos: MovimientoFila[]; puedeEliminar: boolean }) {
  const router = useRouter();

  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[920px] text-sm">
        <thead>
          <tr className="table-head-row">
            <th className="py-2 pr-2">Fecha</th><th className="py-2 pr-2">Tipo</th>
            <th className="py-2 pr-2">Producto</th><th className="py-2 pr-2">Cant.</th>
            <th className="py-2 pr-2">Cotización</th><th className="py-2 pr-2">Cliente</th>
            <th className="py-2 pr-2">Vendedor</th><th className="py-2 pr-2">Stock result.</th>
            {puedeEliminar && <th className="py-2 pr-2"></th>}
          </tr>
        </thead>
        <tbody>
          {movimientos.map((m) => (
            <FilaMovimiento key={m.id} m={m} puedeEliminar={puedeEliminar} onEliminado={() => router.refresh()} />
          ))}
          {movimientos.length === 0 && <tr><td colSpan={puedeEliminar ? 9 : 8} className="py-8 text-center text-slate-400">Sin movimientos.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function FilaMovimiento({ m, puedeEliminar, onEliminado }: { m: MovimientoFila; puedeEliminar: boolean; onEliminado: () => void }) {
  const [confirmando, setConfirmando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleEliminar() {
    setEliminando(true);
    setError(null);
    const r = await eliminarMovimientoKardex(m.id);
    setEliminando(false);
    setConfirmando(false);
    if (r?.error) setError(r.error); else onEliminado();
  }

  return (
    <>
      <tr className="border-b border-slate-100 last:border-0">
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
        {puedeEliminar && (
          <td className="py-2 pr-2 whitespace-nowrap">
            {!confirmando ? (
              <button className="text-xs font-semibold text-red-500 hover:underline" onClick={() => setConfirmando(true)}>
                Eliminar
              </button>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs">
                ¿Eliminar?
                <button className="font-semibold text-red-600 hover:underline" disabled={eliminando} onClick={handleEliminar}>Sí</button>
                <button className="text-slate-400 hover:underline" disabled={eliminando} onClick={() => setConfirmando(false)}>No</button>
              </span>
            )}
          </td>
        )}
      </tr>
      {error && (
        <tr className="bg-red-50">
          <td colSpan={puedeEliminar ? 9 : 8} className="px-2 py-2 text-xs text-red-700">{error}</td>
        </tr>
      )}
    </>
  );
}
