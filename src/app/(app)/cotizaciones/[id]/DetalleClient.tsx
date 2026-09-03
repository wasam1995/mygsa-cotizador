'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import PrintQuote from '@/components/PrintQuote';
import PrintQuoteInterno from '@/components/PrintQuoteInterno';
import StatusBadge from '@/components/StatusBadge';
import { formatQ, formatFecha } from '@/lib/utils';
import { distribuirCostosOperativosPorLinea } from '@/lib/fiscal';
import { cambiarEstado, eliminarCotizacion, subirPdfCotizacion, obtenerUrlAdjunto } from './actions';
import type { Cotizacion, CotizacionAdjunto, CotizacionCostoOperativo, CotizacionDetalle, CotizacionHistorialEstado, MovimientoInventario, ParametrosFiscales, PlantillaCotizacion } from '@/lib/types';

type Tab = 'interno' | 'impresion';

const TIPO_COLOR: Record<string, string> = {
  ENTRADA: 'bg-emerald-100 text-emerald-700',
  SALIDA: 'bg-red-100 text-red-700',
  RESERVA: 'bg-amber-100 text-amber-700',
  LIBERA_RESERVA: 'bg-slate-100 text-slate-600',
  ANULACION: 'bg-orange-100 text-orange-700',
  AJUSTE: 'bg-sky-100 text-sky-700',
};

