'use server';

import { createClient } from '@/lib/supabase/server';
import { requireSesion } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

// Elimina un registro individual del kardex (app.movimientos_inventario). Pensado para
// limpiar movimientos que quedaron de pruebas — esta tabla es solo un historial, no
// existe ningún trigger que reaccione a su DELETE, así que borrar una fila aquí deja
// intacto el stock_actual/stock_reservado de app.productos: solo desaparece el registro
// del historial. La base de datos (RLS) exige el permiso INVENTARIO_ELIMINAR_KARDEX,
// otorgado por defecto solo a Administrador — más restringido que el resto de Inventario
// por ser una acción irreversible sobre un registro de auditoría. El contenido completo
// de la fila borrada queda conservado en la bitácora general (app.auditoria).
export async function eliminarMovimientoKardex(id: string) {
  await requireSesion('INVENTARIO_ELIMINAR_KARDEX');
  const supabase = createClient();
  const { error } = await supabase.from('movimientos_inventario').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/inventario/kardex');
  revalidatePath('/inventario');
  return { ok: true };
}
