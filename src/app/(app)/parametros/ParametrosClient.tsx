'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { actualizarEscalaComision, actualizarParametros, crearEscalaComision, eliminarEscalaComision } from './actions';
import PrintQuote from '@/components/PrintQuote';
import PdfPreview from '@/components/PdfPreview';
import { crearCotizacionDemo } from '@/lib/pdf/demo';
import type { EscalaComision, ParametrosFiscales } from '@/lib/types';

// Datos de muestra para la vista previa en vivo (ver también Plantillas → editor visual).
const DEMO = crearCotizacionDemo();

export default function ParametrosClient({ parametros, escalasComision }: { parametros: ParametrosFiscales; escalasComision: EscalaComision[] }) {
  const router = useRouter();
  const [form, setForm] = useState<ParametrosFiscales>(parametros);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [subiendoLogo, setSubiendoLogo] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);

  const [escalas, setEscalas] = useState<EscalaComision[]>(escalasComision);
  const [guardandoEscalas, setGuardandoEscalas] = useState(false);
  const [agregandoEscala, setAgregandoEscala] = useState(false);
  const [eliminandoEscala, setEliminandoEscala] = useState<number | null>(null);

  function set<K extends keyof ParametrosFiscales>(key: K, value: ParametrosFiscales[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // Igual que en el editor visual de Plantillas: la vista previa se actualiza con un
  // pequeño retraso en vez de en cada tecla/cambio de color, para que no se sienta
  // entrecortada al regenerar el PDF completo.
  const [formPreview, setFormPreview] = useState(form);
  useEffect(() => {
    const t = setTimeout(() => setFormPreview(form), 400);
    return () => clearTimeout(t);
  }, [form]);

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    setError(null);
    setSubiendoLogo(true);
    try {
      const supabase = createClient();
      const ext = archivo.name.split('.').pop() || 'png';
      const ruta = `logo_${Date.now()}.${ext}`;
      const { error: errSubida } = await supabase.storage.from('logos').upload(ruta, archivo, {
        upsert: true,
        contentType: archivo.type || undefined,
      });
      if (errSubida) throw errSubida;
      const { data } = supabase.storage.from('logos').getPublicUrl(ruta);
      set('logo_url', data.publicUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo subir el logotipo.');
    } finally {
      setSubiendoLogo(false);
      if (logoRef.current) logoRef.current.value = '';
    }
  }

  function setEscala(rango: number, patch: Partial<EscalaComision>) {
    setEscalas((prev) => prev.map((e) => (e.rango === rango ? { ...e, ...patch } : e)));
  }

  async function guardar() {
    setGuardando(true);
    setMensaje(null);
    setError(null);
    const { id, ...payload } = form;
    const r = await actualizarParametros(payload);
    setGuardando(false);
    if (r?.error) setError(r.error);
    else { setMensaje('Parámetros actualizados correctamente.'); router.refresh(); }
  }

  async function agregarEscala() {
    setAgregandoEscala(true);
    setError(null);
    const r = await crearEscalaComision();
    setAgregandoEscala(false);
    if (r?.error) setError(r.error); else router.refresh();
  }

  async function eliminarEscala(rango: number) {
    setEliminandoEscala(rango);
    setError(null);
    const r = await eliminarEscalaComision(rango);
    setEliminandoEscala(null);
    if (r?.error) setError(r.error); else router.refresh();
  }

  async function guardarEscalas() {
    setGuardandoEscalas(true);
    setMensaje(null);
    setError(null);
    for (const e of escalas) {
      const r = await actualizarEscalaComision(e.rango, {
        desde_pct: e.desde_pct, hasta_pct: e.hasta_pct, porcentaje_comision: e.porcentaje_comision, observacion: e.observacion,
      });
      if (r?.error) { setError(r.error); setGuardandoEscalas(false); return; }
    }
    setGuardandoEscalas(false);
    setMensaje('Escala de comisiones actualizada correctamente.');
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-red-600">{error}</p>}
      {mensaje && <p className="text-sm text-emerald-600">{mensaje}</p>}

      <div className="card">
        <h2 className="mb-3 section-title">Impuestos (Guatemala)</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Campo label="IVA (%)" hint="Ej. 0.12 = 12%">
            <input type="number" step="0.001" className="input" value={form.iva_porcentaje} onChange={(e) => set('iva_porcentaje', Number(e.target.value))} />
          </Campo>
          <Campo label="Límite tramo 1 de ISR (Q)" hint="Base sin IVA">
            <input type="number" step="0.01" className="input" value={form.isr_tramo1_limite} onChange={(e) => set('isr_tramo1_limite', Number(e.target.value))} />
          </Campo>
          <Campo label="ISR tramo 1 (%)" hint="Sobre base de 0 al límite">
            <input type="number" step="0.001" className="input" value={form.isr_tramo1_porcentaje} onChange={(e) => set('isr_tramo1_porcentaje', Number(e.target.value))} />
          </Campo>
          <Campo label="ISR tramo 2 (%)" hint="Sobre el excedente del límite">
            <input type="number" step="0.001" className="input" value={form.isr_tramo2_porcentaje} onChange={(e) => set('isr_tramo2_porcentaje', Number(e.target.value))} />
          </Campo>
          <Campo label="ISR tramo 2 — fijo (Q)" hint="Monto fijo adicional del tramo 2">
            <input type="number" step="0.01" className="input" value={form.isr_tramo2_fijo} onChange={(e) => set('isr_tramo2_fijo', Number(e.target.value))} />
          </Campo>
          <Campo label="Empresa es retenedora de IVA">
            <select className="input" value={form.empresa_es_retenedor_iva ? '1' : '0'} onChange={(e) => set('empresa_es_retenedor_iva', e.target.value === '1')}>
              <option value="1">Sí — aplica retención de IVA a clientes retenedores</option>
              <option value="0">No — nunca se calcula retención de IVA</option>
            </select>
          </Campo>
          <Campo label="Retención de IVA (%)" hint="Se aplica SOBRE EL MONTO DE IVA (no sobre el total) cuando el cliente es agente retenedor. Ej. 0.15 = 15%">
            <input type="number" step="0.001" className="input" value={form.retencion_iva_porcentaje} onChange={(e) => set('retencion_iva_porcentaje', Number(e.target.value))} />
          </Campo>
        </div>
      </div>

      <div className="card">
        <h2 className="mb-3 section-title">Cotizaciones</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Campo label="Vigencia de cotización (días)">
            <input type="number" step="1" className="input" value={form.vigencia_dias} onChange={(e) => set('vigencia_dias', Number(e.target.value))} />
          </Campo>
          <Campo label="Umbral de descuento que requiere autorización (%)" hint="Ej. 0.05 = 5%">
            <input type="number" step="0.001" className="input" value={form.descuento_umbral_autorizacion} onChange={(e) => set('descuento_umbral_autorizacion', Number(e.target.value))} />
          </Campo>
          <Campo label="Margen sugerido por defecto (%)" hint="Se usa al agregar una línea en modo 'Costo + margen %'. Ej. 0.45 = 45%">
            <input type="number" step="0.001" className="input" value={form.margen_sugerido_defecto} onChange={(e) => set('margen_sugerido_defecto', Number(e.target.value))} />
          </Campo>
        </div>
      </div>

      <div className="card">
        <h2 className="mb-1 section-title">Escala de comisiones sobre utilidad bruta</h2>
        <p className="mb-3 text-xs text-slate-400">
          El % de comisión del vendedor se calcula según en qué rango cae el % de margen de utilidad de cada cotización (utilidad ÷ venta total). Los porcentajes se escriben como fracción (ej. 0.09 = 9%).
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="table-head-row">
                <th className="py-2 pr-2">Rango</th>
                <th className="py-2 pr-2">Desde % margen</th>
                <th className="py-2 pr-2">Hasta % margen</th>
                <th className="py-2 pr-2">% Comisión</th>
                <th className="py-2 pr-2">Observación</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {escalas.map((e) => (
                <tr key={e.rango} className="border-b border-slate-100 last:border-0">
                  <td className="py-2 pr-2 font-semibold">{e.rango}</td>
                  <td className="py-2 pr-2">
                    <input type="number" step="0.0001" className="input" value={e.desde_pct}
                           onChange={(ev) => setEscala(e.rango, { desde_pct: Number(ev.target.value) })} />
                  </td>
                  <td className="py-2 pr-2">
                    <input type="number" step="0.0001" className="input" value={e.hasta_pct ?? ''} placeholder="En adelante"
                           onChange={(ev) => setEscala(e.rango, { hasta_pct: ev.target.value === '' ? null : Number(ev.target.value) })} />
                  </td>
                  <td className="py-2 pr-2">
                    <input type="number" step="0.0001" className="input" value={e.porcentaje_comision}
                           onChange={(ev) => setEscala(e.rango, { porcentaje_comision: Number(ev.target.value) })} />
                  </td>
                  <td className="py-2 pr-2">
                    <input className="input" value={e.observacion ?? ''} onChange={(ev) => setEscala(e.rango, { observacion: ev.target.value })} />
                  </td>
                  <td className="py-2 text-right">
                    <button type="button" disabled={eliminandoEscala === e.rango} title="Eliminar este rango"
                            onClick={() => eliminarEscala(e.rango)} className="text-slate-400 hover:text-red-600">
                      {eliminandoEscala === e.rango ? '…' : '✕'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex gap-2">
          <button disabled={guardandoEscalas} className="btn btn-secondary" onClick={guardarEscalas}>
            {guardandoEscalas ? 'Guardando…' : 'Guardar escala de comisiones'}
          </button>
          <button type="button" disabled={agregandoEscala} className="btn btn-ghost" onClick={agregarEscala}>
            {agregandoEscala ? 'Agregando…' : '+ Agregar rango'}
          </button>
        </div>
      </div>

      <div className="card">
        <h2 className="mb-3 section-title">Datos de la empresa</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Campo label="Razón social">
            <input className="input" value={form.razon_social} onChange={(e) => set('razon_social', e.target.value)} />
          </Campo>
          <Campo label="Nombre comercial">
            <input className="input" value={form.nombre_comercial} onChange={(e) => set('nombre_comercial', e.target.value)} />
          </Campo>
          <Campo label="NIT">
            <input className="input" value={form.nit_empresa ?? ''} onChange={(e) => set('nit_empresa', e.target.value)} />
          </Campo>
          <Campo label="Teléfono">
            <input className="input" value={form.telefono_empresa ?? ''} onChange={(e) => set('telefono_empresa', e.target.value)} />
          </Campo>
          <Campo label="Dirección" full>
            <input className="input" value={form.direccion_empresa ?? ''} onChange={(e) => set('direccion_empresa', e.target.value)} />
          </Campo>
          <Campo label="Correo">
            <input className="input" value={form.correo_empresa ?? ''} onChange={(e) => set('correo_empresa', e.target.value)} />
          </Campo>
        </div>
      </div>

      <div className="card">
        <h2 className="mb-3 section-title">Leyenda impresa en la cotización</h2>
        <p className="mb-2 text-xs text-slate-400">
          Se usa como respaldo solo cuando la cotización no tiene una plantilla asignada. Para la leyenda y las condiciones comerciales que se imprimen normalmente, use el módulo <b>Plantillas</b>.
        </p>
        <textarea className="input min-h-[100px]" value={form.leyenda_cotizacion} onChange={(e) => set('leyenda_cotizacion', e.target.value)} />
      </div>

      <div className="card">
        <h2 className="mb-1 section-title">Personalización visual</h2>
        <p className="mb-3 text-xs text-slate-400">
          Logotipo y colores corporativos usados en las cotizaciones impresas / PDF (versión cliente e interna). Editor visual:
          los cambios se reflejan en la vista previa de la derecha con datos de muestra.
        </p>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div>
            <div className="mb-4 flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                {form.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.logo_url} alt="Logotipo" className="h-full w-full object-contain" />
                ) : (
                  <span className="text-xs text-slate-400">Sin logo</span>
                )}
              </div>
              <div>
                <input ref={logoRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={handleLogoChange} className="input" disabled={subiendoLogo} />
                <p className="mt-1 text-xs text-slate-400">{subiendoLogo ? 'Subiendo…' : 'PNG, JPG, SVG o WEBP. Fondo transparente recomendado.'}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <ColorCampo label="Primario" hint="Títulos, cabeceras" value={form.color_primario} onChange={(v) => set('color_primario', v)} />
              <ColorCampo label="Acento" hint="Bordes destacados, tabla" value={form.color_acento} onChange={(v) => set('color_acento', v)} />
              <ColorCampo label="Acento oscuro" hint="Totales, llamadas de atención" value={form.color_acento_oscuro} onChange={(v) => set('color_acento_oscuro', v)} />
              <ColorCampo label="Fondo general" hint="Bloques de datos" value={form.color_fondo} onChange={(v) => set('color_fondo', v)} />
              <ColorCampo label="Fondo alterno" hint="Totales / alertas" value={form.color_fondo_alterno} onChange={(v) => set('color_fondo_alterno', v)} />
              <ColorCampo label="Bordes" hint="Líneas divisorias" value={form.color_borde} onChange={(v) => set('color_borde', v)} />
            </div>
            <p className="mt-3 text-xs text-slate-400">
              La tipografía del PDF ya no es configurable: desde la Etapa 7 los documentos se generan como PDF vectorial real
              (texto seleccionable, archivo más liviano) con una fuente estándar incluida en cualquier lector — así ningún PDF
              depende de descargar una fuente al generarse.
            </p>
          </div>

          <div className="flex flex-col">
            <p className="label !mb-1">Vista previa en vivo (con datos de muestra)</p>
            <div className="h-[75vh] overflow-hidden rounded-lg border border-slate-200 bg-white">
              <PdfPreview>
                <PrintQuote
                  cotizacion={DEMO.cotizacion}
                  lineas={DEMO.lineas}
                  parametros={formPreview}
                  plantilla={null}
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
      </div>

      <button disabled={guardando} className="btn btn-orange" onClick={guardar}>
        {guardando ? 'Guardando…' : 'Guardar parámetros'}
      </button>
    </div>
  );
}

function ColorCampo({ label, hint, value, onChange }: { label: string; hint?: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex items-center gap-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-12 cursor-pointer rounded border border-slate-200 p-0.5" />
        <input className="input" value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
      {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

function Campo({ label, hint, full, children }: { label: string; hint?: string; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={full ? 'sm:col-span-2' : ''}>
      <label className="label">{label}</label>
      {children}
      {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}
