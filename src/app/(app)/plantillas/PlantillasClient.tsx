'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { activarDesactivarPlantilla, actualizarPlantilla, crearPlantilla, marcarPredeterminada } from './actions';
import type { PlantillaCotizacion } from '@/lib/types';

export default function PlantillasClient({ plantillas }: { plantillas: PlantillaCotizacion[] }) {
  const router = useRouter();
  const [mostrarNueva, setMostrarNueva] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <button className="btn btn-orange" onClick={() => setMostrarNueva(true)}>+ Nueva plantilla</button>

      {mostrarNueva && (
        <FormularioPlantilla
          onGuardar={async (datos) => crearPlantilla(datos)}
          onListo={() => { setMostrarNueva(false); router.refresh(); }}
          onCancelar={() => setMostrarNueva(false)}
        />
      )}

      <div className="space-y-3">
        {plantillas.map((p) => (
          <div key={p.id} className={`card ${!p.activo ? 'opacity-60' : ''}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <p className="font-bold text-slate-800">{p.nombre}</p>
                {p.es_predeterminada && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">Predeterminada</span>}
                {!p.activo && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-500">Inactiva</span>}
              </div>
              <div className="flex gap-2">
                {!p.es_predeterminada && p.activo && (
                  <button className="text-xs font-semibold text-navy-600 hover:underline"
                    onClick={async () => { await marcarPredeterminada(p.id); router.refresh(); }}>
                    Marcar como predeterminada
                  </button>
                )}
                <button className="text-xs font-semibold text-navy-600 hover:underline" onClick={() => setEditando(editando === p.id ? null : p.id)}>
                  {editando === p.id ? 'Cerrar' : 'Editar'}
                </button>
                <button className="text-xs font-semibold text-slate-400 hover:text-red-600"
                  onClick={async () => { await activarDesactivarPlantilla(p.id, !p.activo); router.refresh(); }}>
                  {p.activo ? 'Desactivar' : 'Activar'}
                </button>
              </div>
            </div>

            {editando === p.id ? (
              <div className="mt-3">
                <FormularioPlantilla
                  inicial={p}
                  onGuardar={async (datos) => actualizarPlantilla(p.id, datos)}
                  onListo={() => { setEditando(null); router.refresh(); }}
                  onCancelar={() => setEditando(null)}
                />
              </div>
            ) : (
              <div className="mt-2 text-xs text-slate-500">
                <p className="whitespace-pre-line">{p.condiciones_comerciales}</p>
              </div>
            )}
          </div>
        ))}
        {plantillas.length === 0 && <p className="text-sm text-slate-400">Sin plantillas todavía.</p>}
      </div>
    </div>
  );
}

function FormularioPlantilla({
  inicial, onGuardar, onListo, onCancelar,
}: {
  inicial?: PlantillaCotizacion;
  onGuardar: (datos: { nombre: string; condiciones_comerciales: string; leyenda_pie: string }) => Promise<{ error?: string } | undefined>;
  onListo: () => void;
  onCancelar: () => void;
}) {
  const [nombre, setNombre] = useState(inicial?.nombre ?? '');
  const [condiciones, setCondiciones] = useState(inicial?.condiciones_comerciales ?? '');
  const [leyenda, setLeyenda] = useState(inicial?.leyenda_pie ?? '');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div>
        <label className="label">Nombre de la plantilla</label>
        <input className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Estándar, Proyectos grandes…" />
      </div>
      <div>
        <label className="label">Condiciones comerciales</label>
        <p className="mb-1 text-xs text-slate-400">Una condición por línea — se numeran automáticamente al imprimir.</p>
        <textarea className="input min-h-[120px] font-mono text-xs" value={condiciones} onChange={(e) => setCondiciones(e.target.value)} />
      </div>
      <div>
        <label className="label">Leyenda de pie de página</label>
        <textarea className="input min-h-[80px]" value={leyenda} onChange={(e) => setLeyenda(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <button disabled={guardando} className="btn btn-primary" onClick={async () => {
          setError(null); setGuardando(true);
          const r = await onGuardar({ nombre, condiciones_comerciales: condiciones, leyenda_pie: leyenda });
          setGuardando(false);
          if (r?.error) setError(r.error); else onListo();
        }}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
        <button className="btn btn-ghost" onClick={onCancelar}>Cancelar</button>
      </div>
    </div>
  );
}
