'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { actualizarVendedor, crearVendedor, eliminarVendedor } from './actions';
import type { Vendedor } from '@/lib/types';

type UsuarioOpcion = { id: string; nombre_completo: string; correo: string };

function validarTelefono(telefono: string): string | null {
  if (telefono && !/^\+502\d{8}$/.test(telefono)) {
    return 'El teléfono debe tener el formato +502 seguido de 8 dígitos (ej. +50212345678).';
  }
  return null;
}

export default function VendedoresClient({
  vendedores, usuarios, puedeEditar,
}: { vendedores: Vendedor[]; usuarios: UsuarioOpcion[]; puedeEditar: boolean }) {
  const router = useRouter();
  const [busqueda, setBusqueda] = useState('');
  const [editando, setEditando] = useState<string | null>(null);
  const [mostrarNuevo, setMostrarNuevo] = useState(false);

  const siguienteCodigo = useMemo(() => {
    const numeros = vendedores
      .map((v) => /^VEN-(\d+)$/.exec(v.codigo)?.[1])
      .filter(Boolean)
      .map((n) => Number(n));
    const siguiente = (numeros.length > 0 ? Math.max(...numeros) : 100) + 1;
    return `VEN-${String(siguiente).padStart(3, '0')}`;
  }, [vendedores]);

  // Usuarios ya vinculados a otro vendedor no deben poder vincularse dos veces.
  const usuariosVinculados = useMemo(
    () => new Set(vendedores.map((v) => v.usuario_id).filter((id): id is string => Boolean(id))),
    [vendedores]
  );

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return vendedores;
    return vendedores.filter((v) =>
      v.codigo.toLowerCase().includes(q)
      || v.nombre_completo.toLowerCase().includes(q)
      || (v.correo ?? '').toLowerCase().includes(q)
      || (v.telefono ?? '').toLowerCase().includes(q)
    );
  }, [busqueda, vendedores]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input className="input max-w-xs" placeholder="Buscar código, nombre, correo o teléfono…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        {puedeEditar && <button className="btn btn-orange" onClick={() => setMostrarNuevo(true)}>+ Nuevo vendedor</button>}
      </div>

      {mostrarNuevo && (
        <NuevoVendedorForm
          codigoSugerido={siguienteCodigo}
          usuarios={usuarios}
          usuariosVinculados={usuariosVinculados}
          onClose={() => { setMostrarNuevo(false); router.refresh(); }}
        />
      )}

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-400">
              <th className="py-2 pr-2">Código</th><th className="py-2 pr-2">Nombre completo</th>
              <th className="py-2 pr-2">Teléfono</th><th className="py-2 pr-2">Correo</th>
              <th className="py-2 pr-2">% Comisión fija*</th><th className="py-2 pr-2">Usuario vinculado</th>
              <th className="py-2 pr-2">Estado</th>
              {puedeEditar && <th className="py-2 pr-2"></th>}
            </tr>
          </thead>
          <tbody>
            {filtrados.map((v) => (
              <FilaVendedor key={v.id} v={v} puedeEditar={puedeEditar}
                usuarios={usuarios} usuariosVinculados={usuariosVinculados}
                editando={editando === v.id} onEditar={() => setEditando(v.id)}
                onCerrarEdicion={() => { setEditando(null); router.refresh(); }}
              />
            ))}
            {filtrados.length === 0 && (
              <tr><td colSpan={8} className="py-8 text-center text-slate-400">Sin vendedores que coincidan con la búsqueda.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400">
        * El % de comisión del vendedor queda solo como referencia informativa — la comisión real de cada cotización
        se calcula según la escala de comisiones por margen de utilidad (configurable en Parámetros).
      </p>
    </div>
  );
}

