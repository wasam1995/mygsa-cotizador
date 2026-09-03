'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  activarDesactivarUsuario, actualizarPermisosRol, cambiarRolUsuario, crearRol, crearUsuario, eliminarUsuario,
} from './actions';
import type { Permiso, Rol, Usuario } from '@/lib/types';

type UsuarioConRol = Usuario & { rol: { id: string; codigo: string; nombre: string } | null };

export default function UsuariosClient({
  usuarios, roles, permisos, permisosPorRolInicial,
}: {
  usuarios: UsuarioConRol[];
  roles: Rol[];
  permisos: Permiso[];
  permisosPorRolInicial: Record<string, string[]>;
}) {
  const [tab, setTab] = useState<'usuarios' | 'roles'>('usuarios');

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-slate-200">
        <button
          className={`px-4 py-2 text-sm font-semibold ${tab === 'usuarios' ? 'border-b-2 border-orange-500 text-navy-800' : 'text-slate-500'}`}
          onClick={() => setTab('usuarios')}
        >
          Usuarios
        </button>
        <button
          className={`px-4 py-2 text-sm font-semibold ${tab === 'roles' ? 'border-b-2 border-orange-500 text-navy-800' : 'text-slate-500'}`}
          onClick={() => setTab('roles')}
        >
          Roles y permisos
        </button>
      </div>

      {tab === 'usuarios' && <SeccionUsuarios usuarios={usuarios} roles={roles} />}
      {tab === 'roles' && <SeccionRoles roles={roles} permisos={permisos} permisosPorRolInicial={permisosPorRolInicial} />}
    </div>
  );
}

// ---------------------------------------------------------------------------------------
// Usuarios
// ---------------------------------------------------------------------------------------

function SeccionUsuarios({ usuarios, roles }: { usuarios: UsuarioConRol[]; roles: Rol[] }) {
  const router = useRouter();
  const [mostrarNuevo, setMostrarNuevo] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button className="btn btn-orange" onClick={() => setMostrarNuevo(true)}>+ Nuevo usuario</button>
      </div>

      {mostrarNuevo && (
        <NuevoUsuarioForm roles={roles} onClose={() => { setMostrarNuevo(false); router.refresh(); }} />
      )}

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-400">
              <th className="py-2 pr-2">Nombre</th><th className="py-2 pr-2">Correo</th>
              <th className="py-2 pr-2">Teléfono</th><th className="py-2 pr-2">Rol</th>
              <th className="py-2 pr-2">Estado</th><th className="py-2 pr-2"></th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <FilaUsuario key={u.id} u={u} roles={roles} onCambio={() => router.refresh()} />
            ))}
            {usuarios.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-slate-400">Sin usuarios registrados.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FilaUsuario({ u, roles, onCambio }: { u: UsuarioConRol; roles: Rol[]; onCambio: () => void }) {
  const [rolId, setRolId] = useState(u.rol_id);
  const [guardando, setGuardando] = useState(false);
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(false);
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null);

  async function handleEliminar() {
    setGuardando(true);
    setErrorEliminar(null);
    const r = await eliminarUsuario(u.id);
    setGuardando(false);
    setConfirmandoEliminar(false);
    if (r?.error) setErrorEliminar(r.error); else onCambio();
  }

  return (
    <>
      <tr className="border-b border-slate-100 last:border-0">
        <td className="py-2 pr-2 font-medium">{u.nombre_completo}</td>
        <td className="py-2 pr-2 text-slate-500">{u.correo}</td>
        <td className="py-2 pr-2 text-slate-500">{u.telefono ?? '—'}</td>
        <td className="py-2 pr-2">
          <select
            className="input w-44"
            value={rolId}
            disabled={guardando}
            onChange={async (e) => {
              const nuevo = e.target.value;
              setRolId(nuevo);
              setGuardando(true);
              await cambiarRolUsuario(u.id, nuevo);
              setGuardando(false);
              onCambio();
            }}
          >
            {roles.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
          </select>
        </td>
        <td className="py-2 pr-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${u.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
            {u.activo ? 'Activo' : 'Inactivo'}
          </span>
        </td>
        <td className="py-2 pr-2 whitespace-nowrap">
          <button
            className="mr-2 text-xs font-semibold text-navy-600 hover:underline"
            disabled={guardando}
            onClick={async () => {
              setGuardando(true);
              await activarDesactivarUsuario(u.id, !u.activo);
              setGuardando(false);
              onCambio();
            }}
          >
            {u.activo ? 'Desactivar' : 'Activar'}
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
      </tr>
      {errorEliminar && (
        <tr className="border-b border-slate-100 last:border-0 bg-red-50">
          <td colSpan={6} className="px-2 py-2 text-xs text-red-700">{errorEliminar}</td>
        </tr>
      )}
    </>
  );
}

