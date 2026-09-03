import * as XLSX from 'xlsx';
import { construirHojaLibre, formula, FORMATO_MONEDA, FORMATO_PORCENTAJE, type CeldaLibre } from '@/lib/excel';
import { formatFecha } from '@/lib/utils';
import type { Cotizacion, CotizacionDetalle, ParametrosFiscales, PlantillaCotizacion } from '@/lib/types';

type LineaConProducto = CotizacionDetalle & { producto?: { unidad?: string | null } | null };

const CONDICIONES_DEFECTO = [
  'Precios expresados en Quetzales (Q) e incluyen IVA.',
  'Vigencia de esta cotización: según los días de vigencia configurados a partir de la fecha de emisión.',
  'Número de referencia de pedido / cotización: el indicado en el encabezado de este documento.',
  'Precios sujetos a cambio sin previo aviso una vez vencida la vigencia indicada.',
];

interface ContextoCotizacion {
  cotizacion: Cotizacion;
  lineas: LineaConProducto[];
  parametros: ParametrosFiscales;
  plantilla: PlantillaCotizacion | null;
  clienteNombre: string;
  clienteNit: string | null;
  clienteDireccion: string | null;
  vendedorNombre: string;
  vendedorCorreo: string | null;
}

function letra(colIdx: number) {
  return XLSX.utils.encode_col(colIdx);
}
function rangoMerge(colDesde: number, colHasta: number, fila: number) {
  return `${letra(colDesde)}${fila}:${letra(colHasta)}${fila}`;
}

/**
 * Arma la hoja "Cotización" — versión cliente o interna — como un documento de una sola
 * hoja que sigue la misma estructura que el PDF (encabezado dual, tarjetas de
 * cliente/proyecto, tabla de ítems, totales, condiciones, firmas), usando celdas
 * combinadas para que se vea como el documento real. Limitación conocida: la librería
 * community de SheetJS no soporta colores/rellenos de celda (ver nota en excel.ts), así
 * que esta hoja no lleva la paleta corporativa — solo estructura, mayúsculas para títulos
 * y fórmulas reales de Excel donde corresponde (igual que el resto de hojas de este
 * sistema).
 */
