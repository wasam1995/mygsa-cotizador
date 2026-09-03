import { createClient } from '@/lib/supabase/server';
import { requireSesion } from '@/lib/auth';
import ComisionesResultados from './ComisionesResultados';
import type { ComisionCalculada, LiquidacionComision, Vendedor } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function ComisionesPage({
  searchParams,
}: { searchParams: { desde?: string; hasta?: string; vendedor_id?: string } }) {
  const sesion = await requireSesion();
  const supabase = createClient();

  const verTodas = sesion.permisos.includes('COMISIONES_VER_TODAS');
  const puedeLiquidar = sesion.permisos.includes('COMISIONES_LIQUIDAR');

  let query = supabase.from('comisiones_calculadas')
    .select('*, vendedor:vendedores(codigo, nombre_completo), cotizacion:cotizaciones(numero_interno, numero_sistema_externo), liquidacion:liquidaciones_comisiones(numero, estado)')
    .order('fecha_facturacion', { ascending: false });
  if (!verTodas && sesion.vendedorId) query = query.eq('vendedor_id', sesion.vendedorId);
  if (searchParams.desde) query = query.gte('fecha_facturacion', searchParams.desde);
  if (searchParams.hasta) query = query.lte('fecha_facturacion', searchParams.hasta);
  if (verTodas && searchParams.vendedor_id) query = query.eq('vendedor_id', searchParams.vendedor_id);

  let liquidacionesQuery = supabase.from('liquidaciones_comisiones')
    .select('*, vendedor:vendedores(codigo, nombre_completo)')
    .order('creado_en', { ascending: false });
  if (!verTodas && sesion.vendedorId) liquidacionesQuery = liquidacionesQuery.eq('vendedor_id', sesion.vendedorId);

  const [{ data }, { data: vendedoresData }, { data: liquidacionesData }] = await Promise.all([
    query.limit(500),
    verTodas ? supabase.from('vendedores').select('*').eq('activo', true).order('nombre_completo') : Promise.resolve({ data: [] as Vendedor[] }),
    liquidacionesQuery.limit(200),
  ]);
  const comisiones = (data ?? []) as (ComisionCalculada & {
    vendedor: { codigo: string; nombre_completo: string } | null;
    cotizacion: { numero_interno: string; numero_sistema_externo: string | null } | null;
    liquidacion: { numero: string; estado: string } | null;
  })[];
  const vendedores = (vendedoresData ?? []) as Vendedor[];
  const liquidaciones = (liquidacionesData ?? []) as (LiquidacionComision & {
    vendedor: { codigo: string; nombre_completo: string } | null;
  })[];

  return (
    <ComisionesResultados
      comisiones={comisiones}
      vendedores={vendedores}
      liquidaciones={liquidaciones}
      verTodas={verTodas}
      puedeLiquidar={puedeLiquidar}
      vendedorPropioId={sesion.vendedorId}
      searchParams={searchParams}
    />
  );
}
