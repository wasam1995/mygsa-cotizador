import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireSesion } from '@/lib/auth';
import DetalleClient from './DetalleClient';
import type { Cotizacion, CotizacionAdjunto, CotizacionCostoOperativo, CotizacionDetalle, CotizacionHistorialEstado, ParametrosFiscales } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function CotizacionDetallePage({ params }: { params: { id: string } }) {
  const sesion = await requireSesion();
  const supabase = createClient();

  const { data: cotizacion } = await supabase
    .from('cotizaciones')
    .select('*, cliente:clientes(nombre_razon, nit, direccion, contacto), vendedor:vendedores(nombre_completo, correo)')
    .eq('id', params.id)
    .single();

  if (!cotizacion) notFound();

  const [{ data: lineas }, { data: historial }, { data: adjuntos }, { data: parametros }, { data: costosOperativos }] = await Promise.all([
    supabase.from('cotizacion_detalle').select('*, producto:productos(imagen_url)').eq('cotizacion_id', params.id).order('linea'),
    supabase.from('cotizacion_historial_estados').select('*').eq('cotizacion_id', params.id).order('creado_en'),
    supabase.from('cotizacion_adjuntos').select('*').eq('cotizacion_id', params.id).order('creado_en'),
    supabase.from('parametros_fiscales').select('*').eq('id', 1).single(),
    supabase.from('cotizacion_costos_operativos').select('*').eq('cotizacion_id', params.id).order('orden'),
  ]);

  const cli = (cotizacion as any).cliente;
  const ven = (cotizacion as any).vendedor;

  return (
    <DetalleClient
      cotizacion={cotizacion as Cotizacion}
      lineas={(lineas ?? []) as CotizacionDetalle[]}
      historial={(historial ?? []) as CotizacionHistorialEstado[]}
      adjuntos={(adjuntos ?? []) as CotizacionAdjunto[]}
      costosOperativos={(costosOperativos ?? []) as CotizacionCostoOperativo[]}
      parametros={parametros as ParametrosFiscales}
      permisos={sesion.permisos}
      esCreador={cotizacion.creado_por === sesion.userId}
      clienteNombre={cli?.nombre_razon ?? cotizacion.cliente_nombre_libre ?? 'Consumidor Final'}
      clienteNit={cli?.nit ?? cotizacion.cliente_nit}
      clienteDireccion={cli?.direccion ?? cotizacion.cliente_direccion}
      clienteContacto={cli?.contacto ?? null}
      vendedorNombre={ven?.nombre_completo ?? '—'}
      vendedorCorreo={ven?.correo ?? null}
    />
  );
}
