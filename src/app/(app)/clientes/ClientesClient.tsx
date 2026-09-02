'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { actualizarCliente, crearCliente } from './actions';
import type { Cliente } from '@/lib/types';

export default function ClientesClient({ clientes, puedeEditar }: { clientes: Cliente[]; puedeEditar: boolean }) {
  const router = useRouter();
  const [busqueda, setBusqueda] = useState('');
  const [editando, setEditando] = useState<string | null>(null);
  const [mostrarNuevo, setMostrarNuevo] = useState(false);

  const siguienteCodigo = useMemo(() => {
    const numeros = clientes
      .map((c) => /^CLI-(\d+)$/.exec(c.codigo)?.[1])
      .filter(Boolean)
      .map((n) => Number(n));
    const siguiente = (numeros.length > 0 ? Math.max(...numeros) : 0) + 1;
    return `CLI-${String(siguiente).padStart(3, '0')}`;
  }, [clientes]);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return clientes;
    return clientes.filter((c) =>
      c.codigo.toLowerCase().includes(q)
      || c.nombre_razon.toLowerCase().includes(q)
      || (c.nit ?? '').toLowerCase().includes(q)
    );
  }, [busqueda, clientes]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input className="input max-w-xs" placeholder="Buscar código, nombre o NIT…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        {puedeEditar && <button className="btn btn-orange" onClick={() => setMostrarNuevo(true)}>+ Nuevo cliente</button>}
      </div>

      {mostrarNuevo && (
        <NuevoClienteForm codigoSugerido={siguienteCodigo} onClose={() => { setMostrarNuevo(false); router.refresh(); }} />
      )}

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-400">
              <th className="py-2 pr-2">Código</th><th className="py-2 pr-2">Nombre / Razón social</th>
              <th className="py-2 pr-2">NIT</th><th className="py-2 pr-2">Teléfono</th>
              <th className="py-2 pr-2">Contacto</th><th className="py-2 pr-2">Retenedor IVA</th>
              <th className="py-2 pr-2">Estado</th>
              {puedeEditar && <th className="py-2 pr-2"></th>}
            </tr>
          </thead>
          <tbody>
            {filtrados.map((c) => (
              <FilaCliente key={c.id} c={c} puedeEditar={puedeEditar}
                editando={editando === c.id} onEditar={() => setEditando(c.id)}
                onCerrarEdicion={() => { setEditando(null); router.refresh(); }}
              />
            ))}
            {filtrados.length === 0 && (
              <tr><td colSpan={7} className="py-8 text-center text-slate-400">Sin clientes que coincidan con la búsqueda.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FilaCliente({
  c, puedeEditar, editando, onEditar, onCerrarEdicion,
}: {
  c: Cliente; puedeEditar: boolean; editando: boolean; onEditar: () => void; onCerrarEdicion: () => void;
}) {
  const [nombre, setNombre] = useState(c.nombre_razon);
  const [nit, setNit] = useState(c.nit ?? '');
  const [direccion, setDireccion] = useState(c.direccion ?? '');
  const [telefono, setTelefono] = useState(c.telefono ?? '');
  const [contacto, setContacto] = useState(c.contacto ?? '');
  const [esRetenedor, setEsRetenedor] = useState(c.es_retenedor_iva);
  const [guardando, setGuardando] = useState(false);

  return (
    <>
      <tr className="border-b border-slate-100 last:border-0">
        <td className="py-2 pr-2 font-mono text-xs text-slate-500">{c.codigo}</td>
        <td className="py-2 pr-2">{c.nombre_razon}</td>
        <td className="py-2 pr-2">{c.nit ?? '—'}</td>
        <td className="py-2 pr-2">{c.telefono ?? '—'}</td>
        <td className="py-2 pr-2">{c.contacto ?? '—'}</td>
        <td className="py-2 pr-2">
          {c.es_retenedor_iva
            ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">Sí</span>
            : <span className="text-slate-400">No</span>}
        </td>
        <td className="py-2 pr-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${c.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
            {c.activo ? 'Activo' : 'Inactivo'}
          </span>
        </td>
        {puedeEditar && (
          <td className="py-2 pr-2 whitespace-nowrap">
            <button className="mr-2 text-xs font-semibold text-navy-600 hover:underline" onClick={onEditar}>Editar</button>
            <button
              className="text-xs font-semibold text-slate-500 hover:underline"
              onClick={async () => { await actualizarCliente(c.id, { activo: !c.activo }); onCerrarEdicion(); }}
            >
              {c.activo ? 'Desactivar' : 'Activar'}
            </button>
          </td>
        )}
      </tr>
      {editando && (
        <tr className="bg-slate-50">
          <td colSpan={8} className="p-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div><label className="label">Nombre / Razón social</label><input className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} /></div>
              <div><label className="label">NIT</label><input className="input" value={nit} onChange={(e) => setNit(e.target.value)} /></div>
              <div><label className="label">Teléfono</label><input className="input" value={telefono} onChange={(e) => setTelefono(e.target.value)} /></div>
              <div className="sm:col-span-2"><label className="label">Dirección</label><input className="input" value={direccion} onChange={(e) => setDireccion(e.target.value)} /></div>
              <div><label className="label">Contacto</label><input className="input" value={contacto} onChange={(e) => setContacto(e.target.value)} /></div>
              <label className="flex items-center gap-2 pt-6 text-sm text-slate-600 sm:col-span-3">
                <input type="checkbox" checked={esRetenedor} onChange={(e) => setEsRetenedor(e.target.checked)} />
                Es agente retenedor de IVA
              </label>
            </div>
            <div className="mt-3 flex gap-2">
              <button disabled={guardando} className="btn btn-primary" onClick={async () => {
                setGuardando(true);
                await actualizarCliente(c.id, {
                  nombre_razon: nombre, nit: nit || null, direccion: direccion || null,
                  telefono: telefono || null, contacto: contacto || null, es_retenedor_iva: esRetenedor,
                });
                setGuardando(false);
                onCerrarEdicion();
              }}>Guardar</button>
              <button className="btn btn-ghost" onClick={onCerrarEdicion}>Cancelar</button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function NuevoClienteForm({ codigoSugerido, onClose }: { codigoSugerido: string; onClose: () => void }) {
  const [codigo, setCodigo] = useState(codigoSugerido);
  const [nombre, setNombre] = useState('');
  const [nit, setNit] = useState('');
  const [direccion, setDireccion] = useState('');
  const [telefono, setTelefono] = useState('');
  const [contacto, setContacto] = useState('');
  const [esRetenedor, setEsRetenedor] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  return (
    <div className="card border-navy-200 bg-navy-50/40">
      <h3 className="mb-3 text-sm font-bold text-slate-700">Nuevo cliente</h3>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div><label className="label">Código</label><input className="input" value={codigo} onChange={(e) => setCodigo(e.target.value)} /></div>
        <div className="sm:col-span-2"><label className="label">Nombre / Razón social</label><input className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} /></div>
        <div><label className="label">NIT (o CF)</label><input className="input" value={nit} onChange={(e) => setNit(e.target.value)} /></div>
        <div><label className="label">Teléfono</label><input className="input" value={telefono} onChange={(e) => setTelefono(e.target.value)} /></div>
        <div><label className="label">Contacto</label><input className="input" value={contacto} onChange={(e) => setContacto(e.target.value)} /></div>
        <div className="sm:col-span-2 lg:col-span-3"><label className="label">Dirección</label><input className="input" value={direccion} onChange={(e) => setDireccion(e.target.value)} /></div>
        <label className="flex items-center gap-2 text-sm text-slate-600 sm:col-span-2 lg:col-span-3">
          <input type="checkbox" checked={esRetenedor} onChange={(e) => setEsRetenedor(e.target.checked)} />
          Es agente retenedor de IVA
        </label>
      </div>
      <div className="mt-3 flex gap-2">
        <button disabled={guardando} className="btn btn-orange" onClick={async () => {
          if (!codigo || !nombre) { setError('Código y nombre son obligatorios.'); return; }
          setGuardando(true);
          const r = await crearCliente({
            codigo, nombre_razon: nombre, nit: nit || null, direccion: direccion || null,
            telefono: telefono || null, contacto: contacto || null, es_retenedor_iva: esRetenedor,
          });
          setGuardando(false);
          if (r?.error) setError(r.error); else onClose();
        }}>Guardar</button>
        <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
      </div>
    </div>
  );
}
