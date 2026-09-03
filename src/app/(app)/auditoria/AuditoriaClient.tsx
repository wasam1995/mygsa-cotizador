'use client';

import { Fragment, useState } from 'react';
import { formatFecha } from '@/lib/utils';
import type { AuditoriaRegistro } from '@/lib/types';

const ACCION_LABEL: Record<string, string> = { INSERT: 'Creación', UPDATE: 'Modificación', DELETE: 'Eliminación' };
const ACCION_COLOR: Record<string, string> = {
  INSERT: 'bg-emerald-100 text-emerald-700',
  UPDATE: 'bg-amber-100 text-amber-700',
  DELETE: 'bg-red-100 text-red-700',
};

// Campos de "carpintería" que no aportan nada al ver qué cambió.
const CAMPOS_OMITIDOS = new Set(['id', 'creado_en', 'actualizado_en']);

function formatValor(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? 'Sí' : 'No';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function calcularDiferencias(anteriores: Record<string, unknown> | null, nuevos: Record<string, unknown> | null) {
  const claves = new Set([...Object.keys(anteriores ?? {}), ...Object.keys(nuevos ?? {})]);
  const filas: { campo: string; antes: unknown; despues: unknown }[] = [];
  for (const campo of claves) {
    if (CAMPOS_OMITIDOS.has(campo)) continue;
    const antes = anteriores?.[campo];
    const despues = nuevos?.[campo];
    if (anteriores && nuevos) {
      // UPDATE: solo mostrar lo que cambió
      if (JSON.stringify(antes) === JSON.stringify(despues)) continue;
    }
    filas.push({ campo, antes, despues });
  }
  return filas.sort((a, b) => a.campo.localeCompare(b.campo));
}

export default function AuditoriaClient({ registros }: { registros: AuditoriaRegistro[] }) {
  const [abierto, setAbierto] = useState<number | null>(null);

  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[820px] text-sm">
        <thead>
          <tr className="table-head-row">
            <th className="py-2 pr-2">Fecha</th><th className="py-2 pr-2">Tabla</th>
            <th className="py-2 pr-2">Acción</th><th className="py-2 pr-2">Usuario</th>
            <th className="py-2 pr-2">Registro</th><th className="py-2 pr-2"></th>
          </tr>
        </thead>
        <tbody>
          {registros.map((r) => {
            const abiertoAqui = abierto === r.id;
            const diffs = calcularDiferencias(r.datos_anteriores, r.datos_nuevos);
            return (
              <Fragment key={r.id}>
                <tr className="table-row-hover">
                  <td className="py-2 pr-2 text-slate-500">{formatFecha(r.creado_en)}</td>
                  <td className="py-2 pr-2 font-mono text-xs">{r.tabla}</td>
                  <td className="py-2 pr-2"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${ACCION_COLOR[r.accion]}`}>{ACCION_LABEL[r.accion] ?? r.accion}</span></td>
                  <td className="py-2 pr-2">{r.usuario_nombre ?? '—'}</td>
                  <td className="py-2 pr-2 font-mono text-xs text-slate-400">{r.registro_id ? r.registro_id.slice(0, 8) : '—'}</td>
                  <td className="py-2 pr-2 text-right">
                    <button className="text-xs font-semibold text-navy-600 hover:underline" onClick={() => setAbierto(abiertoAqui ? null : r.id)}>
                      {abiertoAqui ? 'Ocultar' : 'Ver detalle'}
                    </button>
                  </td>
                </tr>
                {abiertoAqui && (
                  <tr className="bg-slate-50">
                    <td colSpan={6} className="p-3">
                      {diffs.length === 0 ? (
                        <p className="text-xs text-slate-400">Sin cambios de campos para mostrar.</p>
                      ) : (
                        <table className="w-full max-w-2xl text-xs">
                          <thead>
                            <tr className="text-left uppercase text-slate-400">
                              <th className="py-1 pr-2">Campo</th>
                              {r.datos_anteriores && <th className="py-1 pr-2">Antes</th>}
                              {r.datos_nuevos && <th className="py-1 pr-2">Después</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {diffs.map((d) => (
                              <tr key={d.campo} className="border-t border-slate-200">
                                <td className="py-1 pr-2 font-mono text-slate-500">{d.campo}</td>
                                {r.datos_anteriores && <td className="py-1 pr-2 text-red-600">{formatValor(d.antes)}</td>}
                                {r.datos_nuevos && <td className="py-1 pr-2 text-emerald-700">{formatValor(d.despues)}</td>}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
          {registros.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-slate-400">Sin registros de auditoría para estos filtros.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
