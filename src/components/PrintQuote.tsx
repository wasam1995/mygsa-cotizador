import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import { formatQ, formatFecha } from '@/lib/utils';
import { paletaPdf, PDF_FONT } from '@/lib/pdf/theme';
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

// Documento imprimible "versión cliente" — reescrito en Etapa 7 con @react-pdf/renderer
// (antes era un <div> HTML capturado como imagen con html2canvas + jsPDF). Ahora genera
// un PDF vectorial real: texto seleccionable, tamaño de archivo menor, y paginación
// automática de verdad en vez de "rebanar" una imagen. Este mismo componente sirve tanto
// para la vista previa en pantalla (envuelto en <PdfPreview>, ver ese componente) como
// para el archivo que se descarga (con pdf(<PrintQuote .../>).toBlob()) — un solo lugar
// define cómo se ve el documento, así que preview y descarga nunca pueden desalinearse.
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
  const pal = paletaPdf(parametros);
  const s = crearEstilos(pal);

  const condiciones = (plantilla?.condiciones_comerciales?.trim()
    ? plantilla.condiciones_comerciales.split('\n').map((l) => l.trim()).filter(Boolean)
    : CONDICIONES_DEFECTO);
  const leyendaPie = plantilla?.leyenda_pie?.trim() || parametros.leyenda_cotizacion;
  const tituloTabla = plantilla?.titulo_tabla_items || 'DETALLE DE PRODUCTOS Y SERVICIOS';
  const firmaEmisor = plantilla?.texto_firma_emisor || 'Autorizado por (Asesor)';
  const firmaCliente = plantilla?.texto_firma_cliente || 'Aceptado por (Cliente / Fecha)';
  // Cada apartado de la plantilla se imprime en el punto del documento que se eligió al
  // crearlo (ver PosicionApartado) — si no tiene posición asignada (plantillas guardadas
  // antes de esta opción), se imprime donde siempre se imprimió: justo antes de las
  // condiciones comerciales.
  const apartados = plantilla?.apartados ?? [];
  const apartadosPor = (pos: NonNullable<typeof apartados[number]['posicion']>) =>
    apartados.filter((ap) => (ap.posicion ?? 'antes_condiciones') === pos);
  const renderApartados = (lista: typeof apartados) => lista.map((ap, idx) => (
    (ap.titulo || ap.contenido) ? (
      <View key={`${ap.titulo}-${idx}`} style={[s.apartado, { borderColor: pal.borde }]} wrap={false}>
        {ap.titulo && <Text style={s.apartadoTitulo}>{ap.titulo.toUpperCase()}</Text>}
        <Text style={s.textoGrisOscuro}>{ap.contenido}</Text>
      </View>
    ) : null
  ));

  return (
    <Document title={`Cotización ${cotizacion.numero_sistema_externo || cotizacion.numero_interno}`}>
      <Page size="A4" style={s.page}>
        {anulada && (
          <View style={s.marcaAguaCapa} fixed>
            <Text style={s.marcaAgua}>ANULADA</Text>
          </View>
        )}

        {/* Banner superior corporativo — dos tonos (primario / acento) en vez de un
            degradado real: @react-pdf/renderer no terminó pintando el <LinearGradient>
            de forma confiable en las pruebas, así que se prefirió esta versión simple,
            que siempre se ve bien. */}
        <View style={s.banner}>
          <View style={[s.bannerMitad, { backgroundColor: pal.primario }]} />
          <View style={[s.bannerMitad, { backgroundColor: pal.acento }]} />
        </View>

        {/* Cabecera dual: emisor a la izquierda, folio/fecha/validez/moneda a la derecha */}
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
              <Text style={s.textoGris}>{parametros.direccion_empresa}</Text>
              <Text style={s.textoGris}>{parametros.telefono_empresa} · {parametros.correo_empresa}</Text>
            </View>
          </View>
          <View style={s.cabeceraFolio}>
            <Text style={[s.tituloDoc, { color: pal.acentoOscuro }]}>COTIZACIÓN</Text>
            <Text style={s.textoGris}>Folio: <Text style={{ color: pal.acento, fontWeight: 700 }}>{cotizacion.numero_sistema_externo || cotizacion.numero_interno}</Text></Text>
            <Text style={s.textoGris}>Fecha: {formatFecha(cotizacion.fecha_emision)}</Text>
            <Text style={s.textoGris}>Válida hasta: {formatFecha(cotizacion.fecha_vencimiento)}</Text>
            <Text style={s.textoGris}>Moneda: Quetzales (GTQ)</Text>
            {mostrarVendedor && (
              <Text style={s.textoGris}>Vendedor: {vendedorNombre}{cotizacion.vendedor_telefono ? ` · ${cotizacion.vendedor_telefono}` : ''}{vendedorCorreo ? ` · ${vendedorCorreo}` : ''}</Text>
            )}
          </View>
        </View>

        {/* Tarjetas de información en doble columna */}
        <View style={s.filaDosColumnas}>
          <View style={[s.tarjeta, { backgroundColor: pal.fondo }]}>
            <Text style={[s.tarjetaTitulo, { color: pal.primario }]}>Información del cliente</Text>
            <Text style={s.linea}><Text style={s.negrita}>Nombre:</Text> {clienteNombre}</Text>
            <Text style={s.linea}><Text style={s.negrita}>Dirección:</Text> {clienteDireccion || '—'}</Text>
            <Text style={s.linea}><Text style={s.negrita}>Teléfono:</Text> {cotizacion.cliente_telefono || '—'}</Text>
            {clienteNit && <Text style={s.linea}><Text style={s.negrita}>NIT:</Text> {clienteNit}</Text>}
            {clienteContacto && <Text style={s.linea}><Text style={s.negrita}>Atención:</Text> {clienteContacto}</Text>}
          </View>
          <View style={[s.tarjeta, { backgroundColor: pal.fondo, marginLeft: 10 }]}>
            <Text style={[s.tarjetaTitulo, { color: pal.primario }]}>Detalles del proyecto / visita técnica</Text>
            <Text style={s.textoGrisOscuro}>{cotizacion.comentario || 'Sin observaciones adicionales.'}</Text>
          </View>
        </View>

        {/* Cuadro de presentación institucional */}
        {plantilla?.texto_institucional && (
          <View style={[s.cuadroAcento, { borderColor: pal.acento, backgroundColor: pal.fondo }]}>
            <Text style={s.textoGrisOscuro}>{plantilla.texto_institucional}</Text>
          </View>
        )}

        {renderApartados(apartadosPor('antes_tabla'))}

        {/* Tabla de ítems */}
        <Text style={[s.seccionTitulo, { color: pal.primario }]}>{tituloTabla}</Text>
        <View style={[s.tablaHead, { borderColor: pal.acento }]}>
          <Text style={s.colFoto}>Foto</Text>
          <Text style={s.colDescripcion}>Descripción</Text>
          <Text style={s.colCant}>Cant.</Text>
          <Text style={s.colUnidad}>Unidad</Text>
          {mostrarPrecios && <Text style={s.colPrecio}>Precio</Text>}
          {mostrarPrecios && <Text style={s.colPrecio}>Total</Text>}
        </View>
        {lineas.map((l) => {
          const foto = l.incluir_foto ? l.producto?.imagen_url : null;
          return (
            <View key={l.id} style={[s.tablaFila, { borderColor: pal.borde }]} wrap={false}>
              <View style={s.colFoto}>
                {foto ? (
                  <Image src={foto} style={s.fotoProducto} />
                ) : (
                  <View style={[s.fotoVacia, { backgroundColor: pal.fondo }]} />
                )}
              </View>
              <Text style={s.colDescripcion}>{l.descripcion}</Text>
              <Text style={s.colCant}>{l.cantidad}</Text>
              <Text style={[s.colUnidad, s.textoGris]}>{l.producto?.unidad || 'unidad'}</Text>
              {mostrarPrecios && <Text style={s.colPrecio}>{formatQ(l.precio_unitario)}</Text>}
              {mostrarPrecios && <Text style={[s.colPrecio, s.negrita]}>{formatQ(l.subtotal_linea)}</Text>}
            </View>
          );
        })}
        {!mostrarPrecios && (
          <Text style={s.notaSinPrecios}>Precios detallados por artículo omitidos — se muestra el precio total del paquete.</Text>
        )}

        {renderApartados(apartadosPor('antes_totales'))}

        {/* Totales alineados a la derecha */}
        <View style={s.filaTotales} wrap={false}>
          <View style={s.cajaLetras}>
            <Text style={s.cajaLetrasTitulo}>EN LETRAS</Text>
            <Text style={s.cajaLetrasTexto}>{cotizacion.total_en_letras}</Text>
          </View>
          <View style={[s.cajaTotales, { backgroundColor: pal.fondo, borderColor: pal.borde }]}>
            <View style={s.filaSubtotal}><Text style={s.textoGris}>Subtotal (incluye IVA)</Text><Text>{formatQ(cotizacion.subtotal)}</Text></View>
            {cotizacion.total_descuentos > 0 && (
              <View style={s.filaSubtotal}><Text style={{ color: pal.acentoOscuro }}>Descuento especial</Text><Text style={{ color: pal.acentoOscuro }}>-{formatQ(cotizacion.total_descuentos)}</Text></View>
            )}
            <View style={[s.filaTotal, { backgroundColor: pal.fondoAlterno }]}>
              <Text style={[s.negrita, { color: pal.acentoOscuro, fontSize: 11 }]}>TOTAL</Text>
              <Text style={[s.negrita, { color: pal.acentoOscuro, fontSize: 11 }]}>{formatQ(cotizacion.total_cotizado)}</Text>
            </View>
          </View>
        </View>

        {renderApartados(apartadosPor('antes_condiciones'))}

        {/* Términos y condiciones */}
        <View style={[s.cuadroAcento, { borderColor: pal.acento, backgroundColor: pal.fondo, marginTop: 12 }]} wrap={false}>
          <Text style={s.apartadoTitulo}>TÉRMINOS Y CONDICIONES COMERCIALES</Text>
          {condiciones.map((linea, idx) => (
            <Text key={idx} style={s.textoGrisOscuro}>{idx + 1}. {linea}</Text>
          ))}
        </View>

        {renderApartados(apartadosPor('despues_condiciones'))}

        {/* Bloque de firmas */}
        <View style={s.filaFirmas} wrap={false}>
          <View style={s.firma}><Text style={s.firmaTexto}>{firmaEmisor}</Text></View>
          <View style={s.firma}><Text style={s.firmaTexto}>{firmaCliente}</Text></View>
        </View>

        <Text style={[s.leyendaPie, { borderColor: pal.borde }]}>{leyendaPie}</Text>

        {/* Nota: el estilo de <Page> deliberadamente no lleva "lineHeight" — puesto ahí
            hace que este pie de página fijo deje de pintarse (comportamiento verificado de
            @react-pdf/renderer 4.9). El interlineado por defecto ya se ve bien. */}
        <Text style={s.footer} fixed render={({ pageNumber, totalPages }) => `${parametros.nombre_comercial || parametros.razon_social}     ·     Página ${pageNumber} de ${totalPages}`} />
      </Page>
    </Document>
  );
}

