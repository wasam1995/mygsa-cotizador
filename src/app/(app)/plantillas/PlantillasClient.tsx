'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { activarDesactivarPlantilla, actualizarPlantilla, crearPlantilla, marcarPredeterminada, type PlantillaPayload } from './actions';
import PrintQuote from '@/components/PrintQuote';
import PdfPreview from '@/components/PdfPreview';
import { crearCotizacionDemo } from '@/lib/pdf/demo';
import type { ApartadoPlantilla, ParametrosFiscales, PlantillaCotizacion } from '@/lib/types';

export default function PlantillasClient({ plantillas, parametros }: { plantillas: PlantillaCotizacion[]; parametros: ParametrosFiscales }) {
  const router = useRouter();
  const [mostrarNueva, setMostrarNueva] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <button className="btn btn-orange" onClick={() => setMostrarNueva(true)}>+ Nueva plantilla</button>

      {mostrarNueva && (
        <FormularioPlantilla
          parametros={parametros}
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
                  parametros={parametros}
                  onGuardar={async (datos) => actualizarPlantilla(p.id, datos)}
                  onListo={() => { setEditando(null); router.refresh(); }}
                  onCancelar={() => setEditando(null)}
                />
              </div>
            ) : (
              <div className="mt-2 text-xs text-slate-500">
                {p.texto_institucional && <p className="mb-1 italic">{p.texto_institucional}</p>}
                <p className="whitespace-pre-line">{p.condiciones_comerciales}</p>
                {p.apartados.length > 0 && (
                  <p className="mt-1 text-slate-400">+ {p.apartados.length} apartado{p.apartados.length === 1 ? '' : 's'} adicional{p.apartados.length === 1 ? '' : 'es'}</p>
                )}
              </div>
            )}
          </div>
        ))}
        {plantillas.length === 0 && <p className="text-sm text-slate-400">Sin plantillas todavía.</p>}
      </div>
    </div>
  );
}

const VACIA: PlantillaPayload = {
  nombre: '', condiciones_comerciales: '', leyenda_pie: '', texto_institucional: '',
  titulo_tabla_items: 'DETALLE DE PRODUCTOS Y SERVICIOS',
  texto_firma_emisor: 'Autorizado por (Asesor)', texto_firma_cliente: 'Aceptado por (Cliente / Fecha)',
  apartados: [],
};

// Datos de muestra reutilizados en cada vista previa — se calculan una sola vez (no
// cambian mientras se edita el texto de la plantilla).
const DEMO = crearCotizacionDemo();

