'use server';

import { createClient } from '@/lib/supabase/server';
import { requireSesion } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export async function actualizarProducto(id: string, patch: {
  nombre?: string; costo_unitario?: number; precio_lista?: number; stock_actual?: number; stock_minimo?: number; activo?: boolean;
  imagen_url?: string | null; especificaciones?: string | null;
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
  imagen_url?: string | null; especificaciones?: string | null;
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

// Desglose de a qué cotizaciones (y vendedores) corresponde el "Reservado" de un
// producto — todo lo que aún no llega a Facturado ni Anulado sigue reservando stock,
// pero antes no había forma de ver el detalle desde Inventario, solo el número total.
export async function obtenerReservasProducto(productoId: string) {
  await requireSesion('INVENTARIO_VER');
  const supabase = createClient();
  const { data, error } = await supabase
    .from('cotizacion_detalle')
    .select('cantidad, cotizacion:cotizaciones(numero_interno, numero_sistema_externo, estado, cliente_nombre_libre, cliente:clientes(nombre_razon), vendedor:vendedores(nombre_completo))')
    .eq('producto_id', productoId)
    .not('cotizacion_id', 'is', null);

  if (error) return { error: error.message };

  const filas = (data ?? [])
    .map((f: any) => {
      const c = Array.isArray(f.cotizacion) ? f.cotizacion[0] : f.cotizacion;
      if (!c || c.estado === 'FACTURADO' || c.estado === 'ANULADO') return null;
      const cliente = Array.isArray(c.cliente) ? c.cliente[0] : c.cliente;
      const vendedor = Array.isArray(c.vendedor) ? c.vendedor[0] : c.vendedor;
      return {
        numero: c.numero_sistema_externo || c.numero_interno,
        estado: c.estado as string,
        cliente: cliente?.nombre_razon ?? c.cliente_nombre_libre ?? 'Consumidor Final',
        vendedor: vendedor?.nombre_completo ?? '—',
        cantidad: Number(f.cantidad),
      };
    })
    .filter((f): f is NonNullable<typeof f> => f !== null);

  return { ok: true, reservas: filas };
}

// "Botón de reinicio": recalcula stock_reservado (desde las cotizaciones activas) y
// stock_actual (desde el último movimiento real del kardex) de TODOS los productos, para
// corregir cualquier desajuste — por ejemplo, si algo quedó mal tras pruebas o una edición
// manual. No borra ni modifica cotizaciones, comisiones ni el historial: solo corrige los
// dos números de existencia en app.productos para que vuelvan a cuadrar con la realidad.
export async function recalcularStockInventario() {
  await requireSesion('INVENTARIO_EDITAR');
  const supabase = createClient();
  const { data, error } = await supabase.rpc('recalcular_stock_productos');
  if (error) return { error: error.message };
  const resultado = Array.isArray(data) ? data[0] : data;
  revalidatePath('/inventario');
  revalidatePath('/inventario/kardex');
  return { ok: true, actualizados: resultado?.actualizados ?? 0, sinCambios: resultado?.sin_cambios ?? 0 };
}
