'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProductPicker from './ProductPicker';
import { calcularCotizacion, distribuirCostosOperativosPorLinea, numeroALetras, precioPorMargen } from '@/lib/fiscal';
import { formatQ, esTelefonoGuatemalaValido, normalizarTelefonoGuatemala } from '@/lib/utils';
import type { Cliente, Cotizacion, CotizacionCostoOperativo, CotizacionDetalle, EscalaComision, ModoPrecioLinea, ParametrosFiscales, PlantillaCotizacion, Producto, Vendedor } from '@/lib/types';
import { crearCotizacion, type CostoOperativoPayload, type LineaPayload } from '@/app/(app)/cotizaciones/nueva/actions';
import { actualizarCotizacionCompleta } from '@/app/(app)/cotizaciones/[id]/actions';

interface LineaEstado extends LineaPayload {
  key: string;
  stockDisponible: number | null;
}

interface CostoOperativoEstado extends CostoOperativoPayload {
  key: string;
}

let contadorKey = 0;
const nuevaKey = () => `L${Date.now()}_${contadorKey++}`;

const CONCEPTOS_SUGERIDOS = ['Hospedaje', 'Viáticos', 'Combustible', 'Mano de obra', 'Instalación'];

export default function CotizadorForm({
  vendedores, clientes, productos, parametros, escalasComision, plantillas, esVendedorFijo, vendedorInicial, cotizacionExistente,
}: {
  vendedores: Vendedor[];
  clientes: Cliente[];
  productos: Producto[];
  parametros: ParametrosFiscales;
  escalasComision: EscalaComision[];
  plantillas: PlantillaCotizacion[];
  esVendedorFijo: boolean;
  vendedorInicial: Vendedor | null;
  cotizacionExistente?: {
    cotizacion: Cotizacion;
    lineas: CotizacionDetalle[];
    costosOperativos: CotizacionCostoOperativo[];
  };
}) {
  const router = useRouter();
  const cotOriginal = cotizacionExistente?.cotizacion ?? null;
  const modoEdicion = !!cotOriginal;

  const [vendedorId, setVendedorId] = useState(cotOriginal?.vendedor_id ?? vendedorInicial?.id ?? '');
  const [vendedorTelefono, setVendedorTelefono] = useState(cotOriginal?.vendedor_telefono ?? vendedorInicial?.telefono ?? '');

  const [clienteModo, setClienteModo] = useState<'catalogo' | 'libre'>(cotOriginal?.cliente_id ? 'catalogo' : cotOriginal ? 'libre' : 'catalogo');
  const [clienteId, setClienteId] = useState(cotOriginal?.cliente_id ?? '');
  const [clienteLibreNombre, setClienteLibreNombre] = useState(cotOriginal?.cliente_nombre_libre ?? 'Consumidor Final');
  const [clienteLibreNit, setClienteLibreNit] = useState(cotOriginal?.cliente_nit ?? '');
  const [clienteLibreDireccion, setClienteLibreDireccion] = useState(cotOriginal?.cliente_direccion ?? '');
  const [clienteLibreTelefono, setClienteLibreTelefono] = useState(cotOriginal?.cliente_telefono ?? '');
  const [clienteEsRetenedorIva, setClienteEsRetenedorIva] = useState(cotOriginal?.cliente_es_retenedor_iva ?? false);

  const [numeroSistemaExterno, setNumeroSistemaExterno] = useState(cotOriginal?.numero_sistema_externo ?? '');
  const [plantillaId, setPlantillaId] = useState(
    cotOriginal?.plantilla_id ?? plantillas.find((p) => p.es_predeterminada)?.id ?? plantillas[0]?.id ?? ''
  );
  const [comentario, setComentario] = useState(cotOriginal?.comentario ?? '');
  const [descuentoGlobalPct, setDescuentoGlobalPct] = useState(cotOriginal?.descuento_global_pct ?? 0);
  const [descuentoGlobalMonto, setDescuentoGlobalMonto] = useState(cotOriginal?.descuento_global_monto ?? 0);

  const [prorratearCostosOperativos, setProrratearCostosOperativos] = useState(cotOriginal?.prorratear_costos_operativos ?? false);
  const [mostrarPreciosUnitariosCliente, setMostrarPreciosUnitariosCliente] = useState(cotOriginal?.mostrar_precios_unitarios_cliente ?? true);
  const [mostrarVendedorCliente, setMostrarVendedorCliente] = useState(cotOriginal?.mostrar_vendedor_cliente ?? true);

  const [lineas, setLineas] = useState<LineaEstado[]>(() => (cotizacionExistente?.lineas ?? []).map((l) => {
    const prod = l.producto_id ? productos.find((p) => p.id === l.producto_id) : null;
    return {
      key: nuevaKey(),
      producto_id: l.producto_id,
      es_fuera_inventario: l.es_fuera_inventario,
      codigo_mostrado: l.codigo_mostrado ?? '',
      descripcion: l.descripcion,
      cantidad: Number(l.cantidad),
      costo_unitario: Number(l.costo_unitario),
      precio_unitario: Number(l.precio_unitario),
      descuento_linea_pct: Number(l.descuento_linea_pct),
      descuento_linea_monto: Number(l.descuento_linea_monto),
      modo_precio: l.modo_precio,
      margen_pct: l.margen_pct,
      incluir_foto: l.incluir_foto,
      // se le vuelve a sumar lo que esta misma línea ya tenía reservado, para no marcar
      // "excede stock" solo por estar editando una cotización que ya reservó esa cantidad.
      stockDisponible: prod ? prod.stock_actual - prod.stock_reservado + Number(l.cantidad) : null,
    };
  }));
  const [costosOperativos, setCostosOperativos] = useState<CostoOperativoEstado[]>(() => (cotizacionExistente?.costosOperativos ?? []).map((c) => ({
    key: nuevaKey(), concepto: c.concepto, cantidad: Number(c.cantidad), dias: Number(c.dias), costo_unitario: Number(c.costo_unitario),
  })));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vistaInterna, setVistaInterna] = useState(true);

  const clienteSeleccionado = clientes.find((c) => c.id === clienteId) || null;
  const margenSugerido = parametros.margen_sugerido_defecto ?? 0.45;

  function agregarDesdeCatalogo(p: Producto) {
    const costo = Number(p.costo_unitario);
    setLineas((prev) => [...prev, {
      key: nuevaKey(),
      producto_id: p.id,
      es_fuera_inventario: false,
      codigo_mostrado: p.codigo,
      descripcion: p.nombre + (p.color_variante ? ` (${p.color_variante})` : ''),
      cantidad: 1,
      costo_unitario: costo,
      precio_unitario: Number(p.precio_lista),
      descuento_linea_pct: 0,
      descuento_linea_monto: 0,
      modo_precio: 'FIJO',
      margen_pct: margenSugerido,
      incluir_foto: false,
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
      modo_precio: 'FIJO',
      margen_pct: margenSugerido,
      incluir_foto: false,
      stockDisponible: null,
    }]);
  }

  function actualizarLinea(key: string, patch: Partial<LineaEstado>) {
    setLineas((prev) => prev.map((l) => {
      if (l.key !== key) return l;
      const actualizada = { ...l, ...patch };
      // No se puede capturar más cantidad que el inventario disponible para este producto
      // (se incluye lo que esta misma línea ya tenía reservado, para no bloquearla por su
      // propia reserva al editar una cotización existente).
      if (patch.cantidad !== undefined && actualizada.stockDisponible !== null) {
        actualizada.cantidad = Math.min(Math.max(patch.cantidad, 0), actualizada.stockDisponible);
      }
      // el % de descuento de línea recalcula el monto automáticamente
      if (patch.descuento_linea_pct !== undefined) {
        actualizada.descuento_linea_monto = round2(actualizada.cantidad * actualizada.precio_unitario * (patch.descuento_linea_pct / 100));
      }
      // en modo "Costo + Margen", el precio se recalcula solo a partir del costo y el margen
      if (actualizada.modo_precio === 'COSTO_MARGEN' && (patch.costo_unitario !== undefined || patch.margen_pct !== undefined || patch.modo_precio !== undefined)) {
        actualizada.precio_unitario = precioPorMargen(actualizada.costo_unitario, actualizada.margen_pct ?? margenSugerido);
      }
      return actualizada;
    }));
  }

  function eliminarLinea(key: string) {
    setLineas((prev) => prev.filter((l) => l.key !== key));
  }

  function agregarCostoOperativo(concepto = '') {
    setCostosOperativos((prev) => [...prev, { key: nuevaKey(), concepto, cantidad: 0, dias: 0, costo_unitario: 0 }]);
  }

  function actualizarCostoOperativo(key: string, patch: Partial<CostoOperativoEstado>) {
    setCostosOperativos((prev) => prev.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  }

  function eliminarCostoOperativo(key: string) {
    setCostosOperativos((prev) => prev.filter((c) => c.key !== key));
  }

  function agregarConceptosSugeridos() {
    const existentes = new Set(costosOperativos.map((c) => c.concepto));
    const faltantes = CONCEPTOS_SUGERIDOS.filter((c) => !existentes.has(c));
    setCostosOperativos((prev) => [...prev, ...faltantes.map((concepto) => ({ key: nuevaKey(), concepto, cantidad: 0, dias: 0, costo_unitario: 0 }))]);
  }

  const calculo = useMemo(() => calcularCotizacion(lineas, {
    descuentoGlobalPct, descuentoGlobalMonto, clienteEsRetenedorIva, parametros,
    costosOperativos, escalasComision,
  }), [lineas, descuentoGlobalPct, descuentoGlobalMonto, clienteEsRetenedorIva, parametros, costosOperativos, escalasComision]);

  const prorrateoPorLinea = useMemo(
    () => distribuirCostosOperativosPorLinea(lineas, calculo.costosOperativosTotal),
    [lineas, calculo.costosOperativosTotal]
  );

  const totalEnLetras = numeroALetras(calculo.totalCotizado);

  async function guardar(finalizando: boolean) {
    setError(null);
    if (!vendedorId) { setError('Seleccione un vendedor.'); return; }
    if (lineas.length === 0) { setError('Agregue al menos un producto o servicio.'); return; }
    if (clienteModo === 'catalogo' && !clienteId) { setError('Seleccione un cliente o cambie a "Cliente no catalogado".'); return; }
    const lineaExcedida = lineas.find((l) => l.stockDisponible !== null && l.cantidad > l.stockDisponible);
    if (lineaExcedida) {
      setError(`"${lineaExcedida.descripcion || lineaExcedida.codigo_mostrado}" excede el inventario disponible (${lineaExcedida.stockDisponible} unidades). Ajuste la cantidad antes de guardar.`);
      return;
    }
    if (finalizando && !numeroSistemaExterno.trim()) {
      setError('Para finalizar debe capturar el número de cotización del sistema (ERP). Puede "Guardar borrador" sin este dato.');
      return;
    }
    if (vendedorTelefono && !esTelefonoGuatemalaValido(normalizarTelefonoGuatemala(vendedorTelefono))) {
      setError('El teléfono del vendedor debe tener el formato +502 y 8 dígitos.');
      return;
    }

    setGuardando(true);
    const payload = {
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
      plantilla_id: plantillaId || null,
      prorratear_costos_operativos: prorratearCostosOperativos,
      mostrar_precios_unitarios_cliente: mostrarPreciosUnitariosCliente,
      mostrar_vendedor_cliente: mostrarVendedorCliente,
      lineas: lineas.map(({ key, stockDisponible, ...l }) => l),
      costos_operativos: costosOperativos.map(({ key, ...c }) => c),
    };

    const resultado = modoEdicion
      ? await actualizarCotizacionCompleta(cotOriginal!.id, payload)
      : await crearCotizacion(payload);
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

            {plantillas.length > 0 && (
              <div>
                <label className="label">Plantilla de condiciones comerciales</label>
                <select className="input" value={plantillaId} onChange={(e) => setPlantillaId(e.target.value)}>
                  {plantillas.map((p) => (
                    <option key={p.id} value={p.id}>{p.nombre}{p.es_predeterminada ? ' (predeterminada)' : ''}</option>
                  ))}
                </select>
              </div>
            )}

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
            El cliente es agente retenedor de IVA (aplica retención del {(parametros.retencion_iva_porcentaje * 100).toFixed(0)}% sobre el IVA)
          </label>
        </div>
      </div>

      {/* Productos */}
      <div className="card">
        <h2 className="mb-3 text-sm font-bold text-slate-700">Productos y servicios</h2>
        <p className="mb-3 text-xs text-slate-400">
          Los precios que se digitan aquí <b>ya incluyen IVA</b> (es el precio final que paga el cliente).
        </p>
        <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
          <ProductPicker productos={productos} onSeleccionar={agregarDesdeCatalogo} />
          <button type="button" onClick={agregarFueraInventario} className="btn btn-secondary whitespace-nowrap">
            + Agregar fuera de inventario
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-400">
                <th className="py-2 pr-2">Código</th>
                <th className="py-2 pr-2">Descripción</th>
                <th className="py-2 pr-2 w-20">Cant.</th>
                <th className="py-2 pr-2 w-24">Costo U.</th>
                <th className="py-2 pr-2 w-36">Modo de precio</th>
                <th className="py-2 pr-2 w-28">Precio U. (c/IVA)</th>
                <th className="py-2 pr-2 w-20">Desc. %</th>
                <th className="py-2 pr-2 w-28">Subtotal</th>
                <th className="py-2 pr-2 w-16 text-center">Foto</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {lineas.map((l) => {
                const subtotalLinea = round2(l.cantidad * l.precio_unitario - l.descuento_linea_monto);
                const excedeStock = l.stockDisponible !== null && l.cantidad > l.stockDisponible;
                const producto = l.producto_id ? productos.find((p) => p.id === l.producto_id) : null;
                return (
                  <tr key={l.key} className="border-b border-slate-100 align-top last:border-0">
                    <td className="py-2 pr-2">
                      {l.es_fuera_inventario ? (
                        <span className="inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700">LIBRE</span>
                      ) : (
                        <span className="font-mono text-xs text-slate-500">{l.codigo_mostrado}</span>
                      )}
                    </td>
                    <td className="py-2 pr-2 min-w-[200px]">
                      {l.es_fuera_inventario ? (
                        <input className="input" value={l.descripcion}
                               onChange={(e) => actualizarLinea(l.key, { descripcion: e.target.value })}
                               placeholder="Describa el producto/servicio" />
                      ) : (
                        <span className="text-slate-700">{l.descripcion}</span>
                      )}
                      {producto?.especificaciones && (
                        <p className="mt-0.5 text-[11px] italic text-slate-400">{producto.especificaciones}</p>
                      )}
                      {excedeStock && <p className="mt-1 text-[11px] text-red-600">Excede el disponible ({l.stockDisponible} u.)</p>}
                    </td>
                    <td className="py-2 pr-2">
                      <input type="number" min={0} step="0.01" className="input" value={l.cantidad}
                             max={l.stockDisponible ?? undefined}
                             onChange={(e) => actualizarLinea(l.key, { cantidad: Number(e.target.value) })} />
                      {l.stockDisponible !== null && (
                        <p className="mt-0.5 text-[11px] text-slate-400">Disp.: {l.stockDisponible} u.</p>
                      )}
                    </td>
                    <td className="py-2 pr-2">
                      <input type="number" min={0} step="0.01" className="input" value={l.costo_unitario}
                             disabled={!l.es_fuera_inventario}
                             onChange={(e) => actualizarLinea(l.key, { costo_unitario: Number(e.target.value) })} />
                    </td>
                    <td className="py-2 pr-2">
                      <select className="input" value={l.modo_precio}
                              onChange={(e) => actualizarLinea(l.key, { modo_precio: e.target.value as ModoPrecioLinea })}>
                        <option value="FIJO">Precio fijo</option>
                        <option value="COSTO_MARGEN">Costo + margen %</option>
                      </select>
                      {l.modo_precio === 'COSTO_MARGEN' && (
                        <div className="mt-1 flex items-center gap-1">
                          <input type="number" min={0} max={99} step="0.1" className="input" value={round1((l.margen_pct ?? margenSugerido) * 100)}
                                 onChange={(e) => actualizarLinea(l.key, { margen_pct: Number(e.target.value) / 100 })} />
                          <span className="text-xs text-slate-400">% margen</span>
                        </div>
                      )}
                    </td>
                    <td className="py-2 pr-2">
                      <input type="number" min={0} step="0.01" className="input" value={l.precio_unitario}
                             disabled={l.modo_precio === 'COSTO_MARGEN'}
                             onChange={(e) => actualizarLinea(l.key, { precio_unitario: Number(e.target.value) })} />
                    </td>
                    <td className="py-2 pr-2">
                      <input type="number" min={0} max={100} step="0.01" className="input" value={l.descuento_linea_pct}
                             onChange={(e) => actualizarLinea(l.key, { descuento_linea_pct: Number(e.target.value) })} />
                    </td>
                    <td className="py-2 pr-2 font-semibold text-slate-700">{formatQ(subtotalLinea)}</td>
                    <td className="py-2 pr-2 text-center">
                      <input type="checkbox" checked={l.incluir_foto} disabled={!producto?.imagen_url}
                             title={producto?.imagen_url ? 'Incluir la foto de este producto en la cotización' : 'Este producto no tiene foto cargada en Inventario'}
                             onChange={(e) => actualizarLinea(l.key, { incluir_foto: e.target.checked })} />
                    </td>
                    <td className="py-2 text-right">
                      <button type="button" onClick={() => eliminarLinea(l.key)} className="text-slate-400 hover:text-red-600">✕</button>
                    </td>
                  </tr>
                );
              })}
              {lineas.length === 0 && (
                <tr><td colSpan={10} className="py-8 text-center text-slate-400">Busque un producto del inventario o agregue uno fuera de inventario.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Costos operativos adicionales (uso interno, nunca se muestra al cliente) */}
      <div className="card">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-slate-700">Costos operativos adicionales del proyecto</h2>
            <p className="text-xs text-slate-400">Opcional: hospedaje, viáticos, combustible, mano de obra, instalación, etc. Uso interno — nunca se muestra al cliente, pero sí resta de la utilidad y de la comisión.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={agregarConceptosSugeridos} className="btn btn-secondary whitespace-nowrap text-xs">
              + Conceptos comunes
            </button>
            <button type="button" onClick={() => agregarCostoOperativo()} className="btn btn-secondary whitespace-nowrap text-xs">
              + Agregar fila
            </button>
          </div>
        </div>

        {costosOperativos.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-400">
                  <th className="py-2 pr-2">Concepto</th>
                  <th className="py-2 pr-2 w-32">Cant. (personas/unid.)</th>
                  <th className="py-2 pr-2 w-32">Días/noches/tiempos</th>
                  <th className="py-2 pr-2 w-32">Costo unitario (Q)</th>
                  <th className="py-2 pr-2 w-28">Total</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {costosOperativos.map((c) => (
                  <tr key={c.key} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 pr-2">
                      <input className="input" value={c.concepto} onChange={(e) => actualizarCostoOperativo(c.key, { concepto: e.target.value })} placeholder="Concepto" />
                    </td>
                    <td className="py-2 pr-2">
                      <input type="number" min={0} step="0.01" className="input" value={c.cantidad} onChange={(e) => actualizarCostoOperativo(c.key, { cantidad: Number(e.target.value) })} />
                    </td>
                    <td className="py-2 pr-2">
                      <input type="number" min={0} step="0.01" className="input" value={c.dias} onChange={(e) => actualizarCostoOperativo(c.key, { dias: Number(e.target.value) })} />
                    </td>
                    <td className="py-2 pr-2">
                      <input type="number" min={0} step="0.01" className="input" value={c.costo_unitario} onChange={(e) => actualizarCostoOperativo(c.key, { costo_unitario: Number(e.target.value) })} />
                    </td>
                    <td className="py-2 pr-2 font-semibold text-slate-700">{formatQ(round2(c.cantidad * c.dias * c.costo_unitario))}</td>
                    <td className="py-2 text-right">
                      <button type="button" onClick={() => eliminarCostoOperativo(c.key)} className="text-slate-400 hover:text-red-600">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-2 flex items-center justify-between">
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" checked={prorratearCostosOperativos} onChange={(e) => setProrratearCostosOperativos(e.target.checked)} />
            Prorratear estos costos entre los productos de la tabla (solo para la vista interna; no cambia la utilidad total)
          </label>
          <span className="text-sm font-bold text-slate-700">
            Total gastos operativos adicionales: {formatQ(calculo.costosOperativosTotal)}
          </span>
        </div>

        {prorratearCostosOperativos && costosOperativos.length > 0 && lineas.length > 0 && (
          <div className="mt-3 overflow-x-auto rounded-lg bg-slate-50 p-3">
            <p className="mb-2 text-xs font-semibold text-slate-600">Distribución de costos operativos por producto (proporcional a su venta):</p>
            <table className="w-full min-w-[420px] text-xs">
              <tbody>
                {lineas.map((l, idx) => (
                  <tr key={l.key} className="border-b border-slate-200 last:border-0">
                    <td className="py-1 pr-2 text-slate-600">{l.descripcion || l.codigo_mostrado}</td>
                    <td className="py-1 pr-2 text-right font-medium text-slate-700">{formatQ(prorrateoPorLinea[idx] ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Descuentos y resumen */}
      <div className="card">
        <h2 className="mb-3 text-sm font-bold text-slate-700">Descuento sobre el subtotal</h2>
        <div className="grid grid-cols-2 gap-3 sm:max-w-md">
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
            {calculo.porcentajeDescuentoEfectivo > parametros.descuento_umbral_autorizacion * 100 ? (
              <>
                El descuento efectivo es de {calculo.porcentajeDescuentoEfectivo.toFixed(2)}%, mayor al{' '}
                {(parametros.descuento_umbral_autorizacion * 100).toFixed(0)}% permitido sin aprobación.{' '}
              </>
            ) : (
              <>El margen de esta cotización cae en el Rango 1 de la escala de comisión (0%), que requiere aprobación gerencial. </>
            )}
            Esta cotización quedará en estado <b>Pend. Autorizar</b> hasta que un Autorizador la apruebe.
          </div>
        )}
        <div className="mt-4 rounded-lg bg-navy-50 p-3 text-xs text-navy-800">
          <p className="font-semibold">Valor en letras</p>
          <p className="mt-1">{totalEnLetras}</p>
        </div>
      </div>

      {/* Qué ve el cliente */}
      <div className="card">
        <h2 className="mb-3 text-sm font-bold text-slate-700">Qué ve el cliente</h2>
        <div className="flex flex-col gap-2 text-sm text-slate-600">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={mostrarPreciosUnitariosCliente} onChange={(e) => setMostrarPreciosUnitariosCliente(e.target.checked)} />
            Mostrar precio unitario por línea (si se desmarca, la vista del cliente solo muestra un precio total del paquete)
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={mostrarVendedorCliente} onChange={(e) => setMostrarVendedorCliente(e.target.checked)} />
            Mostrar el nombre del vendedor en la vista del cliente
          </label>
        </div>
      </div>

      <div className="card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-700">Resumen</h2>
          <div className="flex rounded-lg bg-slate-100 p-1 text-xs font-semibold">
            <button type="button" onClick={() => setVistaInterna(false)}
              className={`rounded-md px-2.5 py-1 ${!vistaInterna ? 'bg-white shadow' : 'text-slate-500'}`}>
              Vista cliente
            </button>
            <button type="button" onClick={() => setVistaInterna(true)}
              className={`rounded-md px-2.5 py-1 ${vistaInterna ? 'bg-white shadow' : 'text-slate-500'}`}>
              Vista interna (gerencial)
            </button>
          </div>
        </div>

        {!vistaInterna ? (
          <dl className="max-w-md space-y-1.5 text-sm">
            {mostrarPreciosUnitariosCliente ? (
              <>
                <Fila label="Subtotal (con IVA)" valor={calculo.subtotalBruto} />
                <Fila label="Descuentos (líneas + global)" valor={-calculo.totalDescuentos} />
              </>
            ) : (
              <p className="text-xs text-slate-400">Se mostrará un solo precio de paquete (sin desglose por línea).</p>
            )}
            <Fila label="Total a pagar (incluye IVA)" valor={calculo.totalCotizado} negrita grande />
            <hr className="my-2 border-slate-200" />
            <p className="text-xs text-slate-400">Esta es la información que ve el cliente: sin costos, márgenes ni comisiones{!mostrarVendedorCliente ? ', ni el nombre del vendedor' : ''}.</p>
          </dl>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div>
              <h3 className="mb-2 text-xs font-bold uppercase text-slate-400">Resumen fiscal (Guatemala)</h3>
              <dl className="space-y-1.5 text-sm">
                <Fila label="Subtotal (con IVA)" valor={calculo.subtotalBruto} />
                <Fila label="Descuentos (líneas + global)" valor={-calculo.totalDescuentos} />
                <Fila label="Total cotizado (incluye IVA)" valor={calculo.totalCotizado} negrita />
                <Fila label="Base gravable (sin IVA)" valor={calculo.baseGravable} />
                <Fila label={`IVA (${(parametros.iva_porcentaje * 100).toFixed(0)}%)`} valor={calculo.ivaMonto} />
                <hr className="my-2 border-slate-200" />
                <Fila label="Retención ISR" valor={-calculo.isrRetencion} tono="text-red-600" />
                <Fila label={`Retención IVA (${(parametros.retencion_iva_porcentaje * 100).toFixed(0)}% del IVA)`} valor={-calculo.ivaRetencion} tono="text-red-600" />
                <Fila label="Pago neto a la empresa" valor={calculo.pagoNetoEmpresa} negrita tono="text-emerald-700" />
              </dl>
            </div>
            <div>
              <h3 className="mb-2 text-xs font-bold uppercase text-slate-400">Utilidad y comisión (uso interno)</h3>
              <dl className="space-y-1.5 text-sm">
                <Fila label="Costo total de productos/servicios" valor={calculo.costoTotalProductos} />
                <Fila label="+ Gastos operativos adicionales" valor={calculo.costosOperativosTotal} />
                <Fila label="= Costo total de operación" valor={calculo.costoTotalOperacion} negrita />
                <Fila label="Utilidad bruta (venta sin IVA - costo)" valor={calculo.utilidadBruta} negrita tono="text-navy-700" />
                <Fila label="− Retención ISR" valor={-calculo.isrRetencion} tono="text-red-600" />
                <Fila label="= Utilidad neta (base de comisión)" valor={calculo.utilidadNeta} negrita tono="text-navy-700" />
                <div className="flex justify-between text-sm text-slate-600"><dt>% Margen de utilidad (neta)</dt><dd className="font-semibold">{(calculo.margenUtilidadPct * 100).toFixed(2)}%</dd></div>
                <div className="flex justify-between text-sm text-slate-600">
                  <dt>Escala de comisión aplicada</dt>
                  <dd className="font-semibold">{calculo.escala ? `Rango ${calculo.escala.rango} (${(calculo.escala.desde_pct * 100).toFixed(0)}%${calculo.escala.hasta_pct != null ? ` - ${(calculo.escala.hasta_pct * 100).toFixed(0)}%` : '+'})` : '—'}</dd>
                </div>
                <div className="flex justify-between text-sm text-slate-600"><dt>% Comisión al vendedor</dt><dd className="font-semibold">{(calculo.comisionEstimadaPct * 100).toFixed(2)}%</dd></div>
                <hr className="my-2 border-slate-200" />
                <Fila label="Ganancia neta estimada para la empresa" valor={calculo.gananciaNetaEstimada} negrita grande tono="text-emerald-700" />
                <p className="mt-2 rounded-lg bg-slate-50 p-2 text-xs leading-relaxed text-slate-500">
                  Explicación: la utilidad neta ({formatQ(calculo.utilidadNeta)}) representa el {(calculo.margenUtilidadPct * 100).toFixed(2)}% de la venta neta base (sin IVA).
                  Ese % cae en el <b>Rango {calculo.escala?.rango ?? '—'}</b> de la escala de comisiones (Parámetros), que paga <b>{(calculo.comisionEstimadaPct * 100).toFixed(2)}%</b> sobre
                  la utilidad neta → {formatQ(calculo.utilidadNeta)} × {(calculo.comisionEstimadaPct * 100).toFixed(2)}% = <b>{formatQ(calculo.comisionEstimadaMonto)}</b> de comisión.
                  {calculo.escala?.observacion ? ` (${calculo.escala.observacion})` : ''}
                </p>
                <div className={`mt-3 rounded-lg border p-3 text-center ${calculo.comisionEstimadaMonto > 0 ? 'border-emerald-300 bg-emerald-50' : 'border-amber-300 bg-amber-50'}`}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Su comisión será de</p>
                  <p className={`text-2xl font-black ${calculo.comisionEstimadaMonto > 0 ? 'text-emerald-700' : 'text-amber-700'}`}>{formatQ(calculo.comisionEstimadaMonto)}</p>
                  {calculo.escala?.rango === 1 && (
                    <p className="mt-1 text-xs text-amber-700">Esta cotización requiere aprobación gerencial (margen dentro del Rango 1).</p>
                  )}
                </div>
              </dl>
            </div>
          </div>
        )}
      </div>

      <div className="sticky bottom-0 -mx-4 flex flex-col gap-2 border-t border-slate-200 bg-white/95 p-4 backdrop-blur sm:flex-row sm:justify-end lg:-mx-8 lg:px-8">
        <button type="button" onClick={() => router.push(modoEdicion ? `/cotizaciones/${cotOriginal!.id}` : '/cotizaciones')} className="btn btn-ghost">Cancelar</button>
        {modoEdicion ? (
          <button type="button" disabled={guardando} onClick={() => guardar(true)} className="btn btn-orange">
            {guardando ? 'Guardando…' : 'Guardar cambios'}
          </button>
        ) : (
          <>
            <button type="button" disabled={guardando} onClick={() => guardar(false)} className="btn btn-secondary">
              Guardar borrador
            </button>
            <button type="button" disabled={guardando} onClick={() => guardar(true)} className="btn btn-orange">
              {guardando ? 'Guardando…' : 'Guardar y continuar'}
            </button>
          </>
        )}
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
function round1(n: number) { return Math.round((n + Number.EPSILON) * 10) / 10; }
