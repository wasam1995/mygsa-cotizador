import { createClient } from '@/lib/supabase/server';
import { requireSesion } from '@/lib/auth';
import PlantillasClient from './PlantillasClient';
import type { PlantillaCotizacion } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function PlantillasPage() {
  await requireSesion('PLANTILLAS_EDITAR');
  const supabase = createClient();
  const { data } = await supabase.from('plantillas_cotizacion').select('*').order('nombre');

  return (
    <div>
      <h1 className="mb-1 page-title">Plantillas de cotización</h1>
      <p className="mb-5 text-sm text-slate-500">
        Condiciones comerciales y leyenda de pie de página que se imprimen en la cotización para el cliente. Puede tener varias
        plantillas (por ejemplo para distintos tipos de proyecto); la marcada como predeterminada es la que se usa al crear una
        cotización nueva si no se elige otra.
      </p>
      <PlantillasClient plantillas={(data ?? []) as PlantillaCotizacion[]} />
    </div>
  );
}
