'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { actualizarParametros } from './actions';
import type { ParametrosFiscales } from '@/lib/types';

export default function ParametrosClient({ parametros }: { parametros: ParametrosFiscales }) {
  const router = useRouter();
  const [form, setForm] = useState<ParametrosFiscales>(parametros);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof ParametrosFiscales>(key: K, value: ParametrosFiscales[K]) {
    setForm((f) => ({ ...f, [key]: value }));
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
        </div>
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
