import { formatQ, formatFecha } from '@/lib/utils';
import type { Cotizacion, CotizacionDetalle, ParametrosFiscales, PlantillaCotizacion } from '@/lib/types';

type LineaConFoto = CotizacionDetalle & { producto?: { imagen_url: string | null } | null };

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
  const tipografia = parametros.tipografia || 'Inter, ui-sans-serif, system-ui, sans-serif';

  const condiciones = (plantilla?.condiciones_comerciales?.trim()
    ? plantilla.condiciones_comerciales.split('\n').map((l) => l.trim()).filter(Boolean)
    : CONDICIONES_DEFECTO);
  const leyendaPie = plantilla?.leyenda_pie?.trim() || parametros.leyenda_cotizacion;

  return (
    <div
      className="print-area relative mx-auto max-w-3xl overflow-hidden rounded-2xl border p-8 shadow-card print:rounded-none print:border-0 print:shadow-none"
      style={{ fontFamily: tipografia, borderColor: borde, backgroundColor: '#ffffff' }}
    >
      {anulada && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <span className="rotate-[-25deg] border-4 border-red-500 px-8 py-2 text-4xl font-black tracking-widest text-red-500/70">
            ANULADA
          </span>
        </div>
      )}

      <div className="flex items-start justify-between border-b pb-4" style={{ borderColor: borde }}>
        {parametros.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={parametros.logo_url} alt={parametros.nombre_comercial || parametros.razon_social} className="h-14 max-w-[10rem] object-contain" />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-xl text-lg font-bold text-white" style={{ backgroundColor: primario }}>MG</div>
        )}
        <div className="text-right">
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: acentoOscuro }}>COTIZACIÓN</h1>
          <p className="text-xs text-slate-500">No. {cotizacion.numero_sistema_externo || cotizacion.numero_interno}</p>
          <p className="text-xs text-slate-500">Fecha: {formatFecha(cotizacion.fecha_emision)}</p>
          <p className="text-xs text-slate-500">Vence: {formatFecha(cotizacion.fecha_vencimiento)}</p>
          {mostrarVendedor && (
            <p className="text-xs text-slate-500">Vendedor: {vendedorNombre}</p>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
        <div className="rounded-lg p-3" style={{ backgroundColor: fondo }}>
          <p className="font-bold text-slate-700">{parametros.razon_social}</p>
          <p className="text-slate-500">Correo: {parametros.correo_empresa}</p>
        </div>
        <div className="rounded-lg p-3" style={{ backgroundColor: fondo }}>
          <p><span className="font-semibold">Nombre:</span> {clienteNombre}</p>
          <p><span className="font-semibold">Dirección:</span> {clienteDireccion || '—'}</p>
          <p><span className="font-semibold">Teléfono:</span> {cotizacion.cliente_telefono || '—'}</p>
          {clienteNit && <p><span className="font-semibold">NIT:</span> {clienteNit}</p>}
          {clienteContacto && <p><span className="font-semibold">Atención:</span> {clienteContacto}</p>}
        </div>
      </div>

      <table className="mt-5 w-full text-xs">
        <thead>
          <tr className="border-b-2 text-left uppercase text-slate-500" style={{ borderColor: acento }}>
            <th className="py-2">Artículo / servicio</th>
            {mostrarPrecios && <th className="py-2 text-right">Precio</th>}
            <th className="py-2 text-right">Cantidad</th>
            {mostrarPrecios && <th className="py-2 text-right">Total</th>}
          </tr>
        </thead>
        <tbody>
          {lineas.map((l) => {
            const foto = l.incluir_foto ? l.producto?.imagen_url : null;
            return (
              <tr key={l.id} className="border-b border-slate-100">
                <td className="py-2 pr-2">
                  <div className="flex items-center gap-2">
                    {foto && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={foto} alt={l.descripcion} className="h-10 w-10 flex-shrink-0 rounded object-cover" />
                    )}
                    <span>{l.descripcion}</span>
                  </div>
                </td>
                {mostrarPrecios && <td className="py-2 text-right">{formatQ(l.precio_unitario)}</td>}
                <td className="py-2 text-right">{l.cantidad}</td>
                {mostrarPrecios && <td className="py-2 text-right font-medium">{formatQ(l.subtotal_linea)}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
      {!mostrarPrecios && (
        <p className="mt-2 text-right text-[11px] italic text-slate-400">
          Precios detallados por artículo omitidos — se muestra el precio total del paquete.
        </p>
      )}

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:justify-between">
        <div className="max-w-xs rounded-lg border-l-4 border-emerald-400 bg-emerald-50 p-3 text-xs">
          <p className="font-bold text-emerald-800">EN LETRAS</p>
          <p className="mt-1 italic text-emerald-700">{cotizacion.total_en_letras}</p>
        </div>
        <div className="w-full max-w-xs rounded-lg p-3 text-sm" style={{ backgroundColor: fondoAlterno }}>
          <div className="flex justify-between py-1"><span className="text-slate-500">Subtotal (incluye IVA)</span><span>{formatQ(cotizacion.subtotal)}</span></div>
          <div className="flex justify-between py-1"><span className="text-slate-500">Descuento</span><span>{formatQ(cotizacion.total_descuentos)}</span></div>
          <div className="flex justify-between border-t py-2 text-base font-bold" style={{ borderColor: borde, color: acentoOscuro }}>
            <span>TOTAL A PAGAR (incluye IVA)</span><span>{formatQ(cotizacion.total_cotizado)}</span>
          </div>
        </div>
      </div>

      {cotizacion.comentario && (
        <div className="mt-4 rounded-lg p-3 text-xs" style={{ backgroundColor: fondo }}>
          <p className="font-semibold text-slate-600">Comentario:</p>
          <p className="text-slate-500">{cotizacion.comentario}</p>
        </div>
      )}

      <div className="mt-6 border-t pt-4 text-xs text-slate-600" style={{ borderColor: borde }}>
        <p className="mb-1 font-bold text-slate-700">CONDICIONES COMERCIALES</p>
        <ol className="list-inside list-decimal space-y-0.5">
          {condiciones.map((linea, idx) => <li key={idx}>{linea}</li>)}
        </ol>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-8 text-center text-xs text-slate-500">
        <div className="border-t border-slate-400 pt-2">Autorizado por (Asesor)</div>
        <div className="border-t border-slate-400 pt-2">Aceptado por (Cliente / Fecha)</div>
      </div>

      <div className="mt-6 border-t border-dashed pt-4 text-center text-[11px] leading-relaxed text-slate-500" style={{ borderColor: borde }}>
        {leyendaPie}
      </div>
    </div>
  );
}
