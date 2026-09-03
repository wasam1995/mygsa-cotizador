import { numeroALetras } from '@/lib/fiscal';
import type { Cotizacion, CotizacionCostoOperativo, CotizacionDetalle } from '@/lib/types';

// Cotización y líneas "de muestra" — se usan únicamente para mostrar una vista previa en
// vivo mientras se edita una plantilla o los parámetros visuales (Etapa 7): no existen en
// la base de datos, solo sirven para que el documento @react-pdf/renderer tenga algo
// realista que dibujar mientras la persona ajusta textos/colores, sin depender de abrir
// una cotización real ya guardada.
export function crearCotizacionDemo(): { cotizacion: Cotizacion; lineas: (CotizacionDetalle & { producto: { imagen_url: string | null; unidad?: string | null } | null })[]; costosOperativos: CotizacionCostoOperativo[]; prorrateoPorLinea: number[] } {
  const subtotal = 24850;
  const descuento = 0;
  const baseGravable = round2((subtotal - descuento) / 1.12);
  const iva = round2(subtotal - descuento - baseGravable);

  const cotizacion: Cotizacion = {
    id: 'demo',
    numero_interno: 'COT-DEMO-001',
    numero_sistema_externo: '4521',
    fecha_emision: new Date().toISOString().slice(0, 10),
    fecha_vencimiento: new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10),
    vendedor_id: 'demo',
    vendedor_telefono: '+50212345678',
    cliente_id: null,
    cliente_nombre_libre: 'Inversiones del Valle, S.A.',
    cliente_nit: '1234567-8',
    cliente_direccion: 'Zona 10, Ciudad de Guatemala',
    cliente_telefono: '+50287654321',
    estado: 'PROSPECTO',
    subtotal,
    descuento_global_pct: 0,
    descuento_global_monto: descuento,
    total_descuentos: descuento,
    base_gravable: baseGravable,
    iva_monto: iva,
    total_cotizado: subtotal - descuento,
    isr_retencion: round2(baseGravable * 0.05),
    cliente_es_retenedor_iva: false,
    iva_retencion: 0,
    pago_neto_empresa: round2(subtotal - descuento),
    total_en_letras: numeroALetras(subtotal - descuento),
    comentario: 'Instalación de estructura metálica en bodega principal — visita técnica realizada el mes anterior.',
    porcentaje_descuento_efectivo: 0,
    requiere_autorizacion: false,
    autorizado_por: null,
    autorizado_en: null,
    facturado_por: null,
    facturado_en: null,
    anulado_por: null,
    anulado_en: null,
    motivo_anulacion: null,
    creado_por: 'demo',
    creado_en: new Date().toISOString(),
    actualizado_en: new Date().toISOString(),
    costo_total_productos: 16500,
    costos_operativos_total: 1200,
    costo_total_operacion: 17700,
    utilidad_bruta: round2(baseGravable - 17700),
    utilidad_neta: round2(baseGravable - 17700 - round2(baseGravable * 0.05)),
    margen_utilidad_pct: 0.21,
    escala_comision_rango: 1,
    comision_estimada_pct: 0.03,
    comision_estimada_monto: round2((subtotal - descuento) * 0.03),
    ganancia_neta_estimada: round2(baseGravable - 17700 - round2(baseGravable * 0.05) - (subtotal - descuento) * 0.03),
    prorratear_costos_operativos: true,
    mostrar_precios_unitarios_cliente: true,
    mostrar_vendedor_cliente: true,
    plantilla_id: null,
  };

  const lineas = [
    { id: 'l1', linea: 1, cantidad: 4, costo_unitario: 2100, precio_unitario: 2950, descripcion: 'Perfil estructural galvanizado 6" x 3 m' },
    { id: 'l2', linea: 2, cantidad: 1, costo_unitario: 3200, precio_unitario: 4300, descripcion: 'Cubierta de lámina troquelada, instalación incluida' },
    { id: 'l3', linea: 3, cantidad: 12, costo_unitario: 180, precio_unitario: 260, descripcion: 'Pernos de anclaje de alta resistencia' },
  ].map((l): CotizacionDetalle & { producto: { imagen_url: string | null; unidad?: string | null } | null } => ({
    id: l.id,
    cotizacion_id: 'demo',
    linea: l.linea,
    producto_id: null,
    es_fuera_inventario: true,
    codigo_mostrado: null,
    descripcion: l.descripcion,
    cantidad: l.cantidad,
    costo_unitario: l.costo_unitario,
    precio_unitario: l.precio_unitario,
    descuento_linea_pct: 0,
    descuento_linea_monto: 0,
    subtotal_linea: round2(l.cantidad * l.precio_unitario),
    modo_precio: 'FIJO',
    margen_pct: null,
    incluir_foto: false,
    producto: null,
  }));

  const costosOperativos: CotizacionCostoOperativo[] = [
    { id: 'c1', cotizacion_id: 'demo', orden: 1, concepto: 'Viáticos cuadrilla de instalación', cantidad: 3, dias: 2, costo_unitario: 100 },
    { id: 'c2', cotizacion_id: 'demo', orden: 2, concepto: 'Flete de materiales', cantidad: 1, dias: 1, costo_unitario: 600 },
  ];

  const prorrateoPorLinea = lineas.map((l) => round2((l.subtotal_linea / subtotal) * cotizacion.costos_operativos_total));

  return { cotizacion, lineas, costosOperativos, prorrateoPorLinea };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
