'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatQ } from '@/lib/utils';
import { actualizarProducto, crearProducto, registrarEntradaInventario } from './actions';
import type { Producto } from '@/lib/types';

export default function InventarioClient({ productos, puedeEditar }: { productos: Producto[]; puedeEditar: boolean }) {
  const router = useRouter();
  const [busqueda, setBusqueda] = useState('');
  const [editando, setEditando] = useState<string | null>(null);
  const [entradaPara, setEntradaPara] = useState<string | null>(null);
  const [mostrarNuevo, setMostrarNuevo] = useState(false);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return productos;
    return productos.filter((p) => p.codigo.toLowerCase().includes(q) || p.nombre.toLowerCase().includes(q));
  }, [busqueda, productos]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input className="input max-w-xs" placeholder="Buscar código o nombre…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        <div className="flex gap-2">
          <a href="/api/inventario/excel" className="btn btn-secondary">⬇️ Exportar Excel</a>
          {puedeEditar && <button className="btn btn-orange" onClick={() => setMostrarNuevo(true)}>+ Nuevo producto</button>}
        </div>
      </div>

      {mostrarNuevo && <NuevoProductoForm onClose={() => { setMostrarNuevo(false); router.refresh(); }} />}

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-400">
              <th className="py-2 pr-2">Código</th><th className="py-2 pr-2">Producto</th>
              <th className="py-2 pr-2">Stock</th><th className="py-2 pr-2">Reservado</th>
              <th className="py-2 pr-2">Disponible</th><th className="py-2 pr-2">Costo</th>
              <th className="py-2 pr-2">Precio</th><th className="py-2 pr-2">Margen</th>
              {puedeEditar && <th className="py-2 pr-2"></th>}
            </tr>
          </thead>
          <tbody>
            {filtrados.map((p) => {
              const disponible = p.stock_actual - p.stock_reservado;
              const margen = p.precio_lista > 0 ? ((p.precio_lista - p.costo_unitario) / p.precio_lista) * 100 : 0;
              return (
                <FilaProducto key={p.id} p={p} disponible={disponible} margen={margen} puedeEditar={puedeEditar}
                  editando={editando === p.id} onEditar={() => setEditando(p.id)} onCerrarEdicion={() => { setEditando(null); router.refresh(); }}
                  entradaAbierta={entradaPara === p.id} onEntrada={() => setEntradaPara(p.id)} onCerrarEntrada={() => { setEntradaPara(null); router.refresh(); }}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FilaProducto({
  p, disponible, margen, puedeEditar, editando, onEditar, onCerrarEdicion, entradaAbierta, onEntrada, onCerrarEntrada,
}: {
  p: Producto; disponible: number; margen: number; puedeEditar: boolean;
  editando: boolean; onEditar: () => void; onCerrarEdicion: () => void;
  entradaAbierta: boolean; onEntrada: () => void; onCerrarEntrada: () => void;
}) {
  const [costo, setCosto] = useState(p.costo_unitario);
  const [precio, setPrecio] = useState(p.precio_lista);
  const [imagenUrl, setImagenUrl] = useState(p.imagen_url ?? '');
  const [especificaciones, setEspecificaciones] = useState(p.especificaciones ?? '');
  const [cantEntrada, setCantEntrada] = useState(0);
  const [comentEntrada, setComentEntrada] = useState('');
  const [guardando, setGuardando] = useState(false);

  return (
    <>
      <tr className="border-b border-slate-100 last:border-0">
        <td className="py-2 pr-2 font-mono text-xs text-slate-500">{p.codigo}</td>
        <td className="py-2 pr-2">
          <div className="flex items-center gap-2">
            {p.imagen_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.imagen_url} alt={p.nombre} className="h-8 w-8 flex-shrink-0 rounded object-cover" />
            )}
            <span>{p.nombre}{p.color_variante ? ` (${p.color_variante})` : ''}</span>
          </div>
        </td>
        <td className="py-2 pr-2">{p.stock_actual}</td>
        <td className="py-2 pr-2">{p.stock_reservado}</td>
        <td className={`py-2 pr-2 font-semibold ${disponible <= p.stock_minimo ? 'text-red-600' : 'text-emerald-700'}`}>{disponible}</td>
        <td className="py-2 pr-2">{formatQ(p.costo_unitario)}</td>
        <td className="py-2 pr-2">{formatQ(p.precio_lista)}</td>
        <td className="py-2 pr-2 text-slate-500">{margen.toFixed(1)}%</td>
        {puedeEditar && (
          <td className="py-2 pr-2 whitespace-nowrap">
            <button className="mr-2 text-xs font-semibold text-navy-600 hover:underline" onClick={onEditar}>Editar</button>
            <button className="text-xs font-semibold text-emerald-600 hover:underline" onClick={onEntrada}>+ Entrada</button>
          </td>
        )}
      </tr>
      {editando && (
        <tr className="bg-slate-50">
          <td colSpan={9} className="p-3">
            <div className="flex flex-wrap items-end gap-3">
              <div><label className="label">Costo unitario</label><input type="number" step="0.01" className="input w-32" value={costo} onChange={(e) => setCosto(Number(e.target.value))} /></div>
              <div><label className="label">Precio lista</label><input type="number" step="0.01" className="input w-32" value={precio} onChange={(e) => setPrecio(Number(e.target.value))} /></div>
              <div className="min-w-[220px] flex-1"><label className="label">URL de imagen (opcional)</label><input className="input" placeholder="https://…" value={imagenUrl} onChange={(e) => setImagenUrl(e.target.value)} /></div>
              <div className="min-w-[220px] flex-1"><label className="label">Especificaciones (opcional)</label><input className="input" placeholder="Medidas, material, etc." value={especificaciones} onChange={(e) => setEspecificaciones(e.target.value)} /></div>
              <button disabled={guardando} className="btn btn-primary" onClick={async () => {
                setGuardando(true);
                await actualizarProducto(p.id, {
                  costo_unitario: costo, precio_lista: precio,
                  imagen_url: imagenUrl.trim() || null, especificaciones: especificaciones.trim() || null,
                });
                setGuardando(false);
                onCerrarEdicion();
              }}>Guardar</button>
              <button className="btn btn-ghost" onClick={onCerrarEdicion}>Cancelar</button>
            </div>
          </td>
        </tr>
      )}
      {entradaAbierta && (
        <tr className="bg-emerald-50">
          <td colSpan={9} className="p-3">
            <div className="flex flex-wrap items-end gap-3">
              <div><label className="label">Cantidad que ingresa</label><input type="number" step="1" className="input w-32" value={cantEntrada} onChange={(e) => setCantEntrada(Number(e.target.value))} /></div>
              <div className="flex-1 min-w-[200px]"><label className="label">Comentario / referencia</label><input className="input" value={comentEntrada} onChange={(e) => setComentEntrada(e.target.value)} /></div>
              <button disabled={guardando || cantEntrada <= 0} className="btn btn-primary" onClick={async () => {
                setGuardando(true);
                await registrarEntradaInventario(p.id, cantEntrada, comentEntrada || 'Entrada de inventario');
                setGuardando(false);
                onCerrarEntrada();
              }}>Registrar entrada</button>
              <button className="btn btn-ghost" onClick={onCerrarEntrada}>Cancelar</button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function NuevoProductoForm({ onClose }: { onClose: () => void }) {
  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');
  const [color, setColor] = useState('');
  const [costo, setCosto] = useState(0);
  const [precio, setPrecio] = useState(0);
  const [stock, setStock] = useState(0);
  const [imagenUrl, setImagenUrl] = useState('');
  const [especificaciones, setEspecificaciones] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  return (
    <div className="card border-navy-200 bg-navy-50/40">
      <h3 className="mb-3 text-sm font-bold text-slate-700">Nuevo producto</h3>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <input className="input" placeholder="Código (INV-032)" value={codigo} onChange={(e) => setCodigo(e.target.value)} />
        <input className="input sm:col-span-2" placeholder="Nombre del producto" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <input className="input" placeholder="Color / variante (opcional)" value={color} onChange={(e) => setColor(e.target.value)} />
        <input type="number" step="0.01" className="input" placeholder="Costo" value={costo} onChange={(e) => setCosto(Number(e.target.value))} />
        <input type="number" step="0.01" className="input" placeholder="Precio lista" value={precio} onChange={(e) => setPrecio(Number(e.target.value))} />
        <input type="number" step="1" className="input" placeholder="Stock inicial" value={stock} onChange={(e) => setStock(Number(e.target.value))} />
        <input className="input sm:col-span-2" placeholder="URL de imagen (opcional)" value={imagenUrl} onChange={(e) => setImagenUrl(e.target.value)} />
        <input className="input" placeholder="Especificaciones (opcional)" value={especificaciones} onChange={(e) => setEspecificaciones(e.target.value)} />
      </div>
      <div className="mt-3 flex gap-2">
        <button disabled={guardando} className="btn btn-orange" onClick={async () => {
          if (!codigo || !nombre) { setError('Código y nombre son obligatorios.'); return; }
          setGuardando(true);
          const r = await crearProducto({
            codigo, nombre, color_variante: color || null, unidad: 'unidad', costo_unitario: costo, precio_lista: precio, stock_actual: stock,
            imagen_url: imagenUrl.trim() || null, especificaciones: especificaciones.trim() || null,
          });
          setGuardando(false);
          if (r?.error) setError(r.error); else onClose();
        }}>Guardar</button>
        <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
      </div>
    </div>
  );
}
