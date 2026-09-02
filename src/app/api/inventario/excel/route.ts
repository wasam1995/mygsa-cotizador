import { createClient } from '@/lib/supabase/server';
import { requireSesion } from '@/lib/auth';
import { construirLibroExcel, respuestaExcel } from '@/lib/excel';

export async function GET() {
  await requireSesion('INVENTARIO_VER');
  const supabase = createClient();

  const { data } = await supabase.from('v_productos_disponibles').select('*').order('codigo');

  const filas = (data ?? []).map((p: any) => ({
    Código: p.codigo,
    Nombre: p.nombre,
    'Color / variante': p.color_variante ?? '',
    Unidad: p.unidad,
    'Costo unitario': Number(p.costo_unitario),
    'Precio lista': Number(p.precio_lista),
    'Stock actual': Number(p.stock_actual),
    'Stock reservado': Number(p.stock_reservado),
    'Stock disponible': Number(p.stock_disponible),
    'Stock mínimo': Number(p.stock_minimo),
    Activo: p.activo ? 'Sí' : 'No',
    Especificaciones: p.especificaciones ?? '',
  }));

  const buffer = construirLibroExcel([{ nombre: 'Inventario', filas }]);
  return respuestaExcel(buffer, 'inventario.xlsx');
}
