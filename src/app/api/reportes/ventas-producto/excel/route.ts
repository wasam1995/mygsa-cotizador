import { NextRequest } from 'next/server';
import { requireSesion } from '@/lib/auth';
import { obtenerVentasPorProducto } from '@/lib/reportes';
import { construirLibroExcel, respuestaExcel } from '@/lib/excel';
import type { HojaExcel } from '@/lib/excel';

export async function GET(req: NextRequest) {
  const sesion = await requireSesion('REPORTES_VER');
  const sp = req.nextUrl.searchParams;

  const verTodas = sesion.permisos.includes('COMISIONES_VER_TODAS');
  const desde = sp.get('desde') || undefined;
  const hasta = sp.get('hasta') || undefined;
  const vendedorId = verTodas ? (sp.get('vendedor_id') || null) : sesion.vendedorId;

  const { filas } = await obtenerVentasPorProducto({ desde, hasta, vendedorId });

  const hoja: HojaExcel = {
    nombre: 'Ventas por producto',
    columnas: [
      { header: 'Código', key: 'codigo', tipo: 'texto' },
      { header: 'Producto', key: 'nombre', tipo: 'texto' },
      { header: 'Cant. vendida', key: 'cantidad', tipo: 'numero' },
      { header: 'Costo total', key: 'costo_total', tipo: 'moneda' },
      { header: 'Venta total', key: 'venta_total', tipo: 'moneda' },
      { header: 'Utilidad', key: 'utilidad', tipo: 'moneda' },
      { header: 'Margen %', key: 'margen_pct', tipo: 'porcentaje' },
      { header: 'Comisión atribuida', key: 'comision_atribuida', tipo: 'moneda' },
    ],
    filas: filas.map((f) => ({
      codigo: f.codigo, nombre: f.nombre, cantidad: f.cantidad, costo_total: f.costo_total,
      venta_total: f.venta_total, utilidad: f.utilidad, margen_pct: f.margen_pct, comision_atribuida: f.comision_atribuida,
    })),
    totales: ['cantidad', 'costo_total', 'venta_total', 'utilidad', 'comision_atribuida'],
  };

  const buffer = construirLibroExcel([hoja]);
  return respuestaExcel(buffer, 'ventas_del_mes_por_producto.xlsx');
}
