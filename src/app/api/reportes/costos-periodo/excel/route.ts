import { NextRequest } from 'next/server';
import { requireSesion } from '@/lib/auth';
import { obtenerCostosPorPeriodo, type AgruparCostosPor } from '@/lib/reportes';
import { construirLibroExcel, respuestaExcel } from '@/lib/excel';
import type { HojaExcel } from '@/lib/excel';

export async function GET(req: NextRequest) {
  const sesion = await requireSesion('REPORTES_VER');
  const sp = req.nextUrl.searchParams;

  const verTodas = sesion.permisos.includes('COMISIONES_VER_TODAS');
  const desde = sp.get('desde') || undefined;
  const hasta = sp.get('hasta') || undefined;
  const vendedorId = verTodas ? (sp.get('vendedor_id') || null) : sesion.vendedorId;
  const agrupar: AgruparCostosPor = sp.get('agrupar') === 'vendedor' ? 'vendedor' : 'mes';

  const { filas } = await obtenerCostosPorPeriodo({ desde, hasta, vendedorId, agrupar });

  const hoja: HojaExcel = {
    nombre: 'Costos por período',
    columnas: [
      { header: agrupar === 'mes' ? 'Mes' : 'Vendedor', key: 'etiqueta', tipo: 'texto' },
      { header: 'Cotizaciones', key: 'cotizaciones', tipo: 'entero' },
      { header: 'Costo productos', key: 'costo_productos', tipo: 'moneda' },
      { header: 'Costos operativos', key: 'costos_operativos', tipo: 'moneda' },
      { header: 'Costo total operación', key: 'costo_operacion', tipo: 'moneda' },
      { header: 'Ventas', key: 'venta_total', tipo: 'moneda' },
      { header: 'Utilidad bruta', key: 'utilidad_bruta', tipo: 'moneda' },
      { header: 'Margen %', key: 'margen_pct', tipo: 'porcentaje' },
    ],
    filas: filas.map((f) => ({
      etiqueta: f.etiqueta, cotizaciones: f.cotizaciones, costo_productos: f.costo_productos,
      costos_operativos: f.costos_operativos, costo_operacion: f.costo_operacion,
      venta_total: f.venta_total, utilidad_bruta: f.utilidad_bruta, margen_pct: f.margen_pct,
    })),
    totales: ['cotizaciones', 'costo_productos', 'costos_operativos', 'costo_operacion', 'venta_total', 'utilidad_bruta'],
  };

  const buffer = construirLibroExcel([hoja]);
  return respuestaExcel(buffer, 'costos_por_periodo.xlsx');
}
