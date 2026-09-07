import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { createClient } from '@/lib/supabase/server';
import { requireSesion } from '@/lib/auth';
import { libroABuffer, respuestaExcel } from '@/lib/excel';
import { construirHojaCotizacion } from '@/lib/excelCotizacion';
import type { Cotizacion, ParametrosFiscales, PlantillaCotizacion } from '@/lib/types';

// Excel "versión cliente": una sola hoja que sigue la misma estructura que el PDF de
// cliente (encabezado, tarjetas de cliente/proyecto, tabla de ítems, totales, condiciones,
// firmas) — antes solo existía un Excel genérico de dos columnas (Campo/Valor), que no se
// parecía en nada al documento de la cotización.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  await requireSesion();
  const supabase = createClient();

  // Todo el cuerpo va en try/catch: antes, cualquier tropiezo puntual (una fila de
  // parametros_fiscales que no llega, un error transitorio de red/consulta) tronaba con
  // una excepción no controlada. Como el botón es un <a href> de navegación directa (no
  // un fetch desde React), eso el usuario lo veía como "no me deja descargar" — el
  // navegador simplemente mostraba la página de error de Next en vez de descargar el
  // archivo, sin ningún mensaje útil. Ahora se responde siempre con un JSON de error
  // legible (o el archivo) y se deja rastro en el log del servidor para diagnosticar.
  try {
    const { data: cotizacion, error: errorCotizacion } = await supabase
      .from('cotizaciones')
      .select('*, cliente:clientes(nombre_razon, nit, direccion), vendedor:vendedores(nombre_completo, correo)')
      .eq('id', params.id)
      .single();
    if (errorCotizacion || !cotizacion) {
      if (errorCotizacion) console.error('[excel/cliente] error al leer cotización', params.id, errorCotizacion);
      return NextResponse.json({ error: 'No encontrada' }, { status: 404 });
    }

    const c = cotizacion as any;
    const [{ data: lineas, error: errorLineas }, { data: parametros, error: errorParametros }, { data: plantilla }] = await Promise.all([
      supabase.from('cotizacion_detalle').select('*, producto:productos(unidad)').eq('cotizacion_id', params.id).order('linea'),
      supabase.from('parametros_fiscales').select('*').eq('id', 1).single(),
      c.plantilla_id ? supabase.from('plantillas_cotizacion').select('*').eq('id', c.plantilla_id).single() : Promise.resolve({ data: null, error: null }),
    ]);
    if (errorLineas) console.error('[excel/cliente] error al leer líneas', params.id, errorLineas);
    if (errorParametros) console.error('[excel/cliente] error al leer parametros_fiscales', errorParametros);

    const cli = c.cliente;
    const ven = c.vendedor;

    const libro = XLSX.utils.book_new();
    const ws = construirHojaCotizacion({
      cotizacion: cotizacion as Cotizacion,
      lineas: (lineas ?? []) as any,
      parametros: (parametros ?? null) as ParametrosFiscales,
      plantilla: (plantilla ?? null) as PlantillaCotizacion | null,
      clienteNombre: cli?.nombre_razon ?? c.cliente_nombre_libre ?? 'Consumidor Final',
      clienteNit: cli?.nit ?? c.cliente_nit,
      clienteDireccion: cli?.direccion ?? c.cliente_direccion,
      vendedorNombre: ven?.nombre_completo ?? '—',
      vendedorCorreo: ven?.correo ?? null,
    }, { interna: false });
    XLSX.utils.book_append_sheet(libro, ws, 'Cotización');

    const buffer = libroABuffer(libro);
    const base = c.numero_sistema_externo || c.numero_interno || params.id;
    const nombreArchivo = `cotizacion_${String(base).replace(/[^a-zA-Z0-9-]/g, '_')}.xlsx`;
    return respuestaExcel(buffer, nombreArchivo);
  } catch (e) {
    console.error('[excel/cliente] fallo inesperado generando el Excel', params.id, e);
    return NextResponse.json({ error: 'No se pudo generar el Excel de esta cotización. Intente de nuevo o contacte a soporte.' }, { status: 500 });
  }
}
