import { createClient } from '@/lib/supabase/server';
import { distribuirCostosOperativosPorLinea } from '@/lib/fiscal';

// ---------------------------------------------------------------------------
// Reportes avanzados (Etapa 7 — Tanda 4): "Ventas del Mes" con costo/margen/
// utilidad/comisión por producto, y reporte de costos por período. Se apoyan en
// datos que ya se calculan y guardan al facturar una cotización (no recalculan
// nada por su cuenta) — ver app.recalcular_cotizacion y el trigger que crea la
// fila en app.comisiones_calculadas al pasar una cotización a FACTURADO.
// ---------------------------------------------------------------------------

export interface FiltrosPeriodo {
  desde?: string;
  hasta?: string;
  vendedorId?: string | null;
}

export interface FilaVentaProducto {
  producto_id: string | null;
  codigo: string;
  nombre: string;
  cantidad: number;
  costo_total: number;
  venta_total: number;
  utilidad: number;
  margen_pct: number;
  comision_atribuida: number;
}

export interface TotalesVentaProducto {
  cantidad: number;
  costo_total: number;
  venta_total: number;
  utilidad: number;
  margen_pct: number;
  comision_atribuida: number;
}

export interface ResumenVentasProducto {
  filas: FilaVentaProducto[];
  totales: TotalesVentaProducto;
  cotizacionesIncluidas: number;
}

const TOTALES_VACIOS: TotalesVentaProducto = {
  cantidad: 0, costo_total: 0, venta_total: 0, utilidad: 0, margen_pct: 0, comision_atribuida: 0,
};

// "Ventas del Mes": arma el detalle línea por línea de todas las cotizaciones YA
// FACTURADAS (una fila en app.comisiones_calculadas = una cotización facturada) dentro
// del rango de fechas de facturación dado, y lo agrupa por producto (o por descripción
// libre, para los ítems "fuera de inventario"). La comisión de cada cotización —ya
// calculada y congelada al momento de facturar— se reparte entre sus líneas en
// proporción a la venta de cada una, igual que se reparten los costos operativos en la
// vista interna de la cotización (misma función `distribuirCostosOperativosPorLinea`).
export async function obtenerVentasPorProducto(filtros: FiltrosPeriodo): Promise<ResumenVentasProducto> {
  const supabase = createClient();

  let qComisiones = supabase.from('comisiones_calculadas')
    .select('cotizacion_id, vendedor_id, monto_comision, fecha_facturacion');
  if (filtros.desde) qComisiones = qComisiones.gte('fecha_facturacion', filtros.desde);
  if (filtros.hasta) qComisiones = qComisiones.lte('fecha_facturacion', filtros.hasta);
  if (filtros.vendedorId) qComisiones = qComisiones.eq('vendedor_id', filtros.vendedorId);

  const { data: comisiones } = await qComisiones.limit(3000);
  const filasComision = comisiones ?? [];
  if (filasComision.length === 0) {
    return { filas: [], totales: { ...TOTALES_VACIOS }, cotizacionesIncluidas: 0 };
  }

  const cotizacionIds = filasComision.map((c) => c.cotizacion_id as string);
  const comisionPorCotizacion = new Map(filasComision.map((c) => [c.cotizacion_id as string, Number(c.monto_comision)]));

  const { data: detalle } = await supabase
    .from('cotizacion_detalle')
    .select('cotizacion_id, producto_id, codigo_mostrado, descripcion, cantidad, costo_unitario, precio_unitario, subtotal_linea')
    .in('cotizacion_id', cotizacionIds)
    .order('linea', { ascending: true });

  const porCotizacion = new Map<string, NonNullable<typeof detalle>>();
  for (const linea of detalle ?? []) {
    const lista = porCotizacion.get(linea.cotizacion_id) ?? [];
    lista.push(linea);
    porCotizacion.set(linea.cotizacion_id, lista);
  }

  const agregado = new Map<string, FilaVentaProducto>();

  for (const [cotizacionId, lineas] of porCotizacion) {
    const comisionTotal = comisionPorCotizacion.get(cotizacionId) ?? 0;
    const comisionesPorLinea = distribuirCostosOperativosPorLinea(lineas, comisionTotal);

    lineas.forEach((linea, idx) => {
      const clave = linea.producto_id ?? `libre:${(linea.codigo_mostrado || linea.descripcion || '').trim().toLowerCase()}`;
      const costo = Number(linea.costo_unitario) * Number(linea.cantidad);
      const venta = Number(linea.subtotal_linea);
      const utilidad = venta - costo;
      const comisionLinea = comisionesPorLinea[idx] ?? 0;

      const existente = agregado.get(clave);
      if (existente) {
        existente.cantidad += Number(linea.cantidad);
        existente.costo_total += costo;
        existente.venta_total += venta;
        existente.utilidad += utilidad;
        existente.comision_atribuida += comisionLinea;
      } else {
        agregado.set(clave, {
          producto_id: linea.producto_id,
          codigo: linea.codigo_mostrado || '—',
          nombre: linea.descripcion,
          cantidad: Number(linea.cantidad),
          costo_total: costo,
          venta_total: venta,
          utilidad,
          margen_pct: 0,
          comision_atribuida: comisionLinea,
        });
      }
    });
  }

  const filas = Array.from(agregado.values())
    .map((f) => ({ ...f, margen_pct: f.venta_total > 0 ? f.utilidad / f.venta_total : 0 }))
    .sort((a, b) => b.venta_total - a.venta_total);

  const totales = filas.reduce<TotalesVentaProducto>((acc, f) => ({
    cantidad: acc.cantidad + f.cantidad,
    costo_total: acc.costo_total + f.costo_total,
    venta_total: acc.venta_total + f.venta_total,
    utilidad: acc.utilidad + f.utilidad,
    comision_atribuida: acc.comision_atribuida + f.comision_atribuida,
    margen_pct: 0,
  }), { ...TOTALES_VACIOS });
  totales.margen_pct = totales.venta_total > 0 ? totales.utilidad / totales.venta_total : 0;

  return { filas, totales, cotizacionesIncluidas: cotizacionIds.length };
}