function FilaVendedor({
  v, puedeEditar, usuarios, usuariosVinculados, editando, onEditar, onCerrarEdicion,
}: {
  v: Vendedor; puedeEditar: boolean; usuarios: UsuarioOpcion[]; usuariosVinculados: Set<string>;
  editando: boolean; onEditar: () => void; onCerrarEdicion: () => void;
}) {
  const [nombre, setNombre] = useState(v.nombre_completo);
  const [telefono, setTelefono] = useState(v.telefono ?? '');
  const [correo, setCorreo] = useState(v.correo ?? '');
  const [comision, setComision] = useState(String(v.porcentaje_comision));
  const [usuarioId, setUsuarioId] = useState(v.usuario_id ?? '');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(false);
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null);

  const usuarioActual = usuarios.find((u) => u.id === v.usuario_id);
  const opcionesUsuario = usuarios.filter((u) => u.id === v.usuario_id || !usuariosVinculados.has(u.id));

  async function handleEliminar() {
    setGuardando(true);
    setErrorEliminar(null);
    const r = await eliminarVendedor(v.id);
    setGuardando(false);
    setConfirmandoEliminar(false);
    if (r?.error) setErrorEliminar(r.error); else onCerrarEdicion();
  }

  return (
    <>
      <tr className="border-b border-slate-100 last:border-0">
        <td className="py-2 pr-2 font-mono text-xs text-slate-500">{v.codigo}</td>
        <td className="py-2 pr-2">{v.nombre_completo}</td>
        <td className="py-2 pr-2">{v.telefono ?? '—'}</td>
        <td className="py-2 pr-2">{v.correo ?? '—'}</td>
        <td className="py-2 pr-2">{v.porcentaje_comision}%</td>
        <td className="py-2 pr-2 text-slate-500">{usuarioActual ? usuarioActual.nombre_completo : '—'}</td>
        <td className="py-2 pr-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${v.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
            {v.activo ? 'Activo' : 'Inactivo'}
          </span>
        </td>
        {puedeEditar && (
          <td className="py-2 pr-2 whitespace-nowrap">
            <button className="mr-2 text-xs font-semibold text-navy-600 hover:underline" onClick={onEditar}>Editar</button>
            <button
              className="mr-2 text-xs font-semibold text-slate-500 hover:underline"
              onClick={async () => { await actualizarVendedor(v.id, { activo: !v.activo }); onCerrarEdicion(); }}
            >
              {v.activo ? 'Desactivar' : 'Activar'}
            </button>
            {!confirmandoEliminar ? (
              <button className="text-xs font-semibold text-red-500 hover:underline" disabled={guardando} onClick={() => setConfirmandoEliminar(true)}>
                Eliminar
              </button>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs">
                ¿Eliminar?
                <button className="font-semibold text-red-600 hover:underline" disabled={guardando} onClick={handleEliminar}>Sí</button>
                <button className="text-slate-400 hover:underline" disabled={guardando} onClick={() => setConfirmandoEliminar(false)}>No</button>
              </span>
            )}
          </td>
        )}
      </tr>
      {errorEliminar && (
        <tr className="bg-red-50">
          <td colSpan={8} className="px-2 py-2 text-xs text-red-700">{errorEliminar}</td>
        </tr>
      )}
      {editando && (
        <tr className="bg-slate-50">
          <td colSpan={8} className="p-3">
            {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div><label className="label">Nombre completo</label><input className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} /></div>
              <div><label className="label">Teléfono (+502########)</label><input className="input" placeholder="+50212345678" value={telefono} onChange={(e) => setTelefono(e.target.value)} /></div>
              <div><label className="label">Correo</label><input className="input" type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} /></div>
              <div><label className="label">% Comisión fija (informativo)</label><input className="input" type="number" step="0.001" value={comision} onChange={(e) => setComision(e.target.value)} /></div>
              <div className="sm:col-span-2">
                <label className="label">Usuario del sistema vinculado (opcional)</label>
                <select className="input" value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)}>
                  <option value="">— Sin vincular (solo catálogo, no inicia sesión) —</option>
                  {opcionesUsuario.map((u) => (
                    <option key={u.id} value={u.id}>{u.nombre_completo} ({u.correo})</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <button disabled={guardando} className="btn btn-primary" onClick={async () => {
                const errTel = validarTelefono(telefono);
                if (errTel) { setError(errTel); return; }
                setError(null);
                setGuardando(true);
                const r = await actualizarVendedor(v.id, {
                  nombre_completo: nombre, telefono: telefono || null, correo: correo || null,
                  porcentaje_comision: Number(comision) || 0, usuario_id: usuarioId || null,
                });
                setGuardando(false);
                if (r?.error) setError(r.error); else onCerrarEdicion();
              }}>Guardar</button>
              <button className="btn btn-ghost" onClick={onCerrarEdicion}>Cancelar</button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function NuevoVendedorForm({
  codigoSugerido, usuarios, usuariosVinculados, onClose,
}: { codigoSugerido: string; usuarios: UsuarioOpcion[]; usuariosVinculados: Set<string>; onClose: () => void }) {
  const [codigo, setCodigo] = useState(codigoSugerido);
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [correo, setCorreo] = useState('');
  const [comision, setComision] = useState('0');
  const [usuarioId, setUsuarioId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const opcionesUsuario = usuarios.filter((u) => !usuariosVinculados.has(u.id));

  return (
    <div className="card border-navy-200 bg-navy-50/40">
      <h3 className="mb-3 text-sm font-bold text-slate-700">Nuevo vendedor</h3>
      <p className="mb-3 text-xs text-slate-500">
        Un vendedor puede existir solo como catálogo (para asignarlo a cotizaciones) sin necesidad de crearle un usuario
        con acceso al sistema. Si ya tiene un usuario, puedes vincularlo abajo.
      </p>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div><label className="label">Código</label><input className="input" value={codigo} onChange={(e) => setCodigo(e.target.value)} /></div>
        <div className="sm:col-span-2"><label className="label">Nombre completo</label><input className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} /></div>
        <div><label className="label">Teléfono (+502########)</label><input className="input" placeholder="+50212345678" value={telefono} onChange={(e) => setTelefono(e.target.value)} /></div>
        <div><label className="label">Correo</label><input className="input" type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} /></div>
        <div><label className="label">% Comisión fija (informativo)</label><input className="input" type="number" step="0.001" value={comision} onChange={(e) => setComision(e.target.value)} /></div>
        <div className="sm:col-span-2 lg:col-span-3">
          <label className="label">Usuario del sistema vinculado (opcional)</label>
          <select className="input" value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)}>
            <option value="">— Sin vincular (solo catálogo, no inicia sesión) —</option>
            {opcionesUsuario.map((u) => (
              <option key={u.id} value={u.id}>{u.nombre_completo} ({u.correo})</option>
            ))}
          </select>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button disabled={guardando} className="btn btn-orange" onClick={async () => {
          if (!codigo || !nombre) { setError('Código y nombre son obligatorios.'); return; }
          const errTel = validarTelefono(telefono);
          if (errTel) { setError(errTel); return; }
          setError(null);
          setGuardando(true);
          const r = await crearVendedor({
            codigo, nombre_completo: nombre, telefono: telefono || null, correo: correo || null,
            porcentaje_comision: Number(comision) || 0, usuario_id: usuarioId || null,
          });
          setGuardando(false);
          if (r?.error) setError(r.error); else onClose();
        }}>Guardar</button>
        <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
      </div>
    </div>
  );
}
