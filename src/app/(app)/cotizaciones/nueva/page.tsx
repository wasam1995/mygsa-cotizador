import { createClient } from '@/lib/supabase/server';
import { requireSesion } from '@/lib/auth';
import CotizadorForm from '@/components/CotizadorForm';
import type { Cliente, EscalaComision, ParametrosFiscales, PlantillaCotizacion, Producto, Vendedor } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function NuevaCotizacionPage() {
  const sesion = await requireSesion('COTIZACIONES_CREAR');
  const supabase = createClient();

  const [{ data: vendedores }, { data: clientes }, { data: productos }, { data: parametros }, { data: escalas }, { data: plantillas }] = await Promise.all([
    supabase.from('vendedores').select('*').eq('activo', true).order('nombre_completo'),
    supabase.from('clientes').select('*').eq('activo', true).order('nombre_razon'),
    supabase.from('v_productos_disponibles').select('*').eq('activo', true).order('nombre'),
    supabase.from('parametros_fiscales').select('*').eq('id', 1).single(),
    supabase.from('escalas_comision').select('*').order('rango'),
    supabase.from('plantillas_cotizacion').select('*').eq('activo', true).order('nombre'),
  ]);

  const esVendedorFijo = sesion.rolCodigo === 'VENDEDOR';
  const vendedorInicial = esVendedorFijo
    ? (vendedores ?? []).find((v) => v.id === sesion.vendedorId) ?? null
    : null;

  return (
    <div>
      <h1 className="mb-5 text-xl font-bold text-slate-800">Nueva cotización</h1>
      <CotizadorForm
        vendedores={(vendedores ?? []) as Vendedor[]}
        clientes={(clientes ?? []) as Cliente[]}
        productos={(productos ?? []) as Producto[]}
        parametros={parametros as ParametrosFiscales}
        escalasComision={(escalas ?? []) as EscalaComision[]}
        plantillas={(plantillas ?? []) as PlantillaCotizacion[]}
        esVendedorFijo={esVendedorFijo}
        vendedorInicial={vendedorInicial as Vendedor | null}
      />
    </div>
  );
}
