import { NextRequest, NextResponse } from 'next/server';
import { requireSesion } from '@/lib/auth';
import { obtenerCostosPorPeriodo, type AgruparCostosPor } from '@/lib/reportes';

export async function GET(req: NextRequest) {
  const sesion = await requireSesion('REPORTES_VER');
  const sp = req.nextUrl.searchParams;

  const verTodas = sesion.permisos.includes('COMISIONES_VER_TODAS');
  const desde = sp.get('desde') || undefined;
  const hasta = sp.get('hasta') || undefined;
  const vendedorId = verTodas ? (sp.get('vendedor_id') || null) : sesion.vendedorId;
  const agrupar: AgruparCostosPor = sp.get('agrupar') === 'vendedor' ? 'vendedor' : 'mes';

  const { filas, totales } = await obtenerCostosPorPeriodo({ desde, hasta, vendedorId, agrupar });

  const encabezados = [agrupar === 'mes' ? 'Mes' : 'Vendedor', 'Cotizaciones', 'Costo productos', 'Costos operativos', 'Costo total operación', 'Ventas', 'Utilidad bruta', 'Margen %'];
  const lineas = filas.map((f) => [
    f.etiqueta.replace(/,/g, ' '), f.cotizaciones, f.costo_productos.toFixed(2), f.costos_operativos.toFixed(2),
    f.costo_operacion.toFixed(2), f.venta_total.toFixed(2), f.utilidad_bruta.toFixed(2), (f.margen_pct * 100).toFixed(1),
  ].join(','));
  lineas.push([
    'TOTAL', totales.cotizaciones, totales.costo_productos.toFixed(2), totales.costos_operativos.toFixed(2),
    totales.costo_operacion.toFixed(2), totales.venta_total.toFixed(2), totales.utilidad_bruta.toFixed(2), (totales.margen_pct * 100).toFixed(1),
  ].join(','));

  const csv = '﻿' + [encabezados.join(','), ...lineas].join('\n');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="costos_por_periodo.csv"`,
    },
  });
}
