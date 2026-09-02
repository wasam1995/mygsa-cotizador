import { formatQ, formatFecha } from '@/lib/utils';
import type { Cotizacion, CotizacionDetalle, ParametrosFiscales } from '@/lib/types';

export default function PrintQuote({
  cotizacion, lineas, parametros, clienteNombre, clienteNit, clienteDireccion, clienteContacto,
  vendedorNombre, vendedorCorreo,
}: {
  cotizacion: Cotizacion;
  lineas: CotizacionDetalle[];
  parametros: ParametrosFiscales;
  clienteNombre: string;
  clienteNit: string | null;
  clienteDireccion: string | null;
  clienteContacto: string | null;
  vendedorNombre: string;
  vendedorCorreo: string | null;
}) {
  const anulada = cotizacion.estado === 'ANULADO';

  return (
    <div className="print-area relative mx-auto max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white p-8 shadow-card print:rounded-none print:border-0 print:shadow-none">
      {anulada && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <span className="rotate-[-25deg] border-4 border-red-500 px-8 py-2 text-4xl font-black tracking-widest text-red-500/70">
            ANULADA
          </span>
        </div>
      )}

      <div className="flex items-start justify-between border-b border-slate-200 pb-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-navy-700 text-lg font-bold text-white">MG</div>
        <div className="text-right">
          <h1 className="text-2xl font-bold tracking-tight text-brand-orangeDark">COTIZACIÓN</h1>
          <p className="text-xs text-slate-500">No. {cotizacion.numero_sistema_externo || cotizacion.numero_interno}</p>
          <p className="text-xs text-slate-500">Fecha: {formatFecha(cotizacion.fecha_emision)}</p>
          <p className="text-xs text-slate-500">Vence: {formatFecha(cotizacion.fecha_vencimiento)}</p>
          <p className="text-xs text-slate-500">Vendedor: {vendedorNombre}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="font-bold text-slate-700">{parametros.razon_social}</p>
          <p className="text-slate-500">Correo: {parametros.correo_empresa}</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <p><span className="font-semibold">Nombre:</span> {clienteNombre}</p>
          <p><span className="font-semibold">Dirección:</span> {clienteDireccion || '—'}</p>
          <p><span className="font-semibold">Teléfono:</span> {cotizacion.cliente_telefono || '—'}</p>
          {clienteNit && <p><span className="font-semibold">NIT:</span> {clienteNit}</p>}
          {clienteContacto && <p><span className="font-semibold">Atención:</span> {clienteContacto}</p>}
        </div>
      </div>

      <table className="mt-5 w-full text-xs">
        <thead>
          <tr className="border-b-2 border-brand-orange text-left uppercase text-slate-500">
            <th className="py-2">Artículo / servicio</th>
            <th className="py-2 text-right">Precio</th>
            <th className="py-2 text-right">Cantidad</th>
            <th className="py-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {lineas.map((l) => (
            <tr key={l.id} className="border-b border-slate-100">
              <td className="py-2 pr-2">{l.descripcion}</td>
              <td className="py-2 text-right">{formatQ(l.precio_unitario)}</td>
              <td className="py-2 text-right">{l.cantidad}</td>
              <td className="py-2 text-right font-medium">{formatQ(l.subtotal_linea)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:justify-between">
        <div className="max-w-xs rounded-lg border-l-4 border-emerald-400 bg-emerald-50 p-3 text-xs">
          <p className="font-bold text-emerald-800">EN LETRAS</p>
          <p className="mt-1 italic text-emerald-700">{cotizacion.total_en_letras}</p>
        </div>
        <div className="w-full max-w-xs text-sm">
          <div className="flex justify-between py-1"><span className="text-slate-500">Subtotal (incluye IVA)</span><span>{formatQ(cotizacion.subtotal)}</span></div>
          <div className="flex justify-between py-1"><span className="text-slate-500">Descuento</span><span>{formatQ(cotizacion.total_descuentos)}</span></div>
          <div className="flex justify-between border-t border-slate-300 py-2 text-base font-bold text-brand-orangeDark">
            <span>TOTAL A PAGAR (incluye IVA)</span><span>{formatQ(cotizacion.total_cotizado)}</span>
          </div>
        </div>
      </div>

      {cotizacion.comentario && (
        <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs">
          <p className="font-semibold text-slate-600">Comentario:</p>
          <p className="text-slate-500">{cotizacion.comentario}</p>
        </div>
      )}

      <div className="mt-6 border-t border-slate-200 pt-4 text-xs text-slate-600">
        <p className="mb-1 font-bold text-slate-700">CONDICIONES COMERCIALES</p>
        <ol className="list-inside list-decimal space-y-0.5">
          <li>Precios expresados en Quetzales (Q) e incluyen IVA ({(parametros.iva_porcentaje * 100).toFixed(0)}%).</li>
          <li>Vigencia de esta cotización: {parametros.vigencia_dias} días a partir de la fecha de emisión (hasta {formatFecha(cotizacion.fecha_vencimiento)}).</li>
          <li>Número de referencia de pedido / cotización: {cotizacion.numero_sistema_externo || cotizacion.numero_interno}.</li>
          <li>Precios sujetos a cambio sin previo aviso una vez vencida la vigencia indicada.</li>
        </ol>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-8 text-center text-xs text-slate-500">
        <div className="border-t border-slate-400 pt-2">Autorizado por (Asesor)</div>
        <div className="border-t border-slate-400 pt-2">Aceptado por (Cliente / Fecha)</div>
      </div>

      <div className="mt-6 border-t border-dashed border-slate-300 pt-4 text-center text-[11px] leading-relaxed text-slate-500">
        {parametros.leyenda_cotizacion}
      </div>
    </div>
  );
}