export function construirHojaCotizacion(ctx: ContextoCotizacion, opciones: { interna: boolean }): XLSX.WorkSheet {
  const { cotizacion: c, lineas, parametros, plantilla, clienteNombre, clienteNit, clienteDireccion, vendedorNombre, vendedorCorreo } = ctx;
  const interna = opciones.interna;
  const mostrarPrecios = interna || c.mostrar_precios_unitarios_cliente;
  const colCount = interna ? 7 : 5; // interna agrega Costo unit. y Utilidad línea
  const colValor = colCount - 1;
  const mitad = Math.ceil(colCount / 2);
  const condiciones = (plantilla?.condiciones_comerciales?.trim()
    ? plantilla.condiciones_comerciales.split('\n').map((l) => l.trim()).filter(Boolean)
    : CONDICIONES_DEFECTO);
  const leyendaPie = plantilla?.leyenda_pie?.trim() || parametros.leyenda_cotizacion;
  const tituloTabla = plantilla?.titulo_tabla_items || 'DETALLE DE PRODUCTOS Y SERVICIOS';
  const firmaEmisor = plantilla?.texto_firma_emisor || 'Autorizado por (Asesor)';
  const firmaCliente = plantilla?.texto_firma_cliente || 'Aceptado por (Cliente / Fecha)';

  const filas: CeldaLibre[][] = [];
  const merges: string[] = [];
  const formatos: { fila: number; col: number; formato: string }[] = [];

  const vacia = (): CeldaLibre[] => Array.from({ length: colCount }, () => '');
  function agregar(fila: CeldaLibre[]): number {
    filas.push(fila);
    return filas.length; // número de fila 1-based recién agregada
  }
  function agregarDual(izq: CeldaLibre, der: CeldaLibre): number {
    const fila = vacia();
    fila[0] = izq;
    fila[mitad] = der;
    const n = agregar(fila);
    merges.push(rangoMerge(0, mitad - 1, n), rangoMerge(mitad, colCount - 1, n));
    return n;
  }
  function agregarAncha(texto: CeldaLibre): number {
    const fila = vacia();
    fila[0] = texto;
    const n = agregar(fila);
    merges.push(rangoMerge(0, colCount - 1, n));
    return n;
  }
  function agregarMoneda(label: string, valor: number, formato = FORMATO_MONEDA, colDestino = colValor): number {
    const fila = vacia();
    fila[0] = label;
    fila[colDestino] = valor;
    const n = agregar(fila);
    merges.push(rangoMerge(0, colDestino - 1, n));
    formatos.push({ fila: n, col: colDestino, formato });
    return n;
  }

  // --- Encabezado dual ---
  agregarDual(parametros.nombre_comercial || parametros.razon_social, 'COTIZACIÓN');
  agregarDual(parametros.direccion_empresa || '', `Folio: ${c.numero_sistema_externo || c.numero_interno}`);
  agregarDual(`${parametros.telefono_empresa || ''} · ${parametros.correo_empresa || ''}`, `Fecha: ${formatFecha(c.fecha_emision)}`);
  agregarDual('', `Válida hasta: ${c.fecha_vencimiento ? formatFecha(c.fecha_vencimiento) : '—'}`);
  if (interna || c.mostrar_vendedor_cliente) {
    agregarDual('', `Vendedor: ${vendedorNombre}${c.vendedor_telefono ? ` · ${c.vendedor_telefono}` : ''}${vendedorCorreo ? ` · ${vendedorCorreo}` : ''}`);
  }
  agregar(vacia());

  // --- Tarjetas de información ---
  agregarDual('INFORMACIÓN DEL CLIENTE', interna ? 'DETALLES DEL PROYECTO / VISITA TÉCNICA' : 'DETALLES DEL PROYECTO');
  const comentarioLineas = (c.comentario || 'Sin observaciones adicionales.').split('\n');
  agregarDual(`Nombre: ${clienteNombre}`, comentarioLineas[0] || '');
  agregarDual(`Dirección: ${clienteDireccion || '—'}`, comentarioLineas[1] || '');
  agregarDual(`Teléfono: ${c.cliente_telefono || '—'}`, comentarioLineas[2] || '');
  if (clienteNit) agregarDual(`NIT: ${clienteNit}`, '');
  agregar(vacia());

  if (plantilla?.texto_institucional) {
    agregarAncha(plantilla.texto_institucional);
    agregar(vacia());
  }

  // --- Tabla de ítems ---
  agregarAncha(tituloTabla.toUpperCase());

  const COL_CANT = 1, COL_UNIDAD = 2, COL_COSTO = 3, COL_PRECIO = interna ? 4 : 3, COL_TOTAL = interna ? 5 : 4, COL_UTIL = 6;
  const encabezadoItems = vacia();
  encabezadoItems[0] = 'Descripción';
  encabezadoItems[COL_CANT] = 'Cantidad';
  encabezadoItems[COL_UNIDAD] = 'Unidad';
  if (interna) encabezadoItems[COL_COSTO] = 'Costo unit.';
  if (mostrarPrecios) {
    encabezadoItems[COL_PRECIO] = 'Precio unit.';
    encabezadoItems[COL_TOTAL] = 'Total';
    if (interna) encabezadoItems[COL_UTIL] = 'Utilidad línea';
  }
  agregar(encabezadoItems);

  const filaInicioItems = filas.length + 1;
  lineas.forEach((l) => {
    const filaFila = vacia();
    filaFila[0] = l.descripcion;
    filaFila[COL_CANT] = Number(l.cantidad);
    filaFila[COL_UNIDAD] = l.producto?.unidad || 'unidad';
    const numFila = filas.length + 1;
    if (interna) {
      filaFila[COL_COSTO] = Number(l.costo_unitario);
      filaFila[COL_PRECIO] = Number(l.precio_unitario);
      filaFila[COL_TOTAL] = formula(`${letra(COL_PRECIO)}${numFila}*${letra(COL_CANT)}${numFila}`);
      filaFila[COL_UTIL] = formula(`${letra(COL_TOTAL)}${numFila}-${letra(COL_COSTO)}${numFila}*${letra(COL_CANT)}${numFila}`);
      formatos.push({ fila: numFila, col: COL_COSTO, formato: FORMATO_MONEDA });
      formatos.push({ fila: numFila, col: COL_PRECIO, formato: FORMATO_MONEDA });
      formatos.push({ fila: numFila, col: COL_TOTAL, formato: FORMATO_MONEDA });
      formatos.push({ fila: numFila, col: COL_UTIL, formato: FORMATO_MONEDA });
    } else if (mostrarPrecios) {
      filaFila[COL_PRECIO] = Number(l.precio_unitario);
      filaFila[COL_TOTAL] = formula(`${letra(COL_PRECIO)}${numFila}*${letra(COL_CANT)}${numFila}`);
      formatos.push({ fila: numFila, col: COL_PRECIO, formato: FORMATO_MONEDA });
      formatos.push({ fila: numFila, col: COL_TOTAL, formato: FORMATO_MONEDA });
    }
    agregar(filaFila);
  });
  const filaFinItems = filas.length;

  if (!mostrarPrecios) {
    agregar(vacia());
    agregarAncha('Precios detallados por artículo omitidos — se muestra el precio total del paquete.');
  }
  agregar(vacia());

  // --- Totales (alineados bajo la columna "Total" de la tabla de ítems) ---
  if (mostrarPrecios) {
    const filaSubtotal = agregarMoneda('Subtotal (incluye IVA)', 0, FORMATO_MONEDA, COL_TOTAL);
    filas[filaSubtotal - 1][COL_TOTAL] = formula(`SUM(${letra(COL_TOTAL)}${filaInicioItems}:${letra(COL_TOTAL)}${filaFinItems})`);
    formatos.push({ fila: filaSubtotal, col: COL_TOTAL, formato: FORMATO_MONEDA });

    let filaDescuento: number | null = null;
    if (Number(c.total_descuentos) > 0) {
      filaDescuento = agregarMoneda('Descuento especial', -Number(c.total_descuentos), FORMATO_MONEDA, COL_TOTAL);
    }
    const filaTotal = agregarMoneda('TOTAL', 0, FORMATO_MONEDA, COL_TOTAL);
    filas[filaTotal - 1][COL_TOTAL] = filaDescuento
      ? formula(`${letra(COL_TOTAL)}${filaSubtotal}+${letra(COL_TOTAL)}${filaDescuento}`)
      : formula(`${letra(COL_TOTAL)}${filaSubtotal}`);
    formatos.push({ fila: filaTotal, col: COL_TOTAL, formato: FORMATO_MONEDA });
  } else {
    agregarMoneda('TOTAL', Number(c.total_cotizado), FORMATO_MONEDA, COL_TOTAL);
  }
  if (c.total_en_letras) {
    agregarDual('Son:', c.total_en_letras);
  }
  agregar(vacia());

  // --- Bloque financiero interno (confidencial) ---
  if (interna) {
    agregarAncha('RESUMEN FINANCIERO INTERNO (CONFIDENCIAL)');
    agregarMoneda('Venta neta base (sin IVA)', Number(c.base_gravable));
    agregarMoneda(`IVA (${(Number(parametros.iva_porcentaje) * 100).toFixed(0)}%)`, Number(c.iva_monto));
    agregarMoneda('Retención ISR', Number(c.isr_retencion));
    agregarMoneda(`Retención IVA (${(Number(parametros.retencion_iva_porcentaje) * 100).toFixed(0)}% del IVA, si el cliente es retenedor)`, Number(c.iva_retencion));
    agregarMoneda('Pago neto que recibe la empresa', Number(c.pago_neto_empresa));
    agregar(vacia());
    agregarMoneda('Costo total de productos/servicios', Number(c.costo_total_productos));
    agregarMoneda('Gastos operativos adicionales', Number(c.costos_operativos_total));
    agregarMoneda('Utilidad bruta (venta neta base - costos)', Number(c.utilidad_bruta));
    agregarMoneda('Utilidad neta (utilidad bruta - ISR — base de comisión)', Number(c.utilidad_neta));
    agregarMoneda('% Margen de utilidad neta', Number(c.margen_utilidad_pct), FORMATO_PORCENTAJE);
    agregarMoneda(`Comisión estimada (Rango ${c.escala_comision_rango ?? '—'})`, Number(c.comision_estimada_monto));
    agregarMoneda('Ganancia neta para la empresa', Number(c.ganancia_neta_estimada));
    agregar(vacia());
  }

  // --- Términos y firmas ---
  agregarAncha('TÉRMINOS Y CONDICIONES COMERCIALES');
  condiciones.forEach((linea, idx) => agregarAncha(`${idx + 1}. ${linea}`));
  agregar(vacia());
  agregarDual(firmaEmisor, firmaCliente);
  agregar(vacia());
  if (leyendaPie) agregarAncha(leyendaPie);

  const anchoColumnas = interna
    ? [40, 10, 10, 14, 14, 16, 16]
    : [46, 10, 10, 16, 16];

  const ws = construirHojaLibre(filas, { merges, anchoColumnas });
  formatos.forEach(({ fila, col, formato }) => {
    const addr = XLSX.utils.encode_cell({ r: fila - 1, c: col });
    if (ws[addr]) ws[addr].z = formato;
  });
  return ws;
}
