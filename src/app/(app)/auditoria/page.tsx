import { createClient } from '@/lib/supabase/server';
import { requireSesion } from '@/lib/auth';
import AuditoriaClient from './AuditoriaClient';
import type { AuditoriaRegistro } from '@/lib/types';

export const dynamic = 'force-dynamic';

const TABLAS_AUDITADAS = ['cotizaciones', 'productos', 'clientes', 'vendedores', 'usuarios', 'roles'];

export default async function AuditoriaPage({
  searchParams,
}: { searchParams: { tabla?: string; accion?: string; desde?: string; hasta?: string } }) {
  await requireSesion('AUDITORIA_VER');
  const supabase = createClient();

  let query = supabase.from('auditoria').select('*').order('creado_en', { ascending: false });
  if (searchParams.tabla) query = query.eq('tabla', searchParams.tabla);
  if (searchParams.accion) query = query.eq('accion', searchParams.accion);
  if (searchParams.desde) query = query.gte('creado_en', `${searchParams.desde}T00:00:00`);
  if (searchParams.hasta) query = query.lte('creado_en', `${searchParams.hasta}T23:59:59`);

  const { data } = await query.limit(500);
  const registros = (data ?? []) as AuditoriaRegistro[];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="page-title">Bitácora de auditoría</h1>
        <p className="text-sm text-slate-500">Quién creó, modificó o eliminó cada registro clave del sistema (cotizaciones, productos, clientes, vendedores, usuarios y roles).</p>
      </div>

      <form className="card flex flex-wrap items-end gap-3" action="/auditoria">
        <div>
          <label className="label">Tabla</label>
          <select name="tabla" defaultValue={searchParams.tabla ?? ''} className="input max-w-[200px]">
            <option value="">Todas</option>
            {TABLAS_AUDITADAS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Acción</label>
          <select name="accion" defaultValue={searchParams.accion ?? ''} className="input max-w-[160px]">
            <option value="">Todas</option>
            <option value="INSERT">Creación</option>
            <option value="UPDATE">Modificación</option>
            <option value="DELETE">Eliminación</option>
          </select>
        </div>
        <div><label className="label">Desde</label><input type="date" name="desde" defaultValue={searchParams.desde} className="input" /></div>
        <div><label className="label">Hasta</label><input type="date" name="hasta" defaultValue={searchParams.hasta} className="input" /></div>
        <button className="btn btn-primary">Filtrar</button>
      </form>

      <AuditoriaClient registros={registros} />
    </div>
  );
}
