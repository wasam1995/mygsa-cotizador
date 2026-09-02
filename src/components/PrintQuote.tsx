import { formatQ, formatFecha } from '@/lib/utils';
import type { Cotizacion, CotizacionDetalle, ParametrosFiscales, PlantillaCotizacion } from '@/lib/types';

type LineaConFoto = CotizacionDetalle & { producto?: { imagen_url: string | null; unidad?: string | null } | null };

// Condiciones comerciales / leyenda por defecto — se usan solo como respaldo para
// cotizaciones antiguas que quedaron sin plantilla asignada (antes de la Etapa 4).
const CONDICIONES_DEFECTO = [
  'Precios expresados en Quetzales (Q) e incluyen IVA.',
  'Vigencia de esta cotización: según los días de vigencia configurados a partir de la fecha de emisión.',
  'Número de referencia de pedido / cotización: el indicado en el encabezado de este documento.',
  'Precios sujetos a cambio sin previo aviso una vez vencida la vigencia indicada.',
];

export default function PrintQuote({
  cotizacion, lineas, parametros, plantilla, clienteNombre, clienteNit, clienteDireccion, clienteContacto,
  vendedorNombre, vendedorCorreo,
}: {
  cotizacion: Cotizacion;
  lineas: LineaConFoto[];
  parametros: ParametrosFiscales;
  plantilla: PlantillaCotizacion | null;
  clienteNombre: string;
  clienteNit: string | null;
  clienteDireccion: string | null;
  clienteContacto: string | null;
  vendedorNombre: string;
  vendedorCorreo: string | null;
}) {
  const anulada = cotizacion.estado === 'ANULADO';
  const mostrarPrecios = cotizacion.mostrar_precios_unitarios_cliente;
  const mostrarVendedor = cotizacion.mostrar_vendedor_cliente;

  const primario = parametros.color_primario || '#0f172a';
  const acento = parametros.color_acento || '#f97316';
  const acentoOscuro = parametros.color_acento_oscuro || '#ea580c';
  const fondo = parametros.color_fondo || '#f8fafc';
  const fondoAlterno = parametros.color_fondo_alterno || '#fff7ed';
  const borde = parametros.color_borde || '#e2e8f0';
  const tipografia = parametros.tipografia || 'Helvetica Neue, Arial, ui-sans-serif, sans-serif';

  const condiciones = (plantilla?.condiciones_comerciales?.trim()
    ? plantilla.condiciones_comerciales.split('\n').map((l) => l.trim()).filter(Boolean)
    : CONDICIONES_DEFECTO);
  const leyendaPie = plantilla?.leyenda_pie?.trim() || parametros.leyenda_cotizacion;
  const tituloTabla = plantilla?.titulo_tabla_items || 'DETALLE DE PRODUCTOS Y SERVICIOS';
  const firmaEmisor = plantilla?.texto_firma_emisor || 'Autorizado por (Asesor)';
  const firmaCliente = plantilla?.texto_firma_cliente || 'Aceptado por (Cliente / Fecha)';
  const apartados = plantilla?.apartados ?? [];

  return (
    <div
      className="print-area relative mx-auto max-w-3xl overflow-hidden rounded-2xl border shadow-card print:rounded-none print:border-0 print:shadow-none"
      style={{ fontFamily: tipografia, borderColor: borde, backgroundColor: '#ffffff', fontSize: '9pt', lineHeight: 1.5 }}
    >
      {anulada && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <span className="rotate-[-25deg] border-4 border-red-500 px-8 py-2 text-4xl font-black tracking-widest text-red-500/70">
            ANULADA
          </span>
        </div>
      )}

      {/* Banner superior decorativo con degradado corporativo */}
      <div className="h-3 w-full" style={{ background: `linear-gradient(90deg, ${primario}, ${acento})` }} />

      <div className="p-8">
        {/* Cabecera dual: emisor a la izquierda, folio/fecha/validez/moneda a la derecha */}
        <div className="flex items-start justify-between border-b pb-4" style={{ borderColor: borde }}>
          <div className="flex items-start gap-3">
            {parametros.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={parametros.logo_url} alt={parametros.nombre_comercial || parametros.razon_social} className="h-14 max-w-[10rem] object-contain" />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-xl text-lg font-bold text-white" style={{ backgroundColor: primario }}>MG</div>
            )}
            <div>
              <p className="font-bold" style={{ color: primario, fontSize: '11pt' }}>{parametros.nombre_comercial || parametros.razon_social}</p>
              <p className="text-slate-500">{parametros.direccion_empresa}</p>
              <p className="text-slate-500">{parametros.telefono_empresa} · {parametros.correo_empresa}</p>
            </div>
          </div>
          <div className="text-right">
            <h1 className="font-bold tracking-tight" style={{ color: acentoOscuro, fontSize: '22pt' }}>COTIZACIÓN</h1>
            <p className="text-slate-500">Folio: <b style={{ color: acento }}>{cotizacion.numero_sistema_externo || cotizacion.numero_interno}</b></p>
            <p className="text-slate-500">Fecha: {formatFecha(cotizacion.fecha_emision)}</p>
            <p className="text-slate-500">Válida hasta: {formatFecha(cotizacion.fecha_vencimiento)}</p>
            <p className="text-slate-500">Moneda: Quetzales (GTQ)</p>
            {mostrarVendedor && (
              <p className="text-slate-500">Vendedor: {vendedorNombre}{cotizacion.vendedor_telefono ? ` · ${cotizacion.vendedor_telefono}` : ''}{vendedorCorreo ? ` · ${vendedorCorreo}` : ''}</p>
            )}
          </div>
        </div>

        {/* Tarjetas de información en doble columna */}
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="rounded-xl p-3" style={{ backgroundColor: fondo }}>
            <p className="mb-1 font-bold uppercase tracking-wide" style={{ color: primario, fontSize: '8pt' }}>Información del cliente</p>
            <p><span className="font-semibold">Nombre:</span> {clienteNombre}</p>
            <p><span className="font-semibold">Dirección:</span> {clienteDireccion || '—'}</p>
            <p><span className="font-semibold">Teléfono:</span> {cotizacion.cliente_telefono || '—'}</p>
            {clienteNit && <p><span className="font-semibold">NIT:</span> {clienteNit}</p>}
            {clienteContacto && <p><span className="font-semibold">Atención:</span> {clienteContacto}</p>}
          </div>
          <div className="rounded-xl p-3" style={{ backgroundColor: fondo }}>
            <p className="mb-1 font-bold uppercase tracking-wide" style={{ color: primario, fontSize: '8pt' }}>Detalles del proyecto / visita técnica</p>
            <p className="whitespace-pre-line text-slate-600">{cotizacion.comentario || 'Sin observaciones adicionales.'}</p>
          </div>
        </div>

        {/* Cuadro de presentación institucional */}
        {plantilla?.texto_institucional && (
          <div className="mt-4 rounded-r-lg border-l-4 p-3" style={{ borderColor: acento, backgroundColor: fondo }}>
            <p className="text-slate-600">{plantilla.texto_institucional}</p>
          </div>
        )}

        {/* Tabla de ítems */}
        <p className="mb-2 mt-5 font-bold uppercase tracking-wide" style={{ color: primario, fontSize: '9pt' }}>{tituloTabla}</p>
        <table className="w-full">
          <thead>
            <tr className="border-b-2 text-left uppercase text-slate-500" style={{ borderColor: acento, fontSize: '7.5pt' }}>
              <th className="w-12 py-2">Foto</th>
              <th className="py-2">Descripción</th>
              <th className="py-2 text-right">Cant.</th>
              <th className="py-2 text-right">Unidad</th>
              {mostrarPrecios && <th className="py-2 text-right">Precio</th>}
              {mostrarPrecios && <th className="py-2 text-right">Total</th>}
            </tr>
          </thead>
          <tbody>
            {lineas.map((l) => {
              const foto = l.incluir_foto ? l.producto?.imagen_url : null;
              return (
                <tr key={l.id} className="border-b" style={{ borderColor: borde }}>
                  <td className="py-2">
                    {foto ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={foto} alt={l.descripcion} className="h-[50px] w-[50px] rounded object-cover" />
                    ) : (
                      <div className="h-[50px] w-[50px] rounded" style={{ backgroundColor: fondo }} />
                    )}
                  </td>
                  <td className="py-2 pr-2">{l.descripcion}</td>
                  <td className="py-2 text-right">{l.cantidad}</td>
                  <td className="py-2 text-right text-slate-500">{l.producto?.unidad || 'unidad'}</td>
                  {mostrarPrecios && <td className="py-2 text-right">{formatQ(l.precio_unitario)}</td>}
                  {mostrarPrecios && <td className="py-2 text-right font-medium">{formatQ(l.subtotal_linea)}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
        {!mostrarPrecios && (
          <p className="mt-2 text-right italic text-slate-400" style={{ fontSize: '8pt' }}>
            Precios detallados por artículo omitidos — se muestra el precio total del paquete.
          </p>
        )}

        {/* Totales alineados a la derecha */}
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:justify-between">
          <div className="max-w-xs rounded-lg border-l-4 border-emerald-400 bg-emerald-50 p-3">
            <p className="font-bold text-emerald-800" style={{ fontSize: '8pt' }}>EN LETRAS</p>
            <p className="mt-1 italic text-emerald-700">{cotizacion.total_en_letras}</p>
          </div>
          <div className="w-full max-w-xs rounded-lg p-3" style={{ backgroundColor: fondo, border: `1px solid ${borde}` }}>
            <div className="flex justify-between py-1"><span className="text-slate-500">Subtotal (incluye IVA)</span><span>{formatQ(cotizacion.subtotal)}</span></div>
            {cotizacion.total_descuentos > 0 && (
              <div className="flex justify-between py-1" style={{ color: acentoOscuro }}><span>Descuento especial</span><span>-{formatQ(cotizacion.total_descuentos)}</span></div>
            )}
            <div className="flex justify-between rounded-lg px-2 py-2 font-bold" style={{ backgroundColor: fondoAlterno, color: acentoOscuro, fontSize: '11pt' }}>
              <span>TOTAL</span><span>{formatQ(cotizacion.total_cotizado)}</span>
            </div>
          </div>
        </div>

        {/* Apartados adicionales de la plantilla */}
        {apartados.map((ap, idx) => (
          ap.titulo || ap.contenido ? (
            <div key={idx} className="mt-4 border-t pt-3" style={{ borderColor: borde }}>
              {ap.titulo && <p className="mb-1 font-bold text-slate-700" style={{ fontSize: '8.5pt' }}>{ap.titulo.toUpperCase()}</p>}
              <p className="whitespace-pre-line text-slate-600">{ap.contenido}</p>
            </div>
          ) : null
        ))}

        {/* Términos y condiciones */}
        <div className="mt-5 rounded-r-lg border-l-4 p-3" style={{ borderColor: acento, backgroundColor: fondo }}>
          <p className="mb-1 font-bold text-slate-700" style={{ fontSize: '8.5pt' }}>TÉRMINOS Y CONDICIONES COMERCIALES</p>
          <ol className="list-inside list-decimal space-y-0.5 text-slate-600">
            {condiciones.map((linea, idx) => <li key={idx}>{linea}</li>)}
          </ol>
        </div>

        {/* Bloque de firmas */}
        <div className="mt-10 grid grid-cols-2 gap-8 text-center text-slate-500">
          <div className="border-t border-slate-400 pt-2">{firmaEmisor}</div>
          <div className="border-t border-slate-400 pt-2">{firmaCliente}</div>
        </div>

        <div className="mt-6 border-t border-dashed pt-4 text-center leading-relaxed text-slate-500" style={{ borderColor: borde, fontSize: '7.5pt' }}>
          {leyendaPie}
        </div>
      </div>
    </div>
  );
}
