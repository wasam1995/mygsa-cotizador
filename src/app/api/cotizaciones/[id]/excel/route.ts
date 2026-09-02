import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireSesion } from '@/lib/auth';
import { construirLibro, libroABuffer, respuestaExcel, formula, FORMATO_MONEDA, FORMATO_PORCENTAJE } from '@/lib/excel';
import type { HojaExcel } from '@/lib/excel';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  await requireSesion();
  const supabase = createClient();

  const { data: cotizacion } = await supabase
    .from('cotizaciones')
    .select('*, cliente:clientes(nombre_razon, nit), vendedor:vendedores(nombre_completo, codigo)')
    .eq('id', params.id)
    .single();

  if (!cotizacion) return NextResponse.json({ error: 'No encontrada' }, { status: 404 });

  const [{ data: lineas }, { data: costosOperativos }] = await Promise.all([
    supabase.from('cotizacion_detalle').select('*').eq('cotizacion_id', params.id).order('linea'),
    supabase.from('cotizacion_costos_operativos').select('*').eq('cotizacion_id', params.id).order('orden'),
  ]);

  const c = cotizacion as any;
  const esRetenedor = c.cliente_es_retenedor_iva ? 'Sí' : 'No';

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
  // calculadas (Retención IVA condicional, Costo total de operación, Utilidad bruta, %
  // margen, Comisión, Ganancia neta) llevan fórmulas reales que se agregan más abajo,
  // referenciando la celda B8 ("Cliente retenedor de IVA: Sí/No") como ejemplo de
  // cálculo condicional de impuestos.
  const resumenFilas: { campo: string; valor: unknown }[] = [
    { campo: 'No. Interno', valor: c.numero_interno },
    { campo: 'No. ERP', valor: c.numero_sistema_externo ?? '' },
    { campo: 'Fecha emisión', valor: c.fecha_emision },
    { campo: 'Estado', valor: c.estado },
    { campo: 'Cliente', valor: c.cliente?.nombre_razon ?? c.cliente_nombre_libre ?? '' },
    { campo: 'Vendedor', valor: c.vendedor?.nombre_completo ?? '' },
    { campo: 'Cliente retenedor de IVA', valor: esRetenedor }, // fila 8
    { campo: 'Subtotal (con IVA)', valor: Number(c.subtotal) }, // fila 9
    { campo: 'Descuentos', valor: Number(c.total_descuentos) }, // fila 10
    { campo: 'Base gravable (sin IVA)', valor: Number(c.base_gravable) }, // fila 11
    { campo: 'IVA (12%)', valor: Number(c.iva_monto) }, // fila 12
    { campo: 'Total cotizado (con IVA)', valor: Number(c.total_cotizado) }, // fila 13
    { campo: 'Retención ISR', valor: Number(c.isr_retencion) }, // fila 14
    { campo: 'Retención IVA (calculada)', valor: 0 }, // fila 15 — se reemplaza por fórmula
    { campo: 'Pago neto a la empresa (calculado)', valor: 0 }, // fila 16 — fórmula
    { campo: '— Uso interno —', valor: '' }, // fila 17
    { campo: 'Costo total de productos/servicios', valor: Number(c.costo_total_productos) }, // fila 18
    { campo: 'Gastos operativos adicionales', valor: Number(c.costos_operativos_total) }, // fila 19
    { campo: 'Costo total de operación (calculado)', valor: 0 }, // fila 20 — fórmula
    { campo: 'Utilidad bruta (calculada)', valor: 0 }, // fila 21 — fórmula
    { campo: '% Margen de utilidad (calculado)', valor: 0 }, // fila 22 — fórmula
    { campo: 'Escala de comisión aplicada', valor: c.escala_comision_rango ? `Rango ${c.escala_comision_rango}` : '' }, // fila 23
    { campo: '% Comisión al vendedor', valor: Number(c.comision_estimada_pct) }, // fila 24
    { campo: 'Comisión estimada/pagada (calculada)', valor: 0 }, // fila 25 — fórmula
    { campo: 'Ganancia neta para la empresa (calculada)', valor: 0 }, // fila 26 — fórmula
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

  const celdaMoneda = (fila: number) => { const a = `B${fila}`; if (wsResumen[a]) wsResumen[a].z = FORMATO_MONEDA; };
  const celdaPorcentaje = (fila: number) => { const a = `B${fila}`; if (wsResumen[a]) wsResumen[a].z = FORMATO_PORCENTAJE; };
  const celdaFormula = (fila: number, f: string, formato: string) => {
    wsResumen[`B${fila}`] = { t: 'n', f, z: formato };
  };

  [9, 10, 11, 12, 13, 14, 18, 19].forEach(celdaMoneda);
  celdaPorcentaje(24);
  // Cálculo condicional de impuestos: si el cliente es retenedor de IVA (B8 = "Sí"), se
  // retiene el 12% del IVA de la cotización; si no, la retención es 0.
  celdaFormula(15, 'IF(B8="Sí",B12*0.12,0)', FORMATO_MONEDA);
  celdaFormula(16, 'B13-B14-B15', FORMATO_MONEDA);
  celdaFormula(20, 'B18+B19', FORMATO_MONEDA);
  celdaFormula(21, 'B13-B20', FORMATO_MONEDA);
  celdaFormula(22, 'IF(B13=0,0,B21/B13)', FORMATO_PORCENTAJE);
  celdaFormula(25, 'B21*B24', FORMATO_MONEDA);
  celdaFormula(26, 'B21-B25', FORMATO_MONEDA);

  const buffer = libroABuffer(libro);
  const nombreArchivo = `cotizacion_${(c.numero_sistema_externo || c.numero_interno).replace(/[^a-zA-Z0-9-]/g, '_')}.xlsx`;
  return respuestaExcel(buffer, nombreArchivo);
}
