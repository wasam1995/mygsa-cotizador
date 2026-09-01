'use server';

import { createClient } from '@/lib/supabase/server';
import { requireSesion } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export async function actualizarProducto(id: string, patch: {
  nombre?: string; costo_unitario?: number; precio_lista?: number; stock_actual?: number; stock_minimo?: number; activo?: boolean;
}) {
  await requireSesion('INVENTARIO_EDITAR');
  const supabase = createClient();
  const { error } = await supabase.from('productos').update(patch).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/inventario');
  return { ok: true };
}

export async function crearProducto(payload: {
  codigo: string; nombre: string; color_variante: string | null; unidad: string;
  costo_unitario: number; precio_lista: number; stock_actual: number;
}) {
  const sesion = await requireSesion('INVENTARIO_EDITAR');
  const supabase = createClient();
  const { error } = await supabase.from('productos').insert(payload);
  if (error) return { error: error.message };

  if (payload.stock_actual > 0) {
    const { data: prod } = await supabase.from('productos').select('id').eq('codigo', payload.codigo).single();
    if (prod) {
      await supabase.from('movimientos_inventario').insert({
        producto_id: prod.id, tipo: 'ENTRADA', cantidad: payload.stock_actual,
        stock_resultante: payload.stock_actual, comentario: 'Alta de producto', creado_por: sesion.userId,
      });
    }
  }
  revalidatePath('/inventario');
  return { ok: true };
}

export async function registrarEntradaInventario(productoId: string, cantidad: number, comentario: string) {
  const sesion = await requireSesion('INVENTARIO_EDITAR');
  const supabase = createClient();
  const { data: producto } = await supabase.from('productos').select('stock_actual').eq('id', productoId).single();
  if (!producto) return { error: 'Producto no encontrado.' };
  const nuevoStock = Number(producto.stock_actual) + cantidad;

  const { error } = await supabase.from('productos').update({ stock_actual: nuevoStock }).eq('id', productoId);
  if (error) return { error: error.message };

  await supabase.from('movimientos_inventario').insert({
    producto_id: productoId, tipo: 'ENTRADA', cantidad, stock_resultante: nuevoStock,
    comentario, creado_por: sesion.userId,
  });
  revalidatePath('/inventario');
  revalidatePath('/inventario/kardex');
  return { ok: true };
}