export type AgruparCostosPor = 'mes' | 'vendedor';

export interface FilaCostoPeriodo {
  clave: string;
  etiqueta: string;
  cotizaciones: number;
  venta_total: number;
  costo_productos: number;
  costos_operativos: number;
  costo_operacion: number;
  utilidad_bruta: number;
  margen_pct: number;
}

export interface ResumenCostosPeriodo {
  filas: FilaCostoPeriodo[];
  totales: Omit<FilaCostoPeriodo, 'clave' | 'etiqueta' | 'margen_pct'> & { margen_pct: number };
}

const MESES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function etiquetaMes(clave: string): string {
  const [anio, mes] = clave.split('-');
  const idx = Number(mes) - 1;
  return `${MESES_ES[idx] ?? mes} ${anio}`;
}

// Reporte de costos por período: agrupa las cotizaciones YA FACTURADAS (por fecha de
// facturación) por mes o por vendedor, sumando lo que ya guarda cada cotización en su
// resumen financiero interno (costo_total_productos, costos_operativos_total,
// utilidad_bruta, etc. — Etapa 1 del Módulo Avanzado). No recalcula nada, solo agrupa.
export async function obtenerCostosPorPeriodo(filtros: FiltrosPeriodo & { agrupar: AgruparCostosPor }): Promise<ResumenCostosPeriodo> {
  const supabase = createClient();

  let query = supabase.from('cotizaciones')
    .select('id, facturado_en, vendedor_id, vendedor:vendedores(nombre_completo), total_cotizado, costo_total_productos, costos_operativos_total, costo_total_operacion, utilidad_bruta')
    .eq('estado', 'FACTURADO')
    .order('facturado_en', { ascending: true });
  if (filtros.desde) query = query.gte('facturado_en', filtros.desde);
  if (filtros.hasta) query = query.lte('facturado_en', filtros.hasta);
  if (filtros.vendedorId) query = query.eq('vendedor_id', filtros.vendedorId);

  const { data } = await query.limit(3000);
  const lista = (data ?? []) as unknown as {
    id: string; facturado_en: string | null; vendedor_id: string;
    vendedor: { nombre_completo: string } | null;
    total_cotizado: number; costo_total_productos: number; costos_operativos_total: number;
    costo_total_operacion: number; utilidad_bruta: number;
  }[];

  const grupos = new Map<string, FilaCostoPeriodo>();
  for (const c of lista) {
    const clave = filtros.agrupar === 'mes'
      ? (c.facturado_en ?? '').slice(0, 7) || 'Sin fecha'
      : c.vendedor_id;
    const etiqueta = filtros.agrupar === 'mes'
      ? (clave === 'Sin fecha' ? clave : etiquetaMes(clave))
      : (c.vendedor?.nombre_completo ?? 'Sin vendedor');

    const existente = grupos.get(clave);
    const fila: FilaCostoPeriodo = existente ?? {
      clave, etiqueta, cotizaciones: 0, venta_total: 0, costo_productos: 0,
      costos_operativos: 0, costo_operacion: 0, utilidad_bruta: 0, margen_pct: 0,
    };
    fila.cotizaciones += 1;
    fila.venta_total += Number(c.total_cotizado);
    fila.costo_productos += Number(c.costo_total_productos);
    fila.costos_operativos += Number(c.costos_operativos_total);
    fila.costo_operacion += Number(c.costo_total_operacion);
    fila.utilidad_bruta += Number(c.utilidad_bruta);
    grupos.set(clave, fila);
  }

  const filas = Array.from(grupos.values())
    .map((f) => ({ ...f, margen_pct: f.venta_total > 0 ? f.utilidad_bruta / f.venta_total : 0 }))
    .sort((a, b) => (filtros.agrupar === 'mes' ? a.clave.localeCompare(b.clave) : b.venta_total - a.venta_total));

  const totales = filas.reduce((acc, f) => ({
    cotizaciones: acc.cotizaciones + f.cotizaciones,
    venta_total: acc.venta_total + f.venta_total,
    costo_productos: acc.costo_productos + f.costo_productos,
    costos_operativos: acc.costos_operativos + f.costos_operativos,
    costo_operacion: acc.costo_operacion + f.costo_operacion,
    utilidad_bruta: acc.utilidad_bruta + f.utilidad_bruta,
    margen_pct: 0,
  }), { cotizaciones: 0, venta_total: 0, costo_productos: 0, costos_operativos: 0, costo_operacion: 0, utilidad_bruta: 0, margen_pct: 0 });
  totales.margen_pct = totales.venta_total > 0 ? totales.utilidad_bruta / totales.venta_total : 0;

  return { filas, totales };
}

// Rango de fechas por defecto: el mes calendario actual (desde el día 1 hasta hoy).
export function rangoMesActual(): { desde: string; hasta: string } {
  const hoy = new Date();
  const desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().slice(0, 10);
  const hasta = hoy.toISOString().slice(0, 10);
  return { desde, hasta };
}
