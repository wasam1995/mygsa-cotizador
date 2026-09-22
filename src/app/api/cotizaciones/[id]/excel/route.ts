import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { createClient } from '@/lib/supabase/server';
import { requireSesion } from '@/lib/auth';
import { construirLibro, libroABuffer, respuestaExcel, formula, FORMATO_MONEDA, FORMATO_PORCENTAJE } from '@/lib/excel';
import { construirHojaCotizacion } from '@/lib/excelCotizacion';
import type { HojaExcel } from '@/lib/excel';
import type { Cotizacion, ParametrosFiscales, PlantillaCotizacion } from '@/lib/types';

// Excel "versión interna" — lleva información confidencial (costos, utilidad, comisión),
// igual que el PDF interno, así que requiere el mismo permiso que ese botón
// (COTIZACIONES_CREAR o COTIZACIONES_VER_TODAS) y no solo estar autenticado.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const sesion = await requireSesion();
  if (!sesion.permisos.includes('COTIZACIONES_CREAR') && !sesion.permisos.includes('COTIZACIONES_VER_TODAS')) {
    return NextResponse.json({ error: 'No tiene permiso para ver la versión interna de esta cotización.' }, { status: 403 });
  }
  // El Resumen Fiscal (retenciones/base gravable) solo lo ven Autorizador y
  // Administrador — decisión explícita del cliente, no un permiso configurable, igual
  // que en pantalla y en el PDF interno. Quien no cumpla esto (ej. un vendedor con
  // COTIZACIONES_CREAR) igual puede descargar el Excel interno, pero sin ese bloque.
  const puedeVerResumenFiscal = sesion.rolCodigo === 'ADMINISTRADOR' || sesion.rolCodigo === 'AUTORIZADOR';
  const supabase = createClient();

  // Todo el cuerpo va en try/catch — ver la nota equivalente en excel/cliente/route.ts:
  // un tropiezo puntual (fila de parametros_fiscales que no llega, error transitorio) no
  // debe tronar con una excepción no controlada; se responde con JSON de error legible.
  try {
  const { data: cotizacion, error: errorCotizacion } = await supabase
    .from('cotizaciones')
    .select('*, cliente:clientes(nombre_razon, nit, direccion), vendedor:vendedores(nombre_completo, codigo, correo)')
    .eq('id', params.id)
    .single();

  if (errorCotizacion || !cotizacion) {
    if (errorCotizacion) console.error('[excel/interno] error al leer cotización', params.id, errorCotizacion);
    return NextResponse.json({ error: 'No encontrada' }, { status: 404 });
  }

  const [{ data: lineas }, { data: costosOperativos }, { data: parametros, error: errorParametros }, { data: plantilla }] = await Promise.all([
    supabase.from('cotizacion_detalle').select('*, producto:productos(unidad)').eq('cotizacion_id', params.id).order('linea'),
    supabase.from('cotizacion_costos_operativos').select('*').eq('cotizacion_id', params.id).order('orden'),
    supabase.from('parametros_fiscales').select('*').eq('id', 1).single(),
    (cotizacion as any).plantilla_id
      ? supabase.from('plantillas_cotizacion').select('*').eq('id', (cotizacion as any).plantilla_id).single()
      : Promise.resolve({ data: null }),
  ]);
  if (errorParametros) console.error('[excel/interno] error al leer parametros_fiscales', errorParametros);

  const c = cotizacion as any;
  const esRetenedor = c.cliente_es_retenedor_iva ? 'Sí' : 'No';
  const retencionIvaPct = Number((parametros as any)?.retencion_iva_porcentaje ?? 0.15);

  // --- Hoja "Detalle": el Subtotal y el Costo total de línea se calculan con fórmulas
  // reales de Excel (multiplicación de columnas), no con el valor ya calculado en la
  // base de datos — así el archivo se puede auditar/editar en Excel y recalcula solo.
  const detalle = (lineas ?? []).map((l: any, idx: number) => {
    const fila = idx + 2; // +2: la fila 1 es el encabezado
    return {
      linea: l.linea,
      codigo: l.codigo_mostrado ?? '',
      descripcion: l.descripcion,
      cantidad: Number(l.cantidad),
      costo_unitario: Number(l.costo_unitario),
      precio_unitario: Number(l.precio_unitario),
      descuento_pct: Number(l.descuento_linea_pct),
      descuento_monto: Number(l.descuento_linea_monto),
      subtotal: formula(`D${fila}*F${fila}-H${fila}`), // Cantidad * Precio unitario - Descuento monto
      costo_total_linea: formula(`D${fila}*E${fila}`), // Cantidad * Costo unitario
    };
  });

  const hojaDetalle: HojaExcel = {
    nombre: 'Detalle',
    columnas: [
      { header: 'Línea', key: 'linea', tipo: 'entero' },
      { header: 'Código', key: 'codigo', tipo: 'texto' },
      { header: 'Descripción', key: 'descripcion', tipo: 'texto' },
      { header: 'Cantidad', key: 'cantidad', tipo: 'entero' },
      { header: 'Costo unitario', key: 'costo_unitario', tipo: 'moneda' },
      { header: 'Precio unitario', key: 'precio_unitario', tipo: 'moneda' },
      { header: 'Descuento %', key: 'descuento_pct', tipo: 'porcentaje' },
      { header: 'Descuento monto', key: 'descuento_monto', tipo: 'moneda' },
      { header: 'Subtotal', key: 'subtotal', tipo: 'moneda' },
      { header: 'Costo total línea', key: 'costo_total_linea', tipo: 'moneda' },
    ],
    filas: detalle,
    totales: ['cantidad', 'costo_total_linea', 'subtotal'],
  };

  const costos = (costosOperativos ?? []).map((co: any, idx: number) => {
    const fila = idx + 2;
    return {
      concepto: co.concepto,
      cantidad: Number(co.cantidad),
      dias: Number(co.dias),
      costo_unitario: Number(co.costo_unitario),
      total: formula(`B${fila}*C${fila}*D${fila}`), // Cantidad * Días * Costo unitario
    };
  });

  const hojaCostos: HojaExcel = {
    nombre: 'Costos operativos',
    columnas: [
      { header: 'Concepto', key: 'concepto', tipo: 'texto' },
      { header: 'Cantidad', key: 'cantidad', tipo: 'entero' },
      { header: 'Días/tiempos', key: 'dias', tipo: 'entero' },
      { header: 'Costo unitario', key: 'costo_unitario', tipo: 'moneda' },
      { header: 'Total', key: 'total', tipo: 'moneda' },
    ],
    filas: costos,
    totales: ['total'],
  };

  // --- Hoja "Resumen": texto/número simple para la mayoría de filas; las filas
  // calculadas (Retención IVA condicional, Costo total de operación, Utilidad bruta,
  // Utilidad neta, % margen, Comisión, Ganancia neta) llevan fórmulas reales. Modelo
  // financiero Etapa 5: Utilidad Bruta = Venta Neta Base (sin IVA) - Costo de operación;
  // Utilidad Neta = Utilidad Bruta - ISR (base real de la comisión).
  //
  // El Resumen Fiscal (retenedor de IVA, subtotal, descuentos, venta neta base, IVA,
  // total cotizado, retención ISR, retención IVA, pago neto) solo lo ven Autorizador y
  // Administrador — mismo criterio que en pantalla y en el PDF/hoja "Cotización"
  // interna. Por eso las filas se arman dinámicamente (en vez de con números de fila
  // fijos como antes) y ese bloque se omite por completo si no corresponde; las
  // fórmulas de Utilidad/Comisión (que sí ven todos) usan directamente los valores
  // numéricos de venta neta base e ISR cuando el bloque fiscal no está presente, para
  // no depender de celdas que no existen en ese caso.
  type FilaResumenXlsx = { campo: string; valor?: unknown; formula?: string; formato?: string };
  const filasResumen: FilaResumenXlsx[] = [];
  function fila(campo: string, valor: unknown, formato?: string): number {
    filasResumen.push({ campo, valor, formato });
    return filasResumen.length + 1; // +1: la fila 1 de la hoja es el encabezado
  }
  function filaFormula(campo: string, f: string, formato: string): number {
    filasResumen.push({ campo, valor: 0, formula: f, formato });
    return filasResumen.length + 1;
  }

  fila('No. Interno', c.numero_interno);
  fila('No. ERP', c.numero_sistema_externo ?? '');
  fila('Fecha emisión', c.fecha_emision);
  fila('Estado', c.estado);
  fila('Cliente', c.cliente?.nombre_razon ?? c.cliente_nombre_libre ?? '');
  fila('Vendedor', c.vendedor?.nombre_completo ?? '');

  let filaVentaNetaRef: string;
  let filaIsrRef: string;
  if (puedeVerResumenFiscal) {
    const filaRetenedor = fila('Cliente retenedor de IVA', esRetenedor);
    const filaPctRetIva = fila('% Retención de IVA (parametrizado)', retencionIvaPct, FORMATO_PORCENTAJE);
    fila('Subtotal (con IVA)', Number(c.subtotal), FORMATO_MONEDA);
    fila('Descuentos', Number(c.total_descuentos), FORMATO_MONEDA);
    const filaVentaNeta = fila('Venta neta base (sin IVA)', Number(c.base_gravable), FORMATO_MONEDA);
    const filaIva = fila(`IVA (${(Number((parametros as any)?.iva_porcentaje ?? 0.12) * 100).toFixed(0)}%)`, Number(c.iva_monto), FORMATO_MONEDA);
    const filaTotalCot = fila('Total cotizado (con IVA)', Number(c.total_cotizado), FORMATO_MONEDA);
    const filaIsr = fila('Retención ISR', Number(c.isr_retencion), FORMATO_MONEDA);
    const filaIvaRetCalc = filaFormula('Retención IVA (calculada)', `IF(B${filaRetenedor}="Sí",B${filaIva}*B${filaPctRetIva},0)`, FORMATO_MONEDA);
    filaFormula('Pago neto a la empresa (calculado)', `B${filaTotalCot}-B${filaIsr}-B${filaIvaRetCalc}`, FORMATO_MONEDA);
    fila('', '');
    filaVentaNetaRef = `B${filaVentaNeta}`;
    filaIsrRef = `B${filaIsr}`;
  } else {
    fila('Resumen fiscal', 'Disponible solo para Autorizador/Administrador');
    fila('', '');
    filaVentaNetaRef = `${Number(c.base_gravable)}`;
    filaIsrRef = `${Number(c.isr_retencion)}`;
  }

  fila('— Uso interno (utilidad y comisión) —', '');
  const filaCostoProd = fila('Costo total de productos/servicios', Number(c.costo_total_productos), FORMATO_MONEDA);
  const filaGastosOp = fila('Gastos operativos adicionales', Number(c.costos_operativos_total), FORMATO_MONEDA);
  const filaCostoOper = filaFormula('Costo total de operación (calculado)', `B${filaCostoProd}+B${filaGastosOp}`, FORMATO_MONEDA);
  const filaUtilBruta = filaFormula('Utilidad bruta (calculada)', `${filaVentaNetaRef}-B${filaCostoOper}`, FORMATO_MONEDA);
  const filaUtilNeta = filaFormula('Utilidad neta (calculada, base de comisión)', `B${filaUtilBruta}-${filaIsrRef}`, FORMATO_MONEDA);
  filaFormula('% Margen de utilidad neta (calculado)', `IF(${filaVentaNetaRef}=0,0,B${filaUtilNeta}/${filaVentaNetaRef})`, FORMATO_PORCENTAJE);
  fila('Escala de comisión aplicada', c.escala_comision_rango ? `Rango ${c.escala_comision_rango}` : '');
  const filaPctCom = fila('% Comisión al vendedor', Number(c.comision_estimada_pct), FORMATO_PORCENTAJE);
  const filaComision = filaFormula('Comisión estimada/pagada (calculada)', `B${filaUtilNeta}*B${filaPctCom}`, FORMATO_MONEDA);
  filaFormula('Ganancia neta para la empresa (calculada)', `B${filaUtilNeta}-B${filaComision}`, FORMATO_MONEDA);

  const hojaResumen: HojaExcel = {
    nombre: 'Resumen',
    columnas: [
      { header: 'Campo', key: 'campo', tipo: 'texto' },
      { header: 'Valor', key: 'valor', tipo: 'texto' },
    ],
    filas: filasResumen.map((f) => ({ campo: f.campo, valor: f.valor })),
  };

  const libro = construirLibro([hojaResumen, hojaDetalle, hojaCostos]);
  const wsResumen = libro.Sheets['Resumen'];
  // Aplica las fórmulas/formatos reales sobre las celdas de la hoja ya construida,
  // usando los números de fila calculados dinámicamente arriba (fila 1 = encabezado).
  filasResumen.forEach((f, idx) => {
    const filaNum = idx + 2;
    const addr = `B${filaNum}`;
    if (f.formula) {
      wsResumen[addr] = { t: 'n', f: f.formula, z: f.formato };
    } else if (f.formato && wsResumen[addr]) {
      wsResumen[addr].z = f.formato;
    }
  });

  // Hoja "Cotización" — mismo documento que ve el vendedor internamente, con la misma
  // estructura del PDF (encabezado, tarjetas, tabla de ítems con costo/utilidad, totales,
  // resumen financiero, condiciones y firmas). Se agrega como PRIMERA hoja del libro; las
  // hojas "Resumen"/"Detalle"/"Costos operativos" (con fórmulas encadenadas) se conservan
  // después, para quien necesite auditar/recalcular los números.
  const wsCotizacion = construirHojaCotizacion({
    cotizacion: cotizacion as Cotizacion,
    lineas: (lineas ?? []) as any,
    parametros: (parametros ?? null) as ParametrosFiscales,
    plantilla: (plantilla ?? null) as PlantillaCotizacion | null,
    clienteNombre: c.cliente?.nombre_razon ?? c.cliente_nombre_libre ?? 'Consumidor Final',
    clienteNit: c.cliente?.nit ?? c.cliente_nit,
    clienteDireccion: c.cliente?.direccion ?? c.cliente_direccion,
    vendedorNombre: c.vendedor?.nombre_completo ?? '—',
    vendedorCorreo: c.vendedor?.correo ?? null,
  }, { interna: true, puedeVerResumenFiscal });
  XLSX.utils.book_append_sheet(libro, wsCotizacion, 'Cotización');
  libro.SheetNames.unshift(libro.SheetNames.splice(libro.SheetNames.indexOf('Cotización'), 1)[0]);

  const buffer = libroABuffer(libro);
  const base = c.numero_sistema_externo || c.numero_interno || params.id;
  const nombreArchivo = `cotizacion_${String(base).replace(/[^a-zA-Z0-9-]/g, '_')}.xlsx`;
  return respuestaExcel(buffer, nombreArchivo);
  } catch (e) {
    console.error('[excel/interno] fallo inesperado generando el Excel', params.id, e);
    return NextResponse.json({ error: 'No se pudo generar el Excel de esta cotización. Intente de nuevo o contacte a soporte.' }, { status: 500 });
  }
}