function crearEstilos(pal: ReturnType<typeof paletaPdf>) {
  return StyleSheet.create({
    page: { fontFamily: PDF_FONT, fontSize: 9, paddingTop: 0, paddingBottom: 50, paddingHorizontal: 32, color: '#1e293b' },
    banner: { flexDirection: 'row', width: '100%', height: 8, marginBottom: 22 },
    bannerMitad: { flex: 1, height: 8 },
    marcaAguaCapa: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
    marcaAgua: { fontSize: 56, fontWeight: 700, color: '#ef4444', opacity: 0.35, transform: 'rotate(-25deg)' },
    cabecera: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingBottom: 12 },
    cabeceraEmisor: { flexDirection: 'row', alignItems: 'flex-start', maxWidth: 320 },
    logo: { width: 84, height: 84, objectFit: 'contain' },
    logoPlaceholder: { width: 84, height: 84, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    logoPlaceholderTexto: { color: '#fff', fontSize: 18, fontWeight: 700 },
    emisorNombre: { fontSize: 11, fontWeight: 700, marginBottom: 2 },
    cabeceraFolio: { alignItems: 'flex-end' },
    tituloDoc: { fontSize: 20, fontWeight: 700, marginBottom: 3 },
    textoGris: { color: '#64748b', fontSize: 8.5 },
    textoGrisOscuro: { color: '#475569', fontSize: 8.5 },
    negrita: { fontWeight: 700 },
    filaDosColumnas: { flexDirection: 'row', marginTop: 12 },
    tarjeta: { flex: 1, borderRadius: 8, padding: 8 },
    tarjetaTitulo: { fontWeight: 700, textTransform: 'uppercase', fontSize: 7.5, marginBottom: 3, letterSpacing: 0.5 },
    linea: { fontSize: 8.5, marginBottom: 1 },
    cuadroAcento: { marginTop: 12, borderLeftWidth: 3, borderRadius: 4, padding: 8 },
    seccionTitulo: { marginTop: 16, marginBottom: 6, fontWeight: 700, textTransform: 'uppercase', fontSize: 9, letterSpacing: 0.5 },
    tablaHead: { flexDirection: 'row', borderBottomWidth: 1.5, paddingBottom: 5, textTransform: 'uppercase', fontSize: 7 },
    tablaFila: { flexDirection: 'row', borderBottomWidth: 1, paddingVertical: 5, alignItems: 'center' },
    colFoto: { width: 40 },
    colDescripcion: { flex: 1, paddingRight: 6 },
    colCant: { width: 42, textAlign: 'right' },
    colUnidad: { width: 52, textAlign: 'right' },
    colPrecio: { width: 62, textAlign: 'right' },
    fotoProducto: { width: 34, height: 34, borderRadius: 3, objectFit: 'cover' },
    fotoVacia: { width: 34, height: 34, borderRadius: 3 },
    notaSinPrecios: { marginTop: 4, textAlign: 'right', fontStyle: 'italic', color: '#94a3b8', fontSize: 8 },
    filaTotales: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
    cajaLetras: { maxWidth: 220, borderLeftWidth: 3, borderLeftColor: '#34d399', backgroundColor: '#ecfdf5', borderRadius: 6, padding: 8 },
    cajaLetrasTitulo: { fontWeight: 700, color: '#065f46', fontSize: 8 },
    cajaLetrasTexto: { marginTop: 3, fontStyle: 'italic', color: '#047857', fontSize: 8.5 },
    cajaTotales: { width: 220, borderRadius: 6, borderWidth: 1, padding: 8 },
    filaSubtotal: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2, fontSize: 8.5 },
    filaTotal: { flexDirection: 'row', justifyContent: 'space-between', borderRadius: 6, paddingVertical: 5, paddingHorizontal: 6, marginTop: 2 },
    apartado: { marginTop: 12, borderTopWidth: 1, paddingTop: 8 },
    apartadoTitulo: { fontWeight: 700, color: '#334155', fontSize: 8.5, marginBottom: 3 },
    filaFirmas: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 64, gap: 48 },
    firma: { flex: 1, borderTopWidth: 1, borderTopColor: '#94a3b8', paddingTop: 6, textAlign: 'center' },
    firmaTexto: { color: '#64748b', fontSize: 8.5 },
    leyendaPie: { marginTop: 20, borderTopWidth: 1, borderStyle: 'dashed', paddingTop: 10, textAlign: 'center', color: '#64748b', fontSize: 7.5, lineHeight: 1.5 },
    footer: { position: 'absolute', bottom: 20, left: 32, right: 32, textAlign: 'center', fontSize: 7.5, color: '#94a3b8' },
  });
}
