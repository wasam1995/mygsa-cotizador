'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProductPicker from './ProductPicker';
import { calcularCotizacion, numeroALetras } from '@/lib/fiscal';
import { formatQ, esTelefonoGuatemalaValido, normalizarTelefonoGuatemala } from '@/lib/utils';
import type { Cliente, ParametrosFiscales, Producto, Vendedor } from '@/lib/types';
import { crearCotizacion, type LineaPayload } from '@/app/(app)/cotizaciones/nueva/actions';

interface LineaEstado extends LineaPayload {
  key: string;
  stockDisponible: number | null;
}

let contadorKey = 0;
const nuevaKey = () => `L${Date.now()}_${contadorKey++}`;

export default function CotizadorForm({
  vendedores, clientes, productos, parametros, esVendedorFijo, vendedorInicial,
}: {
  vendedores: Vendedor[];
  clientes: Cliente[];
  productos: Producto[];
  parametros: ParametrosFiscales;
  esVendedorFijo: boolean;
  vendedorInicial: Vendedor | null;
}) {
  const router = useRouter();

  const [vendedorId, setVendedorId] = useState(vendedorInicial?.id ?? '');
  const [vendedorTelefono, setVendedorTelefono] = useState(vendedorInicial?.telefono ?? '');

  const [clienteModo, setClienteModo] = useState<'catalogo' | 'libre'>('catalogo');
  const [clienteId, setClienteId] = useState('');
  const [clienteLibreNombre, setClienteLibreNombre] = useState('Consumidor Final');
  const [clienteLibreNit, setClienteLibreNit] = useState('');
  const [clienteLibreDireccion, setClienteLibreDireccion] = useState('');
  const [clienteLibreTelefono, setClienteLibreTelefono] = useState('');
  const [clienteEsRetenedorIva, setClienteEsRetenedorIva] = useState(false);

  const [numeroSistemaExterno, setNumeroSistemaExterno] = useState('');
  const [comentario, setComentario] = useState('');
  const [descuentoGlobalPct, setDescuentoGlobalPct] = useState(0);
  const [descuentoGlobalMonto, setDescuentoGlobalMonto] = useState(0);

  const [lineas, setLineas] = useState<LineaEstado[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clienteSeleccionado = clientes.find((c) => c.id === clienteId) || null;

  function agregarDesdeCatalogo(p: Producto) {
    setLineas((prev) => [...prev, {
      key: nuevaKey(),
      producto_id: p.id,
      es_fuera_inventario: false,
      codigo_mostrado: p.codigo,
      descripcion: p.nombre + (p.color_variante ? ` (${p.color_variante})` : ''),
      cantidad: 1,
      costo_unitario: Number(p.costo_unitario),
      precio_unitario: Number(p.precio_lista),
      descuento_linea_pct: 0,
      descuento_linea_monto: 0,
      stockDisponible: p.stock_actual - p.stock_reservado,
    }]);
  }

  function agregarFueraInventario() {
    setLineas((prev) => [...prev, {
      key: nuevaKey(),
      producto_id: null,
      es_fuera_inventario: true,
      codigo_mostrado: 'LIBRE',
      descripcion: '',
      cantidad: 1,
      costo_unitario: 0,
      precio_unitario: 0,
      descuento_linea_pct: 0,
      descuento_linea_monto: 0,
      stockDisponible: null,
    }]);
  }

  function actualizarLinea(key: string, patch: Partial<LineaEstado>) {
    setLineas((prev) => prev.map((l) => {
      if (l.key !== key) return l;
      const actualizada = { ...l, ...patch };
      // el % de descuento de línea recalcula el monto automáticamente
      if (patch.descuento_linea_pct !== undefined) {
        actualizada.descuento_linea_monto = round2(actualizada.cantidad * actualizada.precio_unitario * (patch.descuento_linea_pct / 100));
      }
      return actualizada;
    }));
  }

  function eliminarLinea(key: string) {
    setLineas((prev) => prev.filter((l) => l.key !== key));
  }

  const calculo = useMemo(() => calcularCotizacion(lineas, {
    descuentoGlobalPct, descuentoGlobalMonto, clienteEsRetenedorIva, parametros,
  }), [lineas, descuentoGlobalPct, descuentoGlobalMonto, clienteEsRetenedorIva, parametros]);

  const totalEnLetras = numeroALetras(calculo.totalCotizado);

  async function guardar(finalizando: boolean) {
    setError(null);
    if (!vendedorId) { setError('Seleccione un vendedor.'); return; }
    if (lineas.length === 0) { setError('Agregue al menos un producto o servicio.'); return; }
    if (clienteModo === 'catalogo' && !clienteId) { setError('Seleccione un cliente o cambie a "Cliente no catalogado".'); return; }
    if (finalizando && !numeroSistemaExterno.trim()) {
      setError('Para finalizar debe capturar el número de cotización del sistema (ERP). Puede "Guardar borrador" sin este dato.');
      return;
    }
    if (vendedorTelefono && !esTelefonoGuatemalaValido(normalizarTelefonoGuatemala(vendedorTelefono))) {
      setError('El teléfono del vendedor debe tener el formato +502 y 8 dígitos.');
      return;
    }

    setGuardando(true);
    const resultado = await crearCotizacion({
      vendedor_id: vendedorId,
      vendedor_telefono: vendedorTelefono ? normalizarTelefonoGuatemala(vendedorTelefono) : '',
      cliente_id: clienteModo === 'catalogo' ? clienteId : null,
      cliente_nombre_libre: clienteModo === 'libre' ? clienteLibreNombre : null,
      cliente_nit: clienteModo === 'libre' ? clienteLibreNit : null,
      cliente_direccion: clienteModo === 'libre' ? clienteLibreDireccion : null,
      cliente_telefono: clienteModo === 'libre' ? clienteLibreTelefono : null,
      cliente_es_retenedor_iva: clienteEsRetenedorIva,
      descuento_global_pct: descuentoGlobalPct,
      descuento_global_monto: descuentoGlobalMonto,
      comentario: comentario || null,
      numero_sistema_externo: numeroSistemaExterno || null,
      lineas: lineas.map(({ key, stockDisponible, ...l }) => l),
    });
    setGuardando(false);
    if (resultado?.error) setError(resultado.error);
  }

  return (
    <div className="space-y-6 pb-24">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Encabezado */}
      <div className="card grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-sm font-bold text-slate-700">Datos de la cotización</h2>
          <div className="space-y-3">
            <div>
              <label className="label">No. de cotización del sistema (ERP)</label>
              <input className="input" value={numeroSistemaExterno} onChange={(e) => setNumeroSistemaExterno(e.target.value)}
                     placeholder="Ej. COT-2026-0048" />
              <p className="mt-1 text-xs text-slate-400">
                Puede guardar como borrador sin este dato; es obligatorio para finalizar/enviar al cliente.
              </p>
            </div>

            <div>
              <label className="label">Vendedor</label>
              {esVendedorFijo ? (
                <input className="input" disabled value={vendedorInicial?.nombre_completo ?? ''} />
              ) : (
                <select className="input" value={vendedorId} onChange={(e) => {
                  setVendedorId(e.target.value);
                  const v = vendedores.find((x) => x.id === e.target.value);
                  setVendedorTelefono(v?.telefono ?? '');
                }}>
                  <option value="">Seleccione…</option>
                  {vendedores.map((v) => (
                    <option key={v.id} value={v.id}>{v.codigo} — {v.nombre_completo}</option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="label">Teléfono del vendedor</label>
              <input className="input" value={vendedorTelefono} onChange={(e) => setVendedorTelefono(e.target.value)}
                     placeholder="+502 5555 5555" />
            </div>

            <div>
              <label className="label">Comentario / condiciones especiales</label>
              <textarea className="input" rows={2} value={comentario} onChange={(e) => setComentario(e.target.value)} />
            </div>
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-700">Datos del cliente</h2>
            <div className="flex rounded-lg bg-slate-100 p-1 text-xs font-semibold">
              <button type="button" onClick={() => setClienteModo('catalogo')}
                className={`rounded-md px-2.5 py-1 ${clienteModo === 'catalogo' ? 'bg-white shadow' : 'text-slate-500'}`}>
                Catálogo
              </button>
              <button type="button" onClick={() => setClienteModo('libre')}
                className={`rounded-md px-2.5 py-1 ${clienteModo === 'libre' ? 'bg-white shadow' : 'text-slate-500'}`}>
                No catalogado
              </button>
            </div>
          </div>

          {clienteModo === 'catalogo' ? (
            <div className="space-y-3">
              <select className="input" value={clienteId} onChange={(e) => {
                setClienteId(e.target.value);
                const c = clientes.find((x) => x.id === e.target.value);
                setClienteEsRetenedorIva(c?.es_retenedor_iva ?? false);
              }}>
                <option value="">Seleccione un cliente…</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>{c.codigo} — {c.nombre_razon}</option>
                ))}
              </select>
              {clienteSeleccionado && (
                <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                  <p><b>NIT:</b> {clienteSeleccionado.nit ?? '—'}</p>
                  <p><b>Dirección:</b> {clienteSeleccionado.direccion ?? '—'}</p>
                  <p><b>Contacto:</b> {clienteSeleccionado.contacto ?? '—'}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <input className="input" placeholder="Nombre / Razón social" value={clienteLibreNombre}
                     onChange={(e) => setClienteLibreNombre(e.target.value)} />
              <div className="grid grid-cols-2 gap-3">
                <input className="input" placeholder="NIT (o CF)" value={clienteLibreNit} onChange={(e) => setClienteLibreNit(e.target.value)} />
                <input className="input" placeholder="Teléfono" value={clienteLibreTelefono} onChange={(e) => setClienteLibreTelefono(e.target.value)} />
              </div>
              <input className="input" placeholder="Dirección" value={clienteLibreDireccion} onChange={(e) => setClienteLibreDireccion(e.target.value)} />
            </div>
          )}

          <label className="mt-3 flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={clienteEsRetenedorIva} onChange={(e) => setClienteEsRetenedorIva(e.target.checked)}
                   className="h-4 w-4 rounded border-slate-300 text-navy-700" />
            El cliente es agente retenedor de IVA (aplica retención del 12% sobre el IVA)
          </label>
        </div>
      </div>

      {/* Productos */}
      <div className="card">
        <h2 className="mb-3 text-sm font-bold text-slate-700">Productos y servicios</h2>
        <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
          <ProductPicker productos={productos} onSeleccionar={agregarDesdeCatalogo} />
          <button type="button" onClick={agregarFueraInventario} className="btn btn-secondary whitespace-nowrap">
            + Agregar fuera de inventario
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-400">
                <th className="py-2 pr-2">Código</th>
                <th className="py-2 pr-2">Descripción</th>
                <th className="py-2 pr-2 w-20">Cant.</th>
                <th className="py-2 pr-2 w-24">Costo U.</th>
                <th className="py-2 pr-2 w-28">Precio U.</th>
                <th className="py-2 pr-2 w-20">Desc. %</th>
                <th className="py-2 pr-2 w-28">Subtotal</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {lineas.map((l) => {
                const subtotalLinea = round2(l.cantidad * l.precio_unitario - l.descuento_linea_monto);
                const excedeStock = l.stockDisponible !== null && l.cantidad > l.stockDisponible;
                return (
                  <tr key={l.key} className="border-b border-slate-100 align-top last:border-0">
                    <td className="py-2 pr-2">
                      {l.es_fuera_inventario ? (
                        <span className="inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700">LIBRE</span>
                      ) : (
                        <span className="font-mono text-xs text-slate-500">{l.codigo_mostrado}</span>
                      )}
                    </td>
                    <td className="py-2 pr-2 min-w-[220px]">
                      {l.es_fuera_inventario ? (
                        <input className="input" value={l.descripcion}
                               onChange={(e) => actualizarLinea(l.key, { descripcion: e.target.value })}
                               placeholder="Describa el producto/servicio" />
                      ) : (
                        <span className="text-slate-700">{l.descripcion}</span>
                      )}
                      {excedeStock && <p className="mt-1 text-[11px] text-red-600">Excede el disponible ({l.stockDisponible} u.)</p>}
                    </td>
                    <td className="py-2 pr-2">
                      <input type="number" min={0} step="0.01" className="input" value={l.cantidad}
                             onChange={(e) => actualizarLinea(l.key, { cantidad: Number(e.target.value) })} />
                    </td>
                    <td className="py-2 pr-2">
                      <input type="number" min={0} step="0.01" className="input" value={l.costo_unitario}
                             disabled={!l.es_fuera_inventario}
                             onChange={(e) => actualizarLinea(l.key, { costo_unitario: Number(e.target.value) })} />
                    </td>
                    <td className="py-2 pr-2">
                      <input type="number" min={0} step="0.01" className="input" value={l.precio_unitario}
                             onChange={(e) => actualizarLinea(l.key, { precio_unitario: Number(e.target.value) })} />
                    </td>
                    <td className="py-2 pr-2">
                      <input type="number" min={0} max={100} step="0.01" className="input" value={l.descuento_linea_pct}
                             onChange={(e) => actualizarLinea(l.key, { descuento_linea_pct: Number(e.target.value) })} />
                    </td>
                    <td className="py-2 pr-2 font-semibold text-slate-700">{formatQ(subtotalLinea)}</td>
                    <td className="py-2 text-right">
                      <button type="button" onClick={() => eliminarLinea(l.key)} className="text-slate-400 hover:text-red-600">✕</button>
                    </td>
                  </tr>
                );
              })}
              {lineas.length === 0 && (
                <tr><td colSpan={8} className="py-8 text-center text-slate-400">Busque un producto del inventario o agregue uno fuera de inventario.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Descuentos y resumen fiscal */}
      <div className="card grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-sm font-bold text-slate-700">Descuento sobre el subtotal</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Descuento global (%)</label>
              <input type="number" min={0} max={100} step="0.01" className="input" value={descuentoGlobalPct}
                     onChange={(e) => { setDescuentoGlobalPct(Number(e.target.value)); setDescuentoGlobalMonto(0); }} />
            </div>
            <div>
              <label className="label">o monto fijo (Q)</label>
              <input type="number" min={0} step="0.01" className="input" value={descuentoGlobalMonto}
                     onChange={(e) => { setDescuentoGlobalMonto(Number(e.target.value)); setDescuentoGlobalPct(0); }} />
            </div>
          </div>
          {calculo.requiereAutorizacion && (
            <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              El descuento efectivo es de {calculo.porcentajeDescuentoEfectivo.toFixed(2)}%, mayor al{' '}
              {(parametros.descuento_umbral_autorizacion * 100).toFixed(0)}% permitido sin aprobación. Esta cotización
              quedará en estado <b>Pend. Autorizar</b> hasta que un Autorizador la apruebe.
            </div>
          )}
          <div className="mt-4 rounded-lg bg-navy-50 p-3 text-xs text-navy-800">
            <p className="font-semibold">Valor en letras</p>
            <p className="mt-1">{totalEnLetras}</p>
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-sm font-bold text-slate-700">Resumen fiscal (Guatemala)</h2>
          <dl className="space-y-1.5 text-sm">
            <Fila label="Subtotal" valor={calculo.subtotalBruto} />
            <Fila label="Descuentos (líneas + global)" valor={-calculo.totalDescuentos} />
            <Fila label="Base gravable (sin IVA)" valor={calculo.baseGravable} negrita />
            <Fila label="IVA (12%)" valor={calculo.ivaMonto} />
            <Fila label="Total cotizado" valor={calculo.totalCotizado} negrita grande />
            <hr className="my-2 border-slate-200" />
            <Fila label="Retención ISR" valor={-calculo.isrRetencion} tono="text-red-600" />
            <Fila label="Retención IVA (12% del IVA)" valor={-calculo.ivaRetencion} tono="text-red-600" />
            <Fila label="Pago neto a la empresa" valor={calculo.pagoNetoEmpresa} negrita tono="text-emerald-700" />
          </dl>
        </div>
      </div>

      <div className="sticky bottom-0 -mx-4 flex flex-col gap-2 border-t border-slate-200 bg-white/95 p-4 backdrop-blur sm:flex-row sm:justify-end lg:-mx-8 lg:px-8">
        <button type="button" onClick={() => router.push('/cotizaciones')} className="btn btn-ghost">Cancelar</button>
        <button type="button" disabled={guardando} onClick={() => guardar(false)} className="btn btn-secondary">
          Guardar borrador
        </button>
        <button type="button" disabled={guardando} onClick={() => guardar(true)} className="btn btn-orange">
          {guardando ? 'Guardando…' : 'Guardar y continuar'}
        </button>
      </div>
    </div>
  );
}

function Fila({ label, valor, negrita, grande, tono }: { label: string; valor: number; negrita?: boolean; grande?: boolean; tono?: string }) {
  return (
    <div className={`flex justify-between ${negrita ? 'font-bold text-slate-800' : 'text-slate-600'} ${grande ? 'text-base' : ''} ${tono ?? ''}`}>
      <dt>{label}</dt>
      <dd>{formatQ(valor)}</dd>
    </div>
  );
}

function round2(n: number) { return Math.round((n + Number.EPSILON) * 100) / 100; }