function NuevoUsuarioForm({ roles, onClose }: { roles: Rol[]; onClose: () => void }) {
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [telefono, setTelefono] = useState('');
  const [password, setPassword] = useState('');
  const [rolId, setRolId] = useState(roles[0]?.id ?? '');
  const [crearVendedor, setCrearVendedor] = useState(false);
  const [codigoVendedor, setCodigoVendedor] = useState('');
  const [porcentajeComision, setPorcentajeComision] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  return (
    <div className="card border-navy-200 bg-navy-50/40">
      <h3 className="mb-3 text-sm font-bold text-slate-700">Nuevo usuario</h3>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div><label className="label">Nombre completo</label><input className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} /></div>
        <div><label className="label">Correo</label><input type="email" className="input" value={correo} onChange={(e) => setCorreo(e.target.value)} /></div>
        <div><label className="label">Teléfono (+502########)</label><input className="input" placeholder="+50212345678" value={telefono} onChange={(e) => setTelefono(e.target.value)} /></div>
        <div><label className="label">Contraseña temporal</label><input type="text" className="input" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        <div>
          <label className="label">Rol</label>
          <select className="input" value={rolId} onChange={(e) => setRolId(e.target.value)}>
            {roles.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2 pt-6">
          <input id="crear_vendedor" type="checkbox" checked={crearVendedor} onChange={(e) => setCrearVendedor(e.target.checked)} />
          <label htmlFor="crear_vendedor" className="text-sm text-slate-600">Crear también como vendedor</label>
        </div>
        {crearVendedor && (
          <>
            <div><label className="label">Código de vendedor</label><input className="input" placeholder="VEN-006" value={codigoVendedor} onChange={(e) => setCodigoVendedor(e.target.value)} /></div>
            <div><label className="label">% Comisión</label><input type="number" step="0.01" className="input" value={porcentajeComision} onChange={(e) => setPorcentajeComision(Number(e.target.value))} /></div>
          </>
        )}
      </div>
      <div className="mt-3 flex gap-2">
        <button
          disabled={guardando}
          className="btn btn-orange"
          onClick={async () => {
            if (!nombre || !correo || !password || !rolId) { setError('Nombre, correo, contraseña y rol son obligatorios.'); return; }
            if (telefono && !/^\+502\d{8}$/.test(telefono)) { setError('El teléfono debe tener el formato +502 seguido de 8 dígitos.'); return; }
            setGuardando(true);
            const r = await crearUsuario({
              nombre_completo: nombre, correo, telefono: telefono || null, rol_id: rolId, password,
              crear_vendedor: crearVendedor, codigo_vendedor: codigoVendedor || undefined, porcentaje_comision: porcentajeComision,
            });
            setGuardando(false);
            if (r?.error) setError(r.error); else onClose();
          }}
        >
          Guardar
        </button>
        <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------
// Roles y permisos
// ---------------------------------------------------------------------------------------

function SeccionRoles({
  roles, permisos, permisosPorRolInicial,
}: { roles: Rol[]; permisos: Permiso[]; permisosPorRolInicial: Record<string, string[]> }) {
  const router = useRouter();
  const [rolSeleccionado, setRolSeleccionado] = useState<string | null>(roles[0]?.id ?? null);
  const [mostrarNuevoRol, setMostrarNuevoRol] = useState(false);

  const modulos = useMemo(() => {
    const grupos = new Map<string, Permiso[]>();
    for (const p of permisos) {
      const lista = grupos.get(p.modulo) ?? [];
      lista.push(p);
      grupos.set(p.modulo, lista);
    }
    return [...grupos.entries()];
  }, [permisos]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[240px_1fr]">
      <div className="card">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-700">Roles</h3>
          <button className="text-xs font-semibold text-orange-600 hover:underline" onClick={() => setMostrarNuevoRol(true)}>+ Nuevo</button>
        </div>
        <ul className="space-y-1">
          {roles.map((r) => (
            <li key={r.id}>
              <button
                className={`w-full rounded-lg px-3 py-2 text-left text-sm ${rolSeleccionado === r.id ? 'bg-navy-100 font-semibold text-navy-800' : 'text-slate-600 hover:bg-slate-50'}`}
                onClick={() => setRolSeleccionado(r.id)}
              >
                {r.nombre}
                {r.es_sistema && <span className="ml-1 text-xs text-slate-400">(base)</span>}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {mostrarNuevoRol && (
        <div className="lg:col-span-2">
          <NuevoRolForm permisos={permisos} modulos={modulos} onClose={() => { setMostrarNuevoRol(false); router.refresh(); }} />
        </div>
      )}

      {!mostrarNuevoRol && rolSeleccionado && (
        // key={rolSeleccionado} es lo que faltaba: sin esto, React reutiliza la misma
        // instancia del componente al cambiar de rol y su useState(permisosActuales)
        // queda "congelado" con los permisos del PRIMER rol que se mostró — por eso
        // los cambios de permisos de un rol podían terminar guardándose (o mostrándose)
        // sobre otro. Con key, React desmonta y vuelve a montar el componente entero
        // cada vez que cambia el rol seleccionado, así el estado siempre arranca limpio.
        <PermisosDeRol
          key={rolSeleccionado}
          rolId={rolSeleccionado}
          rolNombre={roles.find((r) => r.id === rolSeleccionado)?.nombre ?? ''}
          modulos={modulos}
          permisosActuales={permisosPorRolInicial[rolSeleccionado] ?? []}
          onGuardado={() => router.refresh()}
        />
      )}
    </div>
  );
}

function PermisosDeRol({
  rolId, rolNombre, modulos, permisosActuales, onGuardado,
}: { rolId: string; rolNombre: string; modulos: [string, Permiso[]][]; permisosActuales: string[]; onGuardado: () => void }) {
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set(permisosActuales));
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function alternar(codigo: string) {
    setSeleccionados((prev) => {
      const nuevo = new Set(prev);
      if (nuevo.has(codigo)) nuevo.delete(codigo); else nuevo.add(codigo);
      return nuevo;
    });
  }

  return (
    <div className="card">
      <h3 className="mb-3 text-sm font-bold text-slate-700">Permisos de: {rolNombre}</h3>
      <div className="space-y-4">
        {modulos.map(([modulo, lista]) => (
          <div key={modulo}>
            <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-400">{modulo}</p>
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {lista.map((p) => (
                <label key={p.id} className="flex items-start gap-2 text-sm text-slate-600">
                  <input type="checkbox" className="mt-0.5" checked={seleccionados.has(p.codigo)} onChange={() => alternar(p.codigo)} />
                  <span>{p.descripcion}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
      {mensaje && <p className="mt-3 text-sm text-emerald-600">{mensaje}</p>}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <div className="mt-4">
        <button
          disabled={guardando}
          className="btn btn-primary"
          onClick={async () => {
            setGuardando(true);
            setMensaje(null);
            setError(null);
            const r = await actualizarPermisosRol(rolId, [...seleccionados]);
            setGuardando(false);
            if (r?.error) { setError(r.error); return; }
            setMensaje('Permisos actualizados.');
            onGuardado();
          }}
        >
          Guardar cambios
        </button>
      </div>
    </div>
  );
}

function NuevoRolForm({
  permisos, modulos, onClose,
}: { permisos: Permiso[]; modulos: [string, Permiso[]][]; onClose: () => void }) {
  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  function alternar(codigo: string) {
    setSeleccionados((prev) => {
      const nuevo = new Set(prev);
      if (nuevo.has(codigo)) nuevo.delete(codigo); else nuevo.add(codigo);
      return nuevo;
    });
  }

  return (
    <div className="card border-orange-200 bg-orange-50/40">
      <h3 className="mb-3 text-sm font-bold text-slate-700">Nuevo rol / perfil</h3>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div><label className="label">Nombre visible</label><input className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} /></div>
        <div><label className="label">Código interno</label><input className="input" placeholder="SUPERVISOR" value={codigo} onChange={(e) => setCodigo(e.target.value)} /></div>
        <div><label className="label">Descripción</label><input className="input" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} /></div>
      </div>

      <div className="mt-4 space-y-4">
        {modulos.map(([modulo, lista]) => (
          <div key={modulo}>
            <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-400">{modulo}</p>
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {lista.map((p) => (
                <label key={p.id} className="flex items-start gap-2 text-sm text-slate-600">
                  <input type="checkbox" className="mt-0.5" checked={seleccionados.has(p.codigo)} onChange={() => alternar(p.codigo)} />
                  <span>{p.descripcion}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex gap-2">
        <button
          disabled={guardando}
          className="btn btn-orange"
          onClick={async () => {
            if (!nombre || !codigo) { setError('Nombre y código son obligatorios.'); return; }
            setGuardando(true);
            const r = await crearRol({ codigo, nombre, descripcion, permisoCodigos: [...seleccionados] });
            setGuardando(false);
            if (r?.error) setError(r.error); else onClose();
          }}
        >
          Crear rol
        </button>
        <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
      </div>
    </div>
  );
}
