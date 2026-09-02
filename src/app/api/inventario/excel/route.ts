import { createClient } from '@/lib/supabase/server';
import { requireSesion } from '@/lib/auth';
import { construirLibroExcel, respuestaExcel } from '@/lib/excel';
import type { HojaExcel } from '@/lib/excel';

export async function GET() {
  await requireSesion('INVENTARIO_VER');
  const supabase = createClient();

  const { data } = await supabase.from('v_productos_disponibles').select('*').order('codigo');

  const filas = (data ?? []).map((p: any) => ({
    codigo: p.codigo,
    nombre: p.nombre,
    color_variante: p.color_variante ?? '',
    unidad: p.unidad,
    costo_unitario: Number(p.costo_unitario),
    precio_lista: Number(p.precio_lista),
    stock_actual: Number(p.stock_actual),
    stock_reservado: Number(p.stock_reservado),
    stock_disponible: Number(p.stock_disponible),
    stock_minimo: Number(p.stock_minimo),
    activo: p.activo ? 'Sí' : 'No',
    especificaciones: p.especificaciones ?? '',
  }));

  const hoja: HojaExcel = {
    nombre: 'Inventario',
    columnas: [
      { header: 'Código', key: 'codigo', tipo: 'texto' },
      { header: 'Nombre', key: 'nombre', tipo: 'texto' },
      { header: 'Color / variante', key: 'color_variante', tipo: 'texto' },
      { header: 'Unidad', key: 'unidad', tipo: 'texto' },
      { header: 'Costo unitario', key: 'costo_unitario', tipo: 'moneda' },
      { header: 'Precio lista', key: 'precio_lista', tipo: 'moneda' },
      { header: 'Stock actual', key: 'stock_actual', tipo: 'entero' },
      { header: 'Stock reservado', key: 'stock_reservado', tipo: 'entero' },
      { header: 'Stock disponible', key: 'stock_disponible', tipo: 'entero' },
      { header: 'Stock mínimo', key: 'stock_minimo', tipo: 'entero' },
      { header: 'Activo', key: 'activo', tipo: 'texto' },
      { header: 'Especificaciones', key: 'especificaciones', tipo: 'texto' },
    ],
    filas,
    totales: ['stock_actual', 'stock_disponible'],
  };

  const buffer = construirLibroExcel([hoja]);
  return respuestaExcel(buffer, 'inventario.xlsx');
}