export default function DetalleClient({
  cotizacion, lineas, historial, adjuntos, costosOperativos, movimientos, parametros, plantilla, permisos, esCreador,
  clienteNombre, clienteNit, clienteDireccion, clienteContacto, vendedorNombre, vendedorCorreo,
}: {
  cotizacion: Cotizacion;
  lineas: CotizacionDetalle[];
  historial: CotizacionHistorialEstado[];
  adjuntos: CotizacionAdjunto[];
  costosOperativos: CotizacionCostoOperativo[];
  movimientos: (MovimientoInventario & { producto: { codigo: string; nombre: string } | null })[];
  parametros: ParametrosFiscales;
  plantilla: PlantillaCotizacion | null;
  permisos: string[];
  esCreador: boolean;
  clienteNombre: string;
  clienteNit: string | null;
  clienteDireccion: string | null;
  clienteContacto: string | null;
  vendedorNombre: string;
  vendedorCorreo: string | null;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('interno');
  const [pendiente, iniciarTransicion] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mostrarAnular, setMostrarAnular] = useState(false);
  const [motivo, setMotivo] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [mostrarConfirmarEliminar, setMostrarConfirmarEliminar] = useState(false);
  const [generandoPdf, setGenerandoPdf] = useState<'cliente' | 'interno' | null>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const printRefInterno = useRef<HTMLDivElement>(null);

  const puedeVerInterno = permisos.includes('COTIZACIONES_CREAR') || permisos.includes('COTIZACIONES_VER_TODAS');

  // Reparto de los costos operativos adicionales entre las líneas de producto, en
  // proporción a su venta — solo se muestra si la cotización se guardó con la opción de
  // prorratear activada (ver checkbox "Prorratear" en el formulario de captura).
  const prorrateoPorLinea = useMemo(
    () => distribuirCostosOperativosPorLinea(lineas, cotizacion.costos_operativos_total),
    [lineas, cotizacion.costos_operativos_total]
  );

  const puedeAnular = permisos.includes('COTIZACIONES_ANULAR') || (esCreador && cotizacion.estado === 'PROSPECTO');
  const puedeAutorizar = permisos.includes('COTIZACIONES_AUTORIZAR');
  const puedeFacturar = permisos.includes('COTIZACIONES_FACTURAR');
  const puedeGestionar = permisos.includes('COTIZACIONES_CREAR') || permisos.includes('COTIZACIONES_VER_TODAS');
  // Cualquier cotización que NO esté facturada la puede modificar/eliminar quien la gestiona;
  // una facturada solo quien tenga permiso para ver todas (Autorizador/Administrador).
  const puedeModificarOEliminar = cotizacion.estado !== 'FACTURADO' ? puedeGestionar : permisos.includes('COTIZACIONES_VER_TODAS');

  async function handleEliminar() {
    setError(null);
    setEliminando(true);
    const r = await eliminarCotizacion(cotizacion.id);
    setEliminando(false);
    if (r?.error) setError(r.error);
  }

  function ejecutar(nuevoEstado: Cotizacion['estado'], motivoAnulacion?: string) {
    setError(null);
    iniciarTransicion(async () => {
      const r = await cambiarEstado(cotizacion.id, nuevoEstado, undefined, motivoAnulacion);
      if (r?.error) setError(r.error);
      else router.refresh();
    });
  }

  async function handleSubirPdf(e: React.FormEvent) {
    e.preventDefault();
    if (!fileRef.current?.files?.[0]) return;
    setSubiendo(true);
    const fd = new FormData();
    fd.append('archivo', fileRef.current.files[0]);
    const r = await subirPdfCotizacion(cotizacion.id, fd);
    setSubiendo(false);
    if (r?.error) setError(r.error);
    else { if (fileRef.current) fileRef.current.value = ''; router.refresh(); }
  }

  async function verAdjunto(ruta: string) {
    const url = await obtenerUrlAdjunto(ruta);
    if (url) window.open(url, '_blank');
  }

  // Genera un PDF real (descargable) a partir de una vista de impresión (cliente o
  // interna), capturándola como imagen con html2canvas y armando el archivo con jsPDF
  // en A4 vertical, con márgenes reales (15mm arriba/lados, 20mm abajo) y paginación
  // automática con "Página X de Y" en el pie. Ambos nodos (PrintQuote y
  // PrintQuoteInterno) siempre están montados — visibles solo cuando corresponde, o
  // fuera de pantalla en caso contrario — así que no hace falta cambiar de pestaña.
  async function handleDescargarPDF(version: 'cliente' | 'interno') {
    setError(null);
    setGenerandoPdf(version);
    try {
      const nodo = version === 'interno' ? printRefInterno.current : printRef.current;
      if (!nodo) throw new Error('No se pudo preparar la vista para exportar.');

      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);

      // html2canvas tiene un problema conocido con elementos "position: fixed" ubicados
      // fuera de pantalla (como el nodo de impresión, que vive en left:-9999px para no
      // interferir con la vista normal): si no se corrige el scroll, termina capturando
      // el viewport visible completo (menús, botones, tarjetas internas) en vez del
      // documento real — así es como aparecía información de más y todo diminuto. Se
      // corrige forzando el scroll a 0,0 antes de capturar y pasando scrollX/scrollY en 0
      // para que html2canvas recorte exactamente el nodo indicado.
      window.scrollTo(0, 0);
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const canvas = await html2canvas(nodo, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        scrollX: 0,
        scrollY: 0,
        windowWidth: document.documentElement.clientWidth,
        windowHeight: document.documentElement.clientHeight,
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ unit: 'pt', format: 'a4' });

      const MM = 2.834645669; // pt por mm
      const margenSup = 15 * MM, margenLado = 15 * MM, margenInf = 20 * MM;
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth - margenLado * 2;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const alturaUtilPorPagina = pageHeight - margenSup - margenInf;

      let alturaRestante = imgHeight;
      let corrimiento = 0;
      pdf.addImage(imgData, 'PNG', margenLado, margenSup, imgWidth, imgHeight);
      alturaRestante -= alturaUtilPorPagina;
      while (alturaRestante > 0) {
        corrimiento += alturaUtilPorPagina;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', margenLado, margenSup - corrimiento, imgWidth, imgHeight);
        alturaRestante -= alturaUtilPorPagina;
      }

      const totalPaginas = pdf.getNumberOfPages();
      for (let i = 1; i <= totalPaginas; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(120, 120, 120);
        pdf.text(parametros.nombre_comercial || parametros.razon_social, margenLado, pageHeight - margenInf + 16);
        pdf.text(`Página ${i} de ${totalPaginas}`, pageWidth - margenLado, pageHeight - margenInf + 16, { align: 'right' });
      }

      const base = (cotizacion.numero_sistema_externo || cotizacion.numero_interno).replace(/[^a-zA-Z0-9-]/g, '_');
      pdf.save(version === 'interno' ? `${base}_INTERNO.pdf` : `${base}.pdf`);
    } catch (e) {
      setError('No se pudo generar el PDF. Intente de nuevo o use "Imprimir" del navegador.');
    } finally {
      setGenerandoPdf(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 no-print">
        <div>
          <h1 className="text-xl font-bold text-slate-800">{cotizacion.numero_interno}</h1>
          <p className="text-sm text-slate-500">
            {cotizacion.numero_sistema_externo ? `ERP: ${cotizacion.numero_sistema_externo}` : 'Sin número de sistema aún'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge estado={cotizacion.estado} />
          <button onClick={() => window.print()} className="btn btn-secondary">🖨️ Imprimir</button>
          <button onClick={() => handleDescargarPDF('cliente')} disabled={generandoPdf !== null} className="btn btn-secondary">
            {generandoPdf === 'cliente' ? 'Generando…' : '⬇️ PDF cliente'}
          </button>
          {puedeVerInterno && (
            <button onClick={() => handleDescargarPDF('interno')} disabled={generandoPdf !== null} className="btn btn-secondary">
              {generandoPdf === 'interno' ? 'Generando…' : '⬇️ PDF interno'}
            </button>
          )}
          <a href={`/api/cotizaciones/${cotizacion.id}/excel/cliente`} className="btn btn-secondary">⬇️ Excel cliente</a>
          {puedeVerInterno && (
            <a href={`/api/cotizaciones/${cotizacion.id}/excel`} className="btn btn-secondary">⬇️ Excel interno</a>
          )}
          {puedeModificarOEliminar && (
            <Link href={`/cotizaciones/${cotizacion.id}/editar`} className="btn btn-secondary">✏️ Modificar</Link>
          )}
          {/* Una cotización FACTURADA ya no se puede eliminar directamente (movió inventario
              real y generó comisión) — hay que anularla primero, desde la tarjeta de
              Acciones de abajo. Mostrar el botón aquí solo llevaría a un error al hacer clic. */}
          {puedeModificarOEliminar && cotizacion.estado !== 'FACTURADO' && (
            <button onClick={() => setMostrarConfirmarEliminar(true)} className="btn btn-danger">🗑️ Eliminar</button>
          )}
        </div>
      </div>

      {puedeModificarOEliminar && cotizacion.estado === 'FACTURADO' && (
        <div className="card no-print border-amber-200 bg-amber-50">
          <p className="text-sm text-amber-800">
            Esta cotización ya está facturada. Para eliminarla definitivamente, primero debe <b>anularla</b> (eso
            devuelve el inventario correctamente y queda registrado en el kardex) — la opción de anular está en
            &quot;Acciones&quot; más abajo. Una vez anulada, el botón &quot;Eliminar&quot; vuelve a aparecer.
          </p>
        </div>
      )}

      {mostrarConfirmarEliminar && (
        <div className="card no-print border-red-200 bg-red-50">
          <p className="text-sm font-bold text-red-700">¿Eliminar esta cotización?</p>
          <p className="mt-1 text-sm text-red-600">
            Esta acción no se puede deshacer y borra por completo el registro de {cotizacion.numero_interno}.
            {' '}Si solo quiere dejarla sin efecto conservando el registro, use "Anular" en vez de esto.
          </p>
          <div className="mt-3 flex gap-2">
            <button disabled={eliminando} className="btn btn-danger" onClick={handleEliminar}>
              {eliminando ? 'Eliminando…' : 'Sí, eliminar definitivamente'}
            </button>
            <button className="btn btn-ghost" onClick={() => setMostrarConfirmarEliminar(false)}>Cancelar</button>
          </div>
        </div>
      )}

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 no-print">{error}</div>}

      {/* Acciones de flujo de estado — se muestra también en FACTURADO (aunque ya no
          quedan botones de transición hacia adelante) porque es la única forma de llegar
          a "Anular" desde ahí, que es el paso obligatorio antes de poder eliminar. */}
      {cotizacion.estado !== 'ANULADO' && (
        <div className="card no-print">
          <h2 className="mb-3 text-sm font-bold text-slate-700">Acciones</h2>
          <div className="flex flex-wrap gap-2">
            {cotizacion.estado === 'PROSPECTO' && puedeGestionar && (
              <button disabled={pendiente} className="btn btn-orange"
                onClick={() => ejecutar(cotizacion.requiere_autorizacion ? 'PEND_AUTORIZAR' : 'ENVIADO_CLIENTE')}>
                {cotizacion.requiere_autorizacion ? 'Enviar a autorización' : 'Enviar a cliente'}
              </button>
            )}
            {cotizacion.estado === 'PEND_AUTORIZAR' && puedeAutorizar && (
              <button disabled={pendiente} className="btn btn-orange" onClick={() => ejecutar('ENVIADO_CLIENTE')}>
                Aprobar y enviar a cliente
              </button>
            )}
            {cotizacion.estado === 'PEND_AUTORIZAR' && !puedeAutorizar && (
              <p className="text-sm text-amber-700">Esperando aprobación de un perfil Autorizador (descuento {cotizacion.porcentaje_descuento_efectivo.toFixed(2)}%).</p>
            )}
            {cotizacion.estado === 'ENVIADO_CLIENTE' && puedeGestionar && (
              <button disabled={pendiente} className="btn btn-orange" onClick={() => ejecutar('AUTORIZADO_CLIENTE')}>
                Cliente aprobó — pendiente de facturar
              </button>
            )}
            {cotizacion.estado === 'AUTORIZADO_CLIENTE' && puedeFacturar && (
              <button disabled={pendiente} className="btn btn-primary" onClick={() => ejecutar('FACTURADO')}>
                Marcar como facturado
              </button>
            )}
            {puedeAnular && (
              <button disabled={pendiente} className="btn btn-danger" onClick={() => setMostrarAnular(true)}>Anular</button>
            )}
          </div>
          {mostrarAnular && (
            <div className="mt-3 space-y-2 rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-xs text-red-700">
                {cotizacion.estado === 'FACTURADO'
                  ? 'Esta cotización ya rebajó el inventario (está facturada). Al anular, el sistema devuelve automáticamente las unidades a existencia y lo deja registrado en el kardex — no requiere ningún paso adicional.'
                  : 'Esta cotización todavía no ha rebajado inventario, solo tiene unidades reservadas. Al anular, el sistema libera automáticamente esa reserva.'}
              </p>
              <label className="label">Motivo de anulación</label>
              <textarea className="input" rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
              <div className="flex gap-2">
                <button disabled={pendiente} className="btn btn-danger" onClick={() => { ejecutar('ANULADO', motivo); setMostrarAnular(false); }}>
                  Confirmar anulación
                </button>
                <button className="btn btn-ghost" onClick={() => setMostrarAnular(false)}>Cancelar</button>
              </div>
            </div>
          )}
        </div>
      )}

      {cotizacion.estado === 'ANULADO' && cotizacion.motivo_anulacion && (
        <div className="card no-print border-red-200 bg-red-50">
          <p className="text-sm font-semibold text-red-700">Motivo de anulación</p>
          <p className="text-sm text-red-600">{cotizacion.motivo_anulacion}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 no-print">
        <button onClick={() => setTab('interno')} className={`btn ${tab === 'interno' ? 'btn-primary' : 'btn-secondary'}`}>Resumen interno</button>
        <button onClick={() => setTab('impresion')} className={`btn ${tab === 'impresion' ? 'btn-primary' : 'btn-secondary'}`}>Vista de impresión</button>
      </div>

      {tab === 'interno' ? (
        <div className="space-y-6">
          <div className="card grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <Dato label="Cliente" valor={clienteNombre} />
            <Dato label="Vendedor" valor={vendedorNombre} />
            <Dato label="Teléfono del vendedor" valor={cotizacion.vendedor_telefono || '—'} />
            <Dato label="Correo del vendedor" valor={vendedorCorreo || '—'} />
            <Dato label="Fecha emisión" valor={formatFecha(cotizacion.fecha_emision)} />
            <Dato label="Vence" valor={formatFecha(cotizacion.fecha_vencimiento)} />
          </div>

          <div className="card overflow-x-auto">
            <h2 className="mb-3 text-sm font-bold text-slate-700">Detalle</h2>
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-400">
                  <th className="py-2 pr-2">Código</th><th className="py-2 pr-2">Descripción</th>
                  <th className="py-2 pr-2">Cant.</th><th className="py-2 pr-2">Costo U.</th>
                  <th className="py-2 pr-2">Precio U.</th><th className="py-2 pr-2">Subtotal</th>
                  {cotizacion.prorratear_costos_operativos && (
                    <th className="py-2 pr-2">Costos oper. prorrateados</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {lineas.map((l, idx) => (
                  <tr key={l.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 pr-2 font-mono text-xs text-slate-500">{l.codigo_mostrado}</td>
                    <td className="py-2 pr-2">{l.descripcion}</td>
                    <td className="py-2 pr-2">{l.cantidad}</td>
                    <td className="py-2 pr-2 text-slate-500">{formatQ(l.costo_unitario)}</td>
                    <td className="py-2 pr-2">{formatQ(l.precio_unitario)}</td>
                    <td className="py-2 pr-2 font-medium">{formatQ(l.subtotal_linea)}</td>
                    {cotizacion.prorratear_costos_operativos && (
                      <td className="py-2 pr-2 text-amber-700">{formatQ(prorrateoPorLinea[idx] ?? 0)}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {cotizacion.prorratear_costos_operativos && (
              <p className="mt-2 text-xs text-slate-400">
                Los costos operativos adicionales ({formatQ(cotizacion.costos_operativos_total)}) se reparten aquí en
                proporción a la venta de cada línea — es solo informativo, no cambia la utilidad total ya calculada.
              </p>
            )}
          </div>

          {costosOperativos.length > 0 && (
            <div className="card overflow-x-auto">
              <h2 className="mb-3 text-sm font-bold text-slate-700">Costos operativos adicionales (uso interno)</h2>
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-400">
                    <th className="py-2 pr-2">Concepto</th><th className="py-2 pr-2">Cant.</th>
                    <th className="py-2 pr-2">Días/tiempos</th><th className="py-2 pr-2">Costo unit.</th><th className="py-2 pr-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {costosOperativos.map((c) => (
                    <tr key={c.id} className="border-b border-slate-100 last:border-0">
                      <td className="py-2 pr-2">{c.concepto}</td>
                      <td className="py-2 pr-2">{c.cantidad}</td>
                      <td className="py-2 pr-2">{c.dias}</td>
                      <td className="py-2 pr-2">{formatQ(c.costo_unitario)}</td>
                      <td className="py-2 pr-2 font-medium">{formatQ(c.cantidad * c.dias * c.costo_unitario)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="card grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div>
              <h2 className="mb-2 text-sm font-bold text-slate-700">Resumen fiscal</h2>
              <FilaResumen label="Subtotal (con IVA)" valor={cotizacion.subtotal} />
              <FilaResumen label="Descuentos" valor={-cotizacion.total_descuentos} />
              <FilaResumen label="Total cotizado (incluye IVA)" valor={cotizacion.total_cotizado} negrita grande />
              <FilaResumen label="Base gravable (sin IVA)" valor={cotizacion.base_gravable} />
              <FilaResumen label={`IVA (${(parametros.iva_porcentaje * 100).toFixed(0)}%)`} valor={cotizacion.iva_monto} />
              <hr className="my-2" />
              <FilaResumen label="Retención ISR" valor={-cotizacion.isr_retencion} tono="text-red-600" />
              <FilaResumen label={`Retención IVA (${(parametros.retencion_iva_porcentaje * 100).toFixed(0)}%)`} valor={-cotizacion.iva_retencion} tono="text-red-600" />
              <FilaResumen label="Pago neto a la empresa" valor={cotizacion.pago_neto_empresa} negrita tono="text-emerald-700" />
            </div>
            <div>
              <h2 className="mb-2 text-sm font-bold text-slate-700">Utilidad y comisión (uso interno)</h2>
              <FilaResumen label="Costo total de productos/servicios" valor={cotizacion.costo_total_productos} />
              <FilaResumen label="+ Gastos operativos adicionales" valor={cotizacion.costos_operativos_total} />
              <FilaResumen label="= Costo total de operación" valor={cotizacion.costo_total_operacion} negrita />
              <FilaResumen label="Utilidad bruta (venta sin IVA - costo)" valor={cotizacion.utilidad_bruta} negrita tono="text-navy-700" />
              <FilaResumen label="− Retención ISR" valor={-cotizacion.isr_retencion} tono="text-red-600" />
              <FilaResumen label="= Utilidad neta (base de comisión)" valor={cotizacion.utilidad_neta} negrita tono="text-navy-700" />
              <div className="flex justify-between py-0.5 text-sm text-slate-600"><span>% Margen de utilidad (neta)</span><span className="font-semibold">{(cotizacion.margen_utilidad_pct * 100).toFixed(2)}%</span></div>
              <div className="flex justify-between py-0.5 text-sm text-slate-600"><span>Escala de comisión aplicada</span><span className="font-semibold">{cotizacion.escala_comision_rango ? `Rango ${cotizacion.escala_comision_rango}` : '—'}</span></div>
              <div className="flex justify-between py-0.5 text-sm text-slate-600"><span>% Comisión al vendedor</span><span className="font-semibold">{(cotizacion.comision_estimada_pct * 100).toFixed(2)}%</span></div>
              <FilaResumen label="Comisión estimada / pagada" valor={cotizacion.comision_estimada_monto} tono="text-amber-700" />
              <hr className="my-2" />
              <FilaResumen label="Ganancia neta para la empresa" valor={cotizacion.ganancia_neta_estimada} negrita grande tono="text-emerald-700" />
            </div>
          </div>

          <div className="card grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div>
              <h2 className="mb-2 text-sm font-bold text-slate-700">Adjuntos (PDF del ERP)</h2>
              <ul className="mb-3 space-y-1">
                {adjuntos.map((a) => (
                  <li key={a.id}>
                    <button onClick={() => verAdjunto(a.ruta_storage)} className="text-sm text-navy-600 hover:underline">
                      📎 {a.nombre_archivo}
                    </button>
                  </li>
                ))}
                {adjuntos.length === 0 && <li className="text-sm text-slate-400">Sin archivos adjuntos.</li>}
              </ul>
              <form onSubmit={handleSubirPdf} className="flex flex-col gap-2 sm:flex-row no-print">
                <input ref={fileRef} type="file" accept="application/pdf" className="input" />
                <button type="submit" disabled={subiendo} className="btn btn-secondary whitespace-nowrap">
                  {subiendo ? 'Subiendo…' : 'Cargar PDF'}
                </button>
              </form>

              <h2 className="mb-2 mt-5 text-sm font-bold text-slate-700">Historial</h2>
              <ul className="space-y-1 text-xs text-slate-500">
                {historial.map((h) => (
                  <li key={h.id}>{formatFecha(h.creado_en)} — {h.estado_anterior ?? '—'} → <b>{h.estado_nuevo}</b></li>
                ))}
              </ul>
            </div>
          </div>

          {movimientos.length > 0 && (
            <div className="card overflow-x-auto">
              <h2 className="mb-3 text-sm font-bold text-slate-700">Movimientos de inventario generados por esta cotización</h2>
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-400">
                    <th className="py-2 pr-2">Fecha</th><th className="py-2 pr-2">Tipo</th>
                    <th className="py-2 pr-2">Producto</th><th className="py-2 pr-2">Cant.</th>
                    <th className="py-2 pr-2">Stock result.</th>
                  </tr>
                </thead>
                <tbody>
                  {movimientos.map((m) => (
                    <tr key={m.id} className="border-b border-slate-100 last:border-0">
                      <td className="py-2 pr-2 text-slate-500">{formatFecha(m.creado_en)}</td>
                      <td className="py-2 pr-2"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${TIPO_COLOR[m.tipo]}`}>{m.tipo}</span></td>
                      <td className="py-2 pr-2">{m.producto?.codigo} — {m.producto?.nombre}</td>
                      <td className="py-2 pr-2 font-medium">{m.cantidad}</td>
                      <td className="py-2 pr-2 text-slate-500">{m.stock_resultante ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-slate-400">
                Ver el kardex completo en <Link href={`/inventario/kardex?cotizacion=${encodeURIComponent(cotizacion.numero_sistema_externo || cotizacion.numero_interno)}`} className="text-navy-600 hover:underline">Inventario → Kardex</Link>.
              </p>
            </div>
          )}
        </div>
      ) : null}

      {/* El nodo de impresión siempre está montado para que "Descargar PDF" funcione
          sin importar la pestaña activa: visible en "Vista de impresión", o fuera de
          pantalla (nunca con display:none, que html2canvas no puede capturar) si el
          usuario está viendo "Resumen interno". */}
      <div
        ref={printRef}
        className={tab === 'impresion' ? '' : 'no-print pointer-events-none fixed -left-[9999px] top-0'}
        aria-hidden={tab !== 'impresion'}
      >
        <PrintQuote
          cotizacion={cotizacion} lineas={lineas} parametros={parametros} plantilla={plantilla}
          clienteNombre={clienteNombre} clienteNit={clienteNit} clienteDireccion={clienteDireccion}
          clienteContacto={clienteContacto} vendedorNombre={vendedorNombre} vendedorCorreo={vendedorCorreo}
        />
      </div>

      {/* Versión interna (confidencial) — solo se usa para generar el "PDF interno";
          nunca se muestra en pantalla, así que siempre queda fuera de pantalla. */}
      {puedeVerInterno && (
        <div ref={printRefInterno} className="no-print pointer-events-none fixed -left-[9999px] top-0" aria-hidden="true">
          <PrintQuoteInterno
            cotizacion={cotizacion} lineas={lineas} costosOperativos={costosOperativos}
            prorrateoPorLinea={prorrateoPorLinea} parametros={parametros} plantilla={plantilla}
            clienteNombre={clienteNombre} clienteNit={clienteNit} clienteDireccion={clienteDireccion}
            clienteContacto={clienteContacto} vendedorNombre={vendedorNombre} vendedorCorreo={vendedorCorreo}
          />
        </div>
      )}
    </div>
  );
}

function Dato({ label, valor }: { label: string; valor: string }) {
  return <div><p className="text-xs font-semibold uppercase text-slate-400">{label}</p><p className="font-medium text-slate-700">{valor}</p></div>;
}

function FilaResumen({ label, valor, negrita, grande, tono }: { label: string; valor: number; negrita?: boolean; grande?: boolean; tono?: string }) {
  return (
    <div className={`flex justify-between py-0.5 text-sm ${negrita ? 'font-bold text-slate-800' : 'text-slate-600'} ${grande ? 'text-base' : ''} ${tono ?? ''}`}>
      <span>{label}</span><span>{formatQ(valor)}</span>
    </div>
  );
}
