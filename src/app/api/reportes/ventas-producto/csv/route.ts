import { NextRequest, NextResponse } from 'next/server';
import { requireSesion } from '@/lib/auth';
import { obtenerVentasPorProducto } from '@/lib/reportes';

export async function GET(req: NextRequest) {
  const sesion = await requireSesion('REPORTES_VER');
  const sp = req.nextUrl.searchParams;

  const verTodas = sesion.permisos.includes('COMISIONES_VER_TODAS');
  const desde = sp.get('desde') || undefined;
  const hasta = sp.get('hasta') || undefined;
  const vendedorId = verTodas ? (sp.get('vendedor_id') || null) : sesion.vendedorId;

  const { filas, totales } = await obtenerVentasPorProducto({ desde, hasta, vendedorId });

  const encabezados = ['Código', 'Producto', 'Cant. vendida', 'Costo total', 'Venta total', 'Utilidad', 'Margen %', 'Comisión atribuida'];
  const lineas = filas.map((f) => [
    f.codigo.replace(/,/g, ' '), f.nombre.replace(/,/g, ' '), f.cantidad,
    f.costo_total.toFixed(2), f.venta_total.toFixed(2), f.utilidad.toFixed(2),
    (f.margen_pct * 100).toFixed(1), f.comision_atribuida.toFixed(2),
  ].join(','));
  lineas.push([
    'TOTAL', '', totales.cantidad, totales.costo_total.toFixed(2), totales.venta_total.toFixed(2),
    totales.utilidad.toFixed(2), (totales.margen_pct * 100).toFixed(1), totales.comision_atribuida.toFixed(2),
  ].join(','));

  const csv = '﻿' + [encabezados.join(','), ...lineas].join('\n');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="ventas_del_mes_por_producto.csv"`,
    },
  });
}
