import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireSesion } from '@/lib/auth';
import CotizadorForm from '@/components/CotizadorForm';
import type { Cliente, Cotizacion, CotizacionCostoOperativo, CotizacionDetalle, EscalaComision, ParametrosFiscales, PlantillaCotizacion, Producto, Vendedor } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function EditarCotizacionPage({ params }: { params: { id: string } }) {
  const sesion = await requireSesion();
  const supabase = createClient();

  const { data: cotizacion } = await supabase.from('cotizaciones').select('*').eq('id', params.id).single();
  if (!cotizacion) notFound();

  const esDueno = cotizacion.vendedor_id === sesion.vendedorId;
  const puedeGestionarTodas = sesion.permisos.includes('COTIZACIONES_VER_TODAS');
  if (cotizacion.estado === 'FACTURADO' && !puedeGestionarTodas) {
    redirect(`/cotizaciones/${params.id}`);
  }
  if (cotizacion.estado !== 'FACTURADO' && !esDueno && !puedeGestionarTodas) {
    redirect(`/cotizaciones/${params.id}`);
  }

  const [{ data: lineas }, { data: costosOperativos }, { data: vendedores }, { data: clientes }, { data: productos }, { data: parametros }, { data: escalas }, { data: plantillas }] = await Promise.all([
    supabase.from('cotizacion_detalle').select('*').eq('cotizacion_id', params.id).order('linea'),
    supabase.from('cotizacion_costos_operativos').select('*').eq('cotizacion_id', params.id).order('orden'),
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
      <h1 className="mb-5 page-title">Modificar cotización {cotizacion.numero_interno}</h1>
      {cotizacion.estado === 'FACTURADO' && (
        <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Esta cotización ya está facturada — el inventario real ya se rebajó. Al guardar los cambios, el sistema
          ajustará automáticamente la existencia solo por la <b>diferencia</b> entre las cantidades que tenía y las
          nuevas (por producto) y lo dejará registrado en el kardex como un movimiento de tipo &quot;Ajuste&quot;.
        </div>
      )}
      <CotizadorForm
        vendedores={(vendedores ?? []) as Vendedor[]}
        clientes={(clientes ?? []) as Cliente[]}
        productos={(productos ?? []) as Producto[]}
        parametros={parametros as ParametrosFiscales}
        escalasComision={(escalas ?? []) as EscalaComision[]}
        plantillas={(plantillas ?? []) as PlantillaCotizacion[]}
        esVendedorFijo={esVendedorFijo}
        vendedorInicial={vendedorInicial as Vendedor | null}
        cotizacionExistente={{
          cotizacion: cotizacion as Cotizacion,
          lineas: (lineas ?? []) as CotizacionDetalle[],
          costosOperativos: (costosOperativos ?? []) as CotizacionCostoOperativo[],
        }}
      />
    </div>
  );
}
