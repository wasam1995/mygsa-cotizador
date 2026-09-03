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
  const supabase = createClient();

  const { data: cotizacion } = await supabase
    .from('cotizaciones')
    .select('*, cliente:clientes(nombre_razon, nit, direccion), vendedor:vendedores(nombre_completo, codigo, correo)')
    .eq('id', params.id)
    .single();

  if (!cotizacion) return NextResponse.json({ error: 'No encontrada' }, { status: 404 });

  const [{ data: lineas }, { data: costosOperativos }, { data: parametros }, { data: plantilla }] = await Promise.all([
    supabase.from('cotizacion_detalle').select('*, producto:productos(unidad)').eq('cotizacion_id', params.id).order('linea'),
    supabase.from('cotizacion_costos_operativos').select('*').eq('cotizacion_id', params.id).order('orden'),
    supabase.from('parametros_fiscales').select('*').eq('id', 1).single(),
    (cotizacion as any).plantilla_id
      ? supabase.from('plantillas_cotizacion').select('*').eq('id', (cotizacion as any).plantilla_id).single()
      : Promise.resolve({ data: null }),
  ]);

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
  // Utilidad neta, % margen, Comisión, Ganancia neta) llevan fórmulas reales que se
  // agregan más abajo, referenciando la celda B8 ("Cliente retenedor de IVA: Sí/No")
  // como ejemplo de cálculo condicional de impuestos. Modelo financiero Etapa 5:
  // Utilidad Bruta = Venta Neta Base (sin IVA) - Costo de operación; Utilidad Neta =
  // Utilidad Bruta - ISR (base real de la comisión).
  const resumenFilas: { campo: string; valor: unknown }[] = [
    { campo: 'No. Interno', valor: c.numero_interno },
    { campo: 'No. ERP', valor: c.numero_sistema_externo ?? '' },
    { campo: 'Fecha emisión', valor: c.fecha_emision },
    { campo: 'Estado', valor: c.estado },
    { campo: 'Cliente', valor: c.cliente?.nombre_razon ?? c.cliente_nombre_libre ?? '' },
    { campo: 'Vendedor', valor: c.vendedor?.nombre_completo ?? '' },
    { campo: 'Cliente retenedor de IVA', valor: esRetenedor }, // fila 8
    { campo: '% Retención de IVA (parametrizado)', valor: retencionIvaPct }, // fila 9
    { campo: 'Subtotal (con IVA)', valor: Number(c.subtotal) }, // fila 10
    { campo: 'Descuentos', valor: Number(c.total_descuentos) }, // fila 11
    { campo: 'Venta neta base (sin IVA)', valor: Number(c.base_gravable) }, // fila 12
    { campo: `IVA (${(Number((parametros as any)?.iva_porcentaje ?? 0.12) * 100).toFixed(0)}%)`, valor: Number(c.iva_monto) }, // fila 13
    { campo: 'Total cotizado (con IVA)', valor: Number(c.total_cotizado) }, // fila 14
    { campo: 'Retención ISR', valor: Number(c.isr_retencion) }, // fila 15
    { campo: 'Retención IVA (calculada)', valor: 0 }, // fila 16 — se reemplaza por fórmula
    { campo: 'Pago neto a la empresa (calculado)', valor: 0 }, // fila 17 — fórmula
    { campo: '— Uso interno —', valor: '' }, // fila 18
    { campo: 'Costo total de productos/servicios', valor: Number(c.costo_total_productos) }, // fila 19
    { campo: 'Gastos operativos adicionales', valor: Number(c.costos_operativos_total) }, // fila 20
    { campo: 'Costo total de operación (calculado)', valor: 0 }, // fila 21 — fórmula
    { campo: 'Utilidad bruta (calculada)', valor: 0 }, // fila 22 — fórmula
    { campo: 'Utilidad neta (calculada, base de comisión)', valor: 0 }, // fila 23 — fórmula
    { campo: '% Margen de utilidad neta (calculado)', valor: 0 }, // fila 24 — fórmula
    { campo: 'Escala de comisión aplicada', valor: c.escala_comision_rango ? `Rango ${c.escala_comision_rango}` : '' }, // fila 25
    { campo: '% Comisión al vendedor', valor: Number(c.comision_estimada_pct) }, // fila 26
    { campo: 'Comisión estimada/pagada (calculada)', valor: 0 }, // fila 27 — fórmula
    { campo: 'Ganancia neta para la empresa (calculada)', valor: 0 }, // fila 28 — fórmula
  ];

  const hojaResumen: HojaExcel = {
    nombre: 'Resumen',
    columnas: [
      { header: 'Campo', key: 'campo', tipo: 'texto' },
      { header: 'Valor', key: 'valor', tipo: 'texto' },
    ],
    filas: resumenFilas.map((f) => ({ campo: f.campo, valor: f.valor })),
  };

  const libro = construirLibro([hojaResumen, hojaDetalle, hojaCostos]);
  const wsResumen = libro.Sheets['Resumen'];

  // Hoja "Cotización" — mismo documento que ve el vendedor internamente, con la misma
  // estructura del PDF (encabezado, tarjetas, tabla de ítems con costo/utilidad, totales,
  // resumen financiero, condiciones y firmas). Se agrega como PRIMERA hoja del libro; las
  // hojas "Resumen"/"Detalle"/"Costos operativos" (con fórmulas encadenadas) se conservan
  // después, para quien necesite auditar/recalcular los números.
  const wsCotizacion = construirHojaCotizacion({
    cotizacion: cotizacion as Cotizacion,
    lineas: (lineas ?? []) as any,
    parametros: parametros as ParametrosFiscales,
    plantilla: (plantilla ?? null) as PlantillaCotizacion | null,
    clienteNombre: c.cliente?.nombre_razon ?? c.cliente_nombre_libre ?? 'Consumidor Final',
    clienteNit: c.cliente?.nit ?? c.cliente_nit,
    clienteDireccion: c.cliente?.direccion ?? c.cliente_direccion,
    vendedorNombre: c.vendedor?.nombre_completo ?? '—',
    vendedorCorreo: c.vendedor?.correo ?? null,
  }, { interna: true });
  XLSX.utils.book_append_sheet(libro, wsCotizacion, 'Cotización');
  libro.SheetNames.unshift(libro.SheetNames.splice(libro.SheetNames.indexOf('Cotización'), 1)[0]);

  const celdaMoneda = (fila: number) => { const a = `B${fila}`; if (wsResumen[a]) wsResumen[a].z = FORMATO_MONEDA; };
  const celdaPorcentaje = (fila: number) => { const a = `B${fila}`; if (wsResumen[a]) wsResumen[a].z = FORMATO_PORCENTAJE; };
  const celdaFormula = (fila: number, f: string, formato: string) => {
    wsResumen[`B${fila}`] = { t: 'n', f, z: formato };
  };

  [10, 11, 12, 13, 14, 15, 19, 20].forEach(celdaMoneda);
  celdaPorcentaje(9);
  celdaPorcentaje(26);
  // Cálculo condicional de impuestos: si el cliente es retenedor de IVA (B8 = "Sí"), se
  // retiene el % parametrizado (B9) del IVA de la cotización; si no, la retención es 0.
  celdaFormula(16, 'IF(B8="Sí",B13*B9,0)', FORMATO_MONEDA);
  celdaFormula(17, 'B14-B15-B16', FORMATO_MONEDA);
  celdaFormula(21, 'B19+B20', FORMATO_MONEDA);
  celdaFormula(22, 'B12-B21', FORMATO_MONEDA); // Utilidad bruta = venta neta base - costo operación
  celdaFormula(23, 'B22-B15', FORMATO_MONEDA); // Utilidad neta = utilidad bruta - ISR
  celdaFormula(24, 'IF(B12=0,0,B23/B12)', FORMATO_PORCENTAJE);
  celdaFormula(27, 'B23*B26', FORMATO_MONEDA); // Comisión = utilidad neta x % de la escala
  celdaFormula(28, 'B23-B27', FORMATO_MONEDA);

  const buffer = libroABuffer(libro);
  const nombreArchivo = `cotizacion_${(c.numero_sistema_externo || c.numero_interno).replace(/[^a-zA-Z0-9-]/g, '_')}.xlsx`;
  return respuestaExcel(buffer, nombreArchivo);
}
