import { createClient } from '@/lib/supabase/server';
import { requireSesion } from '@/lib/auth';
import ParametrosClient from './ParametrosClient';
import type { EscalaComision, ParametrosFiscales } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function ParametrosPage() {
  await requireSesion('PARAMETROS_EDITAR');
  const supabase = createClient();
  const [{ data }, { data: escalas }] = await Promise.all([
    supabase.from('parametros_fiscales').select('*').eq('id', 1).single(),
    supabase.from('escalas_comision').select('*').order('rango'),
  ]);

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold text-slate-800">Parámetros del sistema</h1>
      <p className="mb-5 text-sm text-slate-500">
        Configuración fiscal (IVA, tramos de ISR), escala de comisiones, datos de la empresa y leyenda impresa en las cotizaciones.
      </p>
      <ParametrosClient parametros={data as ParametrosFiscales} escalasComision={(escalas ?? []) as EscalaComision[]} />
    </div>
  );
}
