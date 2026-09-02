import { formatQ, formatFecha } from '@/lib/utils';
import type { Cotizacion, CotizacionCostoOperativo, CotizacionDetalle, ParametrosFiscales, PlantillaCotizacion } from '@/lib/types';

type LineaConFoto = CotizacionDetalle & { producto?: { imagen_url: string | null } | null };

// Versión "Interna" de la cotización imprimible: incluye toda la información financiera
// (costo, utilidad, comisión) y el desglose real de costos operativos — nunca se envía
// al cliente. Comparte plantilla/paleta de colores con la versión de cliente para que
// ambos documentos se vean como parte de la misma familia visual.
export default function PrintQuoteInterno({
  cotizacion, lineas, costosOperativos, prorrateoPorLinea, parametros, plantilla,
  clienteNombre, clienteNit, clienteDireccion, clienteContacto, vendedorNombre, vendedorCorreo,
}: {
  cotizacion: Cotizacion;
  lineas: LineaConFoto[];
  costosOperativos: CotizacionCostoOperativo[];
  prorrateoPorLinea: number[];
  parametros: ParametrosFiscales;
  plantilla: PlantillaCotizacion | null;
  clienteNombre: string;
  clienteNit: string | null;
  clienteDireccion: string | null;
  clienteContacto: string | null;
  vendedorNombre: string;
  vendedorCorreo: string | null;
}) {
  const primario = parametros.color_primario || '#0f172a';
  const acento = parametros.color_acento || '#f97316';
  const acentoOscuro = parametros.color_acento_oscuro || '#ea580c';
  const fondo = parametros.color_fondo || '#f8fafc';
  const fondoAlterno = parametros.color_fondo_alterno || '#fff7ed';
  const borde = parametros.color_borde || '#e2e8f0';
  const tipografia = parametros.tipografia || 'Inter, ui-sans-serif, system-ui, sans-serif';

  return (
    <div
      className="print-area relative mx-auto max-w-3xl overflow-hidden rounded-2xl border p-8 shadow-card print:rounded-none print:border-0 print:shadow-none"
      style={{ fontFamily: tipografia, borderColor: borde, backgroundColor: '#ffffff' }}
    >
      <div className="mb-4 rounded-lg px-3 py-1.5 text-center text-[11px] font-bold uppercase tracking-widest text-white" style={{ backgroundColor: primario }}>
        Documento interno · confidencial · no enviar al cliente
      </div>

      <div className="flex items-start justify-between border-b pb-4" style={{ borderColor: borde }}>
        {parametros.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={parametros.logo_url} alt={parametros.nombre_comercial || parametros.razon_social} className="h-14 max-w-[10rem] object-contain" />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-xl text-lg font-bold text-white" style={{ backgroundColor: primario }}>MG</div>
        )}
        <div className="text-right">
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: acentoOscuro }}>COTIZACIÓN (INTERNA)</h1>
          <p className="text-xs text-slate-500">No. {cotizacion.numero_sistema_externo || cotizacion.numero_interno}</p>
          <p className="text-xs text-slate-500">Fecha: {formatFecha(cotizacion.fecha_emision)}</p>
          <p className="text-xs text-slate-500">Vendedor: {vendedorNombre}{vendedorCorreo ? ` · ${vendedorCorreo}` : ''}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
        <div className="rounded-lg p-3" style={{ backgroundColor: fondo }}>
          <p className="font-bold text-slate-700">{parametros.razon_social}</p>
          <p className="text-slate-500">Correo: {parametros.correo_empresa}</p>
        </div>
        <div className="rounded-lg p-3" style={{ backgroundColor: fondo }}>
          <p><span className="font-semibold">Cliente:</span> {clienteNombre}</p>
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
            <th className="py-2 text-right">Cant.</th>
            <th className="py-2 text-right">Costo U.</th>
            <th className="py-2 text-right">Precio U.</th>
            <th className="py-2 text-right">Subtotal</th>
            {cotizacion.prorratear_costos_operativos && <th className="py-2 text-right">Costos oper.</th>}
          </tr>
        </thead>
        <tbody>
          {lineas.map((l, idx) => (
            <tr key={l.id} className="border-b border-slate-100">
              <td className="py-2 pr-2">{l.descripcion}</td>
              <td className="py-2 text-right">{l.cantidad}</td>
              <td className="py-2 text-right text-slate-500">{formatQ(l.costo_unitario)}</td>
              <td className="py-2 text-right">{formatQ(l.precio_unitario)}</td>
              <td className="py-2 text-right font-medium">{formatQ(l.subtotal_linea)}</td>
              {cotizacion.prorratear_costos_operativos && (
                <td className="py-2 text-right text-amber-700">{formatQ(prorrateoPorLinea[idx] ?? 0)}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {costosOperativos.length > 0 && (
        <div className="mt-4">
          <p className="mb-1 text-xs font-bold text-slate-700">Costos operativos adicionales</p>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-left uppercase text-slate-400" style={{ borderColor: borde }}>
                <th className="py-1.5">Concepto</th>
                <th className="py-1.5 text-right">Cant.</th>
                <th className="py-1.5 text-right">Días/tiempos</th>
                <th className="py-1.5 text-right">Costo unit.</th>
                <th className="py-1.5 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {costosOperativos.map((c) => (
                <tr key={c.id} className="border-b border-slate-100">
                  <td className="py-1.5">{c.concepto}</td>
                  <td className="py-1.5 text-right">{c.cantidad}</td>
                  <td className="py-1.5 text-right">{c.dias}</td>
                  <td className="py-1.5 text-right">{formatQ(c.costo_unitario)}</td>
                  <td className="py-1.5 text-right font-medium">{formatQ(c.cantidad * c.dias * c.costo_unitario)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg p-3 text-xs" style={{ backgroundColor: fondoAlterno }}>
          <p className="mb-1.5 font-bold text-slate-700">Resumen fiscal</p>
          <Fila label="Subtotal (incluye IVA)" valor={cotizacion.subtotal} />
          <Fila label="Descuentos" valor={-cotizacion.total_descuentos} />
          <Fila label="Total cotizado" valor={cotizacion.total_cotizado} negrita />
          <Fila label="Base gravable" valor={cotizacion.base_gravable} />
          <Fila label="IVA (12%)" valor={cotizacion.iva_monto} />
          <Fila label="Retención ISR" valor={-cotizacion.isr_retencion} tono="text-red-600" />
          <Fila label="Retención IVA" valor={-cotizacion.iva_retencion} tono="text-red-600" />
          <Fila label="Pago neto a la empresa" valor={cotizacion.pago_neto_empresa} negrita tono="text-emerald-700" />
        </div>
        <div className="rounded-lg p-3 text-xs" style={{ backgroundColor: fondoAlterno }}>
          <p className="mb-1.5 font-bold text-slate-700">Utilidad y comisión</p>
          <Fila label="Costo total productos/servicios" valor={cotizacion.costo_total_productos} />
          <Fila label="+ Gastos operativos" valor={cotizacion.costos_operativos_total} />
          <Fila label="= Costo total operación" valor={cotizacion.costo_total_operacion} negrita />
          <Fila label="Utilidad bruta" valor={cotizacion.utilidad_bruta} negrita tono="text-navy-700" />
          <div className="flex justify-between py-0.5"><span className="text-slate-500">% Margen</span><span className="font-semibold">{(cotizacion.margen_utilidad_pct * 100).toFixed(2)}%</span></div>
          <div className="flex justify-between py-0.5"><span className="text-slate-500">% Comisión vendedor</span><span className="font-semibold">{(cotizacion.comision_estimada_pct * 100).toFixed(2)}%</span></div>
          <Fila label="Comisión estimada" valor={cotizacion.comision_estimada_monto} tono="text-amber-700" />
          <Fila label="Ganancia neta empresa" valor={cotizacion.ganancia_neta_estimada} negrita tono="text-emerald-700" />
        </div>
      </div>

      {plantilla?.condiciones_comerciales && (
        <div className="mt-6 border-t pt-4 text-xs text-slate-600" style={{ borderColor: borde }}>
          <p className="mb-1 font-bold text-slate-700">CONDICIONES COMERCIALES ({plantilla.nombre})</p>
          <ol className="list-inside list-decimal space-y-0.5">
            {plantilla.condiciones_comerciales.split('\n').map((l) => l.trim()).filter(Boolean).map((linea, idx) => (
              <li key={idx}>{linea}</li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function Fila({ label, valor, negrita, tono }: { label: string; valor: number; negrita?: boolean; tono?: string }) {
  return (
    <div className={`flex justify-between py-0.5 ${negrita ? 'font-bold text-slate-800' : 'text-slate-600'} ${tono ?? ''}`}>
      <span>{label}</span><span>{formatQ(valor)}</span>
    </div>
  );
}
