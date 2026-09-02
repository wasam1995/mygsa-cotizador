'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { actualizarEscalaComision, actualizarParametros } from './actions';
import type { EscalaComision, ParametrosFiscales } from '@/lib/types';

export default function ParametrosClient({ parametros, escalasComision }: { parametros: ParametrosFiscales; escalasComision: EscalaComision[] }) {
  const router = useRouter();
  const [form, setForm] = useState<ParametrosFiscales>(parametros);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [escalas, setEscalas] = useState<EscalaComision[]>(escalasComision);
  const [guardandoEscalas, setGuardandoEscalas] = useState(false);

  function set<K extends keyof ParametrosFiscales>(key: K, value: ParametrosFiscales[K]) {
    setForm((f) => ({ ...f, [key]: value }));
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
        <h2 className="mb-3 text-sm font-bold text-slate-700">Impuestos (Guatemala)</h2>
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
        </div>
      </div>

      <div className="card">
        <h2 className="mb-3 text-sm font-bold text-slate-700">Cotizaciones</h2>
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
        <h2 className="mb-1 text-sm font-bold text-slate-700">Escala de comisiones sobre utilidad bruta</h2>
        <p className="mb-3 text-xs text-slate-400">
          El % de comisión del vendedor se calcula según en qué rango cae el % de margen de utilidad de cada cotización (utilidad ÷ venta total). Los porcentajes se escriben como fracción (ej. 0.09 = 9%).
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-400">
                <th className="py-2 pr-2">Rango</th>
                <th className="py-2 pr-2">Desde % margen</th>
                <th className="py-2 pr-2">Hasta % margen</th>
                <th className="py-2 pr-2">% Comisión</th>
                <th className="py-2 pr-2">Observación</th>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button disabled={guardandoEscalas} className="btn btn-secondary mt-3" onClick={guardarEscalas}>
          {guardandoEscalas ? 'Guardando…' : 'Guardar escala de comisiones'}
        </button>
      </div>

      <div className="card">
        <h2 className="mb-3 text-sm font-bold text-slate-700">Datos de la empresa</h2>
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
        <h2 className="mb-3 text-sm font-bold text-slate-700">Leyenda impresa en la cotización</h2>
        <textarea className="input min-h-[100px]" value={form.leyenda_cotizacion} onChange={(e) => set('leyenda_cotizacion', e.target.value)} />
      </div>

      <button disabled={guardando} className="btn btn-orange" onClick={guardar}>
        {guardando ? 'Guardando…' : 'Guardar parámetros'}
      </button>
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
