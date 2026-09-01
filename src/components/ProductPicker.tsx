'use client';

import { useMemo, useState, useRef, useEffect } from 'react';
import { formatQ } from '@/lib/utils';
import type { Producto } from '@/lib/types';

export default function ProductPicker({
  productos, onSeleccionar, placeholder = 'Buscar por código o nombre…',
}: {
  productos: Producto[];
  onSeleccionar: (p: Producto) => void;
  placeholder?: string;
}) {
  const [texto, setTexto] = useState('');
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickFuera(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    }
    document.addEventListener('mousedown', onClickFuera);
    return () => document.removeEventListener('mousedown', onClickFuera);
  }, []);

  const resultados = useMemo(() => {
    const q = texto.trim().toLowerCase();
    if (!q) return productos.slice(0, 30);
    return productos.filter((p) =>
      p.codigo.toLowerCase().includes(q) || p.nombre.toLowerCase().includes(q)
    ).slice(0, 30);
  }, [texto, productos]);

  return (
    <div className="relative" ref={ref}>
      <input
        className="input"
        placeholder={placeholder}
        value={texto}
        onFocus={() => setAbierto(true)}
        onChange={(e) => { setTexto(e.target.value); setAbierto(true); }}
      />
      {abierto && (
        <div className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {resultados.length === 0 && (
            <p className="px-3 py-3 text-sm text-slate-400">Sin resultados. Use &quot;Agregar fuera de inventario&quot;.</p>
          )}
          {resultados.map((p) => {
            const disponible = p.stock_actual - p.stock_reservado;
            return (
              <button
                type="button"
                key={p.id}
                onClick={() => { onSeleccionar(p); setTexto(''); setAbierto(false); }}
                className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-3 py-2 text-left text-sm last:border-0 hover:bg-navy-50"
              >
                <span>
                  <span className="font-mono text-xs font-semibold text-navy-600">{p.codigo}</span>
                  {' — '}
                  <span className="text-slate-700">{p.nombre}</span>
                  {p.color_variante && <span className="text-slate-400"> ({p.color_variante})</span>}
                </span>
                <span className="flex shrink-0 flex-col items-end">
                  <span className="font-semibold text-slate-700">{formatQ(p.precio_lista)}</span>
                  <span className={disponible > 0 ? 'text-xs text-emerald-600' : 'text-xs text-red-600'}>
                    {disponible > 0 ? `${disponible} disp.` : 'Sin stock'}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
