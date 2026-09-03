import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import { formatQ, formatFecha } from '@/lib/utils';
import { paletaPdf, PDF_FONT } from '@/lib/pdf/theme';
import type { Cotizacion, CotizacionCostoOperativo, CotizacionDetalle, ParametrosFiscales, PlantillaCotizacion } from '@/lib/types';

type LineaConFoto = CotizacionDetalle & { producto?: { imagen_url: string | null; unidad?: string | null } | null };

// Versión "Interna" de la cotización imprimible: incluye toda la información financiera
// (costo, utilidad, comisión) y el desglose real de costos operativos — nunca se envía
// al cliente. Comparte plantilla/paleta de colores con la versión de cliente para que
// ambos documentos se vean como parte de la misma familia visual. Reescrito en Etapa 7
// con @react-pdf/renderer (ver el comentario extenso en PrintQuote.tsx sobre por qué).
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
  const pal = paletaPdf(parametros);
  const s = crearEstilos(pal);

  return (
    <Document title={`Cotización interna ${cotizacion.numero_sistema_externo || cotizacion.numero_interno}`}>
      <Page size="A4" style={s.page}>
        <View style={s.banner}>
          <View style={[s.bannerMitad, { backgroundColor: pal.primario }]} />
          <View style={[s.bannerMitad, { backgroundColor: pal.acento }]} />
        </View>

        <View style={[s.avisoInterno, { backgroundColor: pal.primario }]}>
          <Text style={s.avisoInternoTexto}>DOCUMENTO INTERNO · CONFIDENCIAL · NO ENVIAR AL CLIENTE</Text>
        </View>

        <View style={s.cabecera}>
          <View style={s.cabeceraEmisor}>
            {parametros.logo_url ? (
              <Image src={parametros.logo_url} style={s.logo} />
            ) : (
              <View style={[s.logoPlaceholder, { backgroundColor: pal.primario }]}>
                <Text style={s.logoPlaceholderTexto}>MG</Text>
              </View>
            )}
            <View style={{ marginLeft: 8 }}>
              <Text style={[s.emisorNombre, { color: pal.primario }]}>{parametros.nombre_comercial || parametros.razon_social}</Text>
              <Text style={s.textoGris}>{parametros.correo_empresa}</Text>
            </View>
          </View>
          <View style={s.cabeceraFolio}>
            <Text style={[s.tituloDoc, { color: pal.acentoOscuro }]}>COTIZACIÓN (INTERNA)</Text>
            <Text style={s.textoGris}>Folio: <Text style={{ color: pal.acento, fontWeight: 700 }}>{cotizacion.numero_sistema_externo || cotizacion.numero_interno}</Text></Text>
            <Text style={s.textoGris}>Fecha: {formatFecha(cotizacion.fecha_emision)}</Text>
            <Text style={s.textoGris}>Vendedor: {vendedorNombre}{cotizacion.vendedor_telefono ? ` · ${cotizacion.vendedor_telefono}` : ''}{vendedorCorreo ? ` · ${vendedorCorreo}` : ''}</Text>
          </View>
        </View>

        <View style={s.filaDosColumnas}>
          <View style={[s.tarjeta, { backgroundColor: pal.fondo }]}>
            <Text style={[s.tarjetaTitulo, { color: pal.primario }]}>Cliente</Text>
            <Text style={s.linea}><Text style={s.negrita}>Nombre:</Text> {clienteNombre}</Text>
            <Text style={s.linea}><Text style={s.negrita}>Dirección:</Text> {clienteDireccion || '—'}</Text>
            <Text style={s.linea}><Text style={s.negrita}>Teléfono:</Text> {cotizacion.cliente_telefono || '—'}</Text>
            {clienteNit && <Text style={s.linea}><Text style={s.negrita}>NIT:</Text> {clienteNit}</Text>}
            {clienteContacto && <Text style={s.linea}><Text style={s.negrita}>Atención:</Text> {clienteContacto}</Text>}
          </View>
          <View style={[s.tarjeta, { backgroundColor: pal.fondo, marginLeft: 10 }]}>
            <Text style={[s.tarjetaTitulo, { color: pal.primario }]}>Detalles del proyecto</Text>
            <Text style={s.textoGrisOscuro}>{cotizacion.comentario || 'Sin observaciones adicionales.'}</Text>
          </View>
        </View>

        <View style={[s.tablaHead, { borderColor: pal.acento, marginTop: 16 }]}>
          <Text style={s.colArticulo}>Artículo / servicio</Text>
          <Text style={s.colCant}>Cant.</Text>
          <Text style={s.colUnidad}>Unidad</Text>
          <Text style={s.colMoneda}>Costo U.</Text>
          <Text style={s.colMoneda}>Precio U.</Text>
          <Text style={s.colMoneda}>Subtotal</Text>
          {cotizacion.prorratear_costos_operativos && <Text style={s.colMoneda}>Costos oper.</Text>}
        </View>
        {lineas.map((l, idx) => (
          <View key={l.id} style={[s.tablaFila, { borderColor: pal.borde }]} wrap={false}>
            <Text style={s.colArticulo}>{l.descripcion}</Text>
            <Text style={s.colCant}>{l.cantidad}</Text>
            <Text style={[s.colUnidad, s.textoGris]}>{l.producto?.unidad || 'unidad'}</Text>
            <Text style={[s.colMoneda, s.textoGris]}>{formatQ(l.costo_unitario)}</Text>
            <Text style={s.colMoneda}>{formatQ(l.precio_unitario)}</Text>
            <Text style={[s.colMoneda, s.negrita]}>{formatQ(l.subtotal_linea)}</Text>
            {cotizacion.prorratear_costos_operativos && (
              <Text style={[s.colMoneda, { color: '#b45309' }]}>{formatQ(prorrateoPorLinea[idx] ?? 0)}</Text>
            )}
          </View>
        ))}

        {costosOperativos.length > 0 && (
          <View style={{ marginTop: 12 }}>
            <Text style={s.apartadoTitulo}>Costos operativos adicionales</Text>
            <View style={[s.tablaHeadFina, { borderColor: pal.borde }]}>
              <Text style={s.colConcepto}>Concepto</Text>
              <Text style={s.colCant}>Cant.</Text>
              <Text style={s.colUnidad}>Días/tiempos</Text>
              <Text style={s.colMoneda}>Costo unit.</Text>
              <Text style={s.colMoneda}>Total</Text>
            </View>
            {costosOperativos.map((c) => (
              <View key={c.id} style={[s.tablaFilaFina, { borderColor: pal.borde }]} wrap={false}>
                <Text style={s.colConcepto}>{c.concepto}</Text>
                <Text style={s.colCant}>{c.cantidad}</Text>
                <Text style={s.colUnidad}>{c.dias}</Text>
                <Text style={s.colMoneda}>{formatQ(c.costo_unitario)}</Text>
                <Text style={[s.colMoneda, s.negrita]}>{formatQ(c.cantidad * c.dias * c.costo_unitario)}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={s.filaResumenes} wrap={false}>
          <View style={[s.resumen, { backgroundColor: pal.fondoAlterno }]}>
            <Text style={s.apartadoTitulo}>Resumen fiscal</Text>
            <FilaResumen label="Subtotal (incluye IVA)" valor={cotizacion.subtotal} />
            <FilaResumen label="Descuentos" valor={-cotizacion.total_descuentos} />
            <FilaResumen label="Total cotizado" valor={cotizacion.total_cotizado} negrita />
            <FilaResumen label="Venta neta base (sin IVA)" valor={cotizacion.base_gravable} />
            <FilaResumen label={`IVA (${(parametros.iva_porcentaje * 100).toFixed(0)}%)`} valor={cotizacion.iva_monto} />
            <FilaResumen label="Retención ISR" valor={-cotizacion.isr_retencion} color="#dc2626" />
            <FilaResumen label={`Retención IVA (${(parametros.retencion_iva_porcentaje * 100).toFixed(0)}%)`} valor={-cotizacion.iva_retencion} color="#dc2626" />
            <FilaResumen label="Pago neto a la empresa" valor={cotizacion.pago_neto_empresa} negrita color="#047857" />
          </View>
          <View style={[s.resumen, { backgroundColor: pal.fondoAlterno, marginLeft: 10 }]}>
            <Text style={s.apartadoTitulo}>Utilidad y comisión</Text>
            <FilaResumen label="Costo total productos/servicios" valor={cotizacion.costo_total_productos} />
            <FilaResumen label="+ Gastos operativos" valor={cotizacion.costos_operativos_total} />
            <FilaResumen label="= Costo total operación" valor={cotizacion.costo_total_operacion} negrita />
            <FilaResumen label="Utilidad bruta (venta sin IVA - costo)" valor={cotizacion.utilidad_bruta} negrita color={pal.primario} />
            <FilaResumen label="− Retención ISR" valor={-cotizacion.isr_retencion} color="#dc2626" />
            <FilaResumen label="= Utilidad neta (base comisión)" valor={cotizacion.utilidad_neta} negrita color={pal.primario} />
            <View style={s.filaSubtotal}><Text style={s.textoGris}>% Margen (neto)</Text><Text style={s.negrita}>{(cotizacion.margen_utilidad_pct * 100).toFixed(2)}%</Text></View>
            <View style={s.filaSubtotal}><Text style={s.textoGris}>% Comisión vendedor</Text><Text style={s.negrita}>{(cotizacion.comision_estimada_pct * 100).toFixed(2)}%</Text></View>
            <FilaResumen label="Comisión estimada" valor={cotizacion.comision_estimada_monto} color="#b45309" />
            <FilaResumen label="Ganancia neta empresa" valor={cotizacion.ganancia_neta_estimada} negrita color="#047857" />
          </View>
        </View>

        {plantilla?.apartados?.map((ap, idx) => (
          ap.titulo || ap.contenido ? (
            <View key={idx} style={[s.apartado, { borderColor: pal.borde }]} wrap={false}>
              {ap.titulo && <Text style={s.apartadoTitulo}>{ap.titulo.toUpperCase()}</Text>}
              <Text style={s.textoGrisOscuro}>{ap.contenido}</Text>
            </View>
          ) : null
        ))}

        {plantilla?.condiciones_comerciales && (
          <View style={[s.cuadroAcento, { borderColor: pal.acento, backgroundColor: pal.fondo }]} wrap={false}>
            <Text style={s.apartadoTitulo}>CONDICIONES COMERCIALES ({plantilla.nombre})</Text>
            {plantilla.condiciones_comerciales.split('\n').map((l) => l.trim()).filter(Boolean).map((linea, idx) => (
              <Text key={idx} style={s.textoGrisOscuro}>{idx + 1}. {linea}</Text>
            ))}
          </View>
        )}

        {/* Nota: el estilo de <Page> deliberadamente no lleva "lineHeight" — puesto ahí
            hace que este pie de página fijo deje de pintarse (comportamiento verificado de
            @react-pdf/renderer 4.9, ver también PrintQuote.tsx). El interlineado por
            defecto ya se ve bien. */}
        <Text style={s.footer} fixed render={({ pageNumber, totalPages }) => `${parametros.nombre_comercial || parametros.razon_social} — Interno     ·     Página ${pageNumber} de ${totalPages}`} />
      </Page>
    </Document>
  );
}

function FilaResumen({ label, valor, negrita, color }: { label: string; valor: number; negrita?: boolean; color?: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 1.5 }}>
      <Text style={{ fontSize: 8.5, fontWeight: negrita ? 700 : 400, color: color ?? (negrita ? '#1e293b' : '#475569') }}>{label}</Text>
      <Text style={{ fontSize: 8.5, fontWeight: negrita ? 700 : 400, color: color ?? (negrita ? '#1e293b' : '#475569') }}>{formatQ(valor)}</Text>
    </View>
  );
}

function crearEstilos(pal: ReturnType<typeof paletaPdf>) {
  return StyleSheet.create({
    page: { fontFamily: PDF_FONT, fontSize: 9, paddingTop: 0, paddingBottom: 50, paddingHorizontal: 32, color: '#1e293b' },
    banner: { flexDirection: 'row', width: '100%', height: 8, marginBottom: 14 },
    bannerMitad: { flex: 1, height: 8 },
    avisoInterno: { borderRadius: 6, paddingVertical: 5, marginBottom: 12, alignItems: 'center' },
    avisoInternoTexto: { color: '#fff', fontWeight: 700, fontSize: 8, letterSpacing: 1 },
    cabecera: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingBottom: 12 },
    cabeceraEmisor: { flexDirection: 'row', alignItems: 'flex-start', maxWidth: 280 },
    logo: { width: 52, height: 52, objectFit: 'contain' },
    logoPlaceholder: { width: 52, height: 52, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    logoPlaceholderTexto: { color: '#fff', fontSize: 13, fontWeight: 700 },
    emisorNombre: { fontSize: 11, fontWeight: 700, marginBottom: 2 },
    cabeceraFolio: { alignItems: 'flex-end' },
    tituloDoc: { fontSize: 18, fontWeight: 700, marginBottom: 3 },
    textoGris: { color: '#64748b', fontSize: 8.5 },
    textoGrisOscuro: { color: '#475569', fontSize: 8.5 },
    negrita: { fontWeight: 700 },
    filaDosColumnas: { flexDirection: 'row', marginTop: 12 },
    tarjeta: { flex: 1, borderRadius: 8, padding: 8 },
    tarjetaTitulo: { fontWeight: 700, textTransform: 'uppercase', fontSize: 7.5, marginBottom: 3, letterSpacing: 0.5 },
    linea: { fontSize: 8.5, marginBottom: 1 },
    cuadroAcento: { marginTop: 16, borderLeftWidth: 3, borderRadius: 4, padding: 8 },
    tablaHead: { flexDirection: 'row', borderBottomWidth: 1.5, paddingBottom: 5, textTransform: 'uppercase', fontSize: 7 },
    tablaFila: { flexDirection: 'row', borderBottomWidth: 1, paddingVertical: 5, alignItems: 'center' },
    tablaHeadFina: { flexDirection: 'row', borderBottomWidth: 1, paddingBottom: 4, textTransform: 'uppercase', fontSize: 6.5, color: '#94a3b8', marginTop: 4 },
    tablaFilaFina: { flexDirection: 'row', borderBottomWidth: 1, paddingVertical: 4 },
    colArticulo: { flex: 1, paddingRight: 6 },
    colConcepto: { flex: 1, paddingRight: 6, fontSize: 8 },
    colCant: { width: 40, textAlign: 'right' },
    colUnidad: { width: 56, textAlign: 'right' },
    colMoneda: { width: 62, textAlign: 'right' },
    apartado: { marginTop: 12, borderTopWidth: 1, paddingTop: 8 },
    apartadoTitulo: { fontWeight: 700, color: '#334155', fontSize: 8.5, marginBottom: 4 },
    filaResumenes: { flexDirection: 'row', marginTop: 14 },
    resumen: { flex: 1, borderRadius: 6, padding: 8 },
    filaSubtotal: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 1.5, fontSize: 8.5 },
    footer: { position: 'absolute', bottom: 20, left: 32, right: 32, textAlign: 'center', fontSize: 7.5, color: '#94a3b8' },
  });
}