function FormularioPlantilla({
  inicial, parametros, onGuardar, onListo, onCancelar,
}: {
  inicial?: PlantillaCotizacion;
  parametros: ParametrosFiscales;
  onGuardar: (datos: PlantillaPayload) => Promise<{ error?: string } | undefined>;
  onListo: () => void;
  onCancelar: () => void;
}) {
  const [datos, setDatos] = useState<PlantillaPayload>(inicial ? {
    nombre: inicial.nombre,
    condiciones_comerciales: inicial.condiciones_comerciales,
    leyenda_pie: inicial.leyenda_pie,
    texto_institucional: inicial.texto_institucional,
    titulo_tabla_items: inicial.titulo_tabla_items,
    texto_firma_emisor: inicial.texto_firma_emisor,
    texto_firma_cliente: inicial.texto_firma_cliente,
    apartados: inicial.apartados,
  } : VACIA);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  // La vista previa (PDF real, editor visual) se actualiza con un pequeño retraso
  // mientras se escribe en vez de en cada tecla — regenerar el PDF completo en cada
  // pulsación se siente entrecortado; 400ms es suficiente para que se sienta "en vivo"
  // sin recalcular de más.
  const [datosPreview, setDatosPreview] = useState(datos);
  useEffect(() => {
    const t = setTimeout(() => setDatosPreview(datos), 400);
    return () => clearTimeout(t);
  }, [datos]);

  function set<K extends keyof PlantillaPayload>(key: K, value: PlantillaPayload[K]) {
    setDatos((d) => ({ ...d, [key]: value }));
  }

  function agregarApartado() {
    set('apartados', [...datos.apartados, { titulo: '', contenido: '' }]);
  }

  function actualizarApartado(idx: number, patch: Partial<ApartadoPlantilla>) {
    set('apartados', datos.apartados.map((a, i) => (i === idx ? { ...a, ...patch } : a)));
  }

  function eliminarApartado(idx: number) {
    set('apartados', datos.apartados.filter((_, i) => i !== idx));
  }

  const plantillaPreview: PlantillaCotizacion = {
    id: inicial?.id ?? 'preview',
    es_predeterminada: inicial?.es_predeterminada ?? false,
    activo: true,
    ...datosPreview,
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div>
          <label className="label">Nombre de la plantilla</label>
          <input className="input" value={datos.nombre} onChange={(e) => set('nombre', e.target.value)} placeholder="Ej. Estándar, Proyectos grandes…" />
        </div>
        <div>
          <label className="label">Texto institucional de presentación</label>
          <p className="mb-1 text-xs text-slate-400">Se imprime en el cuadro con borde naranja, antes de la tabla de productos. Opcional.</p>
          <textarea className="input min-h-[70px]" value={datos.texto_institucional} onChange={(e) => set('texto_institucional', e.target.value)} />
        </div>
        <div>
          <label className="label">Título de la tabla de ítems</label>
          <input className="input" value={datos.titulo_tabla_items} onChange={(e) => set('titulo_tabla_items', e.target.value)} />
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="label !mb-0">Apartados adicionales</label>
            <button type="button" onClick={agregarApartado} className="text-xs font-semibold text-navy-600 hover:underline">+ Agregar apartado</button>
          </div>
          <p className="mb-1 text-xs text-slate-400">Bloques de título + texto libre que se imprimen antes de las condiciones comerciales (alcance del proyecto, garantía, forma de pago, etc.).</p>
          <div className="space-y-2">
            {datos.apartados.map((a, idx) => (
              <div key={idx} className="rounded-lg border border-slate-200 bg-white p-2">
                <div className="mb-1 flex items-center gap-2">
                  <input className="input flex-1" placeholder="Título del apartado" value={a.titulo} onChange={(e) => actualizarApartado(idx, { titulo: e.target.value })} />
                  <button type="button" onClick={() => eliminarApartado(idx)} className="text-slate-400 hover:text-red-600">✕</button>
                </div>
                <textarea className="input min-h-[60px] text-xs" placeholder="Contenido" value={a.contenido} onChange={(e) => actualizarApartado(idx, { contenido: e.target.value })} />
              </div>
            ))}
          </div>
        </div>
        <div>
          <label className="label">Condiciones comerciales</label>
          <p className="mb-1 text-xs text-slate-400">Una condición por línea — se numeran automáticamente al imprimir.</p>
          <textarea className="input min-h-[120px] font-mono text-xs" value={datos.condiciones_comerciales} onChange={(e) => set('condiciones_comerciales', e.target.value)} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Texto de firma — emisor</label>
            <input className="input" value={datos.texto_firma_emisor} onChange={(e) => set('texto_firma_emisor', e.target.value)} />
          </div>
          <div>
            <label className="label">Texto de firma — cliente</label>
            <input className="input" value={datos.texto_firma_cliente} onChange={(e) => set('texto_firma_cliente', e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label">Leyenda de pie de página</label>
          <textarea className="input min-h-[80px]" value={datos.leyenda_pie} onChange={(e) => set('leyenda_pie', e.target.value)} />
        </div>
        <div className="flex gap-2">
          <button disabled={guardando} className="btn btn-primary" onClick={async () => {
            setError(null); setGuardando(true);
            const r = await onGuardar(datos);
            setGuardando(false);
            if (r?.error) setError(r.error); else onListo();
          }}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
          <button className="btn btn-ghost" onClick={onCancelar}>Cancelar</button>
        </div>
      </div>

      {/* Editor visual: vista previa en vivo del PDF real (con datos de muestra) — se
          actualiza mientras se escribe, para ver de inmediato cómo queda cada cambio. */}
      <div className="flex flex-col">
        <p className="label !mb-1">Vista previa en vivo (con datos de muestra)</p>
        <div className="h-[75vh] overflow-hidden rounded-lg border border-slate-200 bg-white">
          <PdfPreview>
            <PrintQuote
              cotizacion={DEMO.cotizacion}
              lineas={DEMO.lineas}
              parametros={parametros}
              plantilla={plantillaPreview}
              clienteNombre={DEMO.cotizacion.cliente_nombre_libre ?? '—'}
              clienteNit={DEMO.cotizacion.cliente_nit}
              clienteDireccion={DEMO.cotizacion.cliente_direccion}
              clienteContacto={null}
              vendedorNombre="Ana López"
              vendedorCorreo="ana.lopez@mygsa.com.gt"
            />
          </PdfPreview>
        </div>
      </div>
    </div>
  );
}
