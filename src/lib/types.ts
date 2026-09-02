// Tipos de la base de datos (espejo manual del esquema en /database/01_schema.sql).
// Para regenerar automáticamente desde Supabase:
//   npx supabase gen types typescript --project-id <id> --schema app > src/lib/types.ts
// (y luego re-agregar los tipos de conveniencia al final de este archivo).

export type EstadoCotizacion =
  | 'PROSPECTO'
  | 'PEND_AUTORIZAR'
  | 'ENVIADO_CLIENTE'
  | 'AUTORIZADO_CLIENTE'
  | 'FACTURADO'
  | 'ANULADO';

export type TipoMovimientoInventario =
  | 'ENTRADA' | 'SALIDA' | 'RESERVA' | 'LIBERA_RESERVA' | 'ANULACION' | 'AJUSTE';

export interface Rol {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  es_sistema: boolean;
  activo: boolean;
}

export interface Permiso {
  id: string;
  codigo: string;
  modulo: string;
  descripcion: string;
}

export interface Usuario {
  id: string;
  nombre_completo: string;
  correo: string;
  telefono: string | null;
  rol_id: string;
  activo: boolean;
}

export interface Vendedor {
  id: string;
  usuario_id: string | null;
  codigo: string;
  nombre_completo: string;
  telefono: string | null;
  correo: string | null;
  porcentaje_comision: number;
  activo: boolean;
}

export interface Cliente {
  id: string;
  codigo: string;
  nombre_razon: string;
  nit: string | null;
  direccion: string | null;
  telefono: string | null;
  contacto: string | null;
  es_retenedor_iva: boolean;
  activo: boolean;
}

export interface Producto {
  id: string;
  codigo: string;
  nombre: string;
  color_variante: string | null;
  unidad: string;
  costo_unitario: number;
  precio_lista: number;
  stock_actual: number;
  stock_reservado: number;
  stock_minimo: number;
  activo: boolean;
  es_fuera_inventario: boolean;
  observacion: string | null;
  imagen_url: string | null;
  especificaciones: string | null;
}

export interface ParametrosFiscales {
  id: number;
  iva_porcentaje: number;
  isr_tramo1_limite: number;
  isr_tramo1_porcentaje: number;
  isr_tramo2_porcentaje: number;
  isr_tramo2_fijo: number;
  vigencia_dias: number;
  descuento_umbral_autorizacion: number;
  razon_social: string;
  nombre_comercial: string;
  nit_empresa: string | null;
  direccion_empresa: string | null;
  telefono_empresa: string | null;
  correo_empresa: string | null;
  empresa_es_retenedor_iva: boolean;
  leyenda_cotizacion: string;
  margen_sugerido_defecto: number;
}

export interface Cotizacion {
  id: string;
  numero_interno: string;
  numero_sistema_externo: string | null;
  fecha_emision: string;
  fecha_vencimiento: string | null;
  vendedor_id: string;
  vendedor_telefono: string | null;
  cliente_id: string | null;
  cliente_nombre_libre: string | null;
  cliente_nit: string | null;
  cliente_direccion: string | null;
  cliente_telefono: string | null;
  estado: EstadoCotizacion;
  subtotal: number;
  descuento_global_pct: number;
  descuento_global_monto: number;
  total_descuentos: number;
  base_gravable: number;
  iva_monto: number;
  total_cotizado: number;
  isr_retencion: number;
  cliente_es_retenedor_iva: boolean;
  iva_retencion: number;
  pago_neto_empresa: number;
  total_en_letras: string | null;
  comentario: string | null;
  porcentaje_descuento_efectivo: number;
  requiere_autorizacion: boolean;
  autorizado_por: string | null;
  autorizado_en: string | null;
  facturado_por: string | null;
  facturado_en: string | null;
  anulado_por: string | null;
  anulado_en: string | null;
  motivo_anulacion: string | null;
  creado_por: string;
  creado_en: string;
  actualizado_en: string;
  // Resumen financiero interno (Módulo Avanzado de Cotizaciones — Etapa 1)
  costo_total_productos: number;
  costos_operativos_total: number;
  costo_total_operacion: number;
  utilidad_bruta: number;
  margen_utilidad_pct: number;
  escala_comision_rango: number | null;
  comision_estimada_pct: number;
  comision_estimada_monto: number;
  ganancia_neta_estimada: number;
  // Edición y visibilidad (Etapa 2)
  prorratear_costos_operativos: boolean;
  mostrar_precios_unitarios_cliente: boolean;
  mostrar_vendedor_cliente: boolean;
}

export type ModoPrecioLinea = 'FIJO' | 'COSTO_MARGEN';

export interface CotizacionDetalle {
  id: string;
  cotizacion_id: string;
  linea: number;
  producto_id: string | null;
  es_fuera_inventario: boolean;
  codigo_mostrado: string | null;
  descripcion: string;
  cantidad: number;
  costo_unitario: number;
  precio_unitario: number;
  descuento_linea_pct: number;
  descuento_linea_monto: number;
  subtotal_linea: number;
  modo_precio: ModoPrecioLinea;
  margen_pct: number | null;
  incluir_foto: boolean;
}

export interface CotizacionCostoOperativo {
  id: string;
  cotizacion_id: string;
  orden: number;
  concepto: string;
  cantidad: number;
  dias: number;
  costo_unitario: number;
}

export interface EscalaComision {
  rango: number;
  desde_pct: number;
  hasta_pct: number | null;
  porcentaje_comision: number;
  observacion: string | null;
}

export interface CotizacionHistorialEstado {
  id: string;
  cotizacion_id: string;
  estado_anterior: EstadoCotizacion | null;
  estado_nuevo: EstadoCotizacion;
  usuario_id: string | null;
  comentario: string | null;
  creado_en: string;
}

export interface CotizacionAdjunto {
  id: string;
  cotizacion_id: string;
  nombre_archivo: string;
  ruta_storage: string;
  tipo: string;
  subido_por: string | null;
  creado_en: string;
}

export interface MovimientoInventario {
  id: string;
  producto_id: string;
  tipo: TipoMovimientoInventario;
  cantidad: number;
  cotizacion_id: string | null;
  numero_cotizacion: string | null;
  cliente_nombre: string | null;
  vendedor_nombre: string | null;
  stock_resultante: number | null;
  comentario: string | null;
  creado_en: string;
}

export interface ComisionCalculada {
  id: string;
  cotizacion_id: string;
  vendedor_id: string;
  base_calculo: number;
  porcentaje_aplicado: number;
  monto_comision: number;
  fecha_facturacion: string;
}

export interface AuditoriaRegistro {
  id: number;
  tabla: string;
  registro_id: string | null;
  accion: 'INSERT' | 'UPDATE' | 'DELETE';
  usuario_id: string | null;
  usuario_nombre: string | null;
  datos_anteriores: Record<string, unknown> | null;
  datos_nuevos: Record<string, unknown> | null;
  creado_en: string;
}

// Genérico mínimo requerido por los tipos de @supabase/supabase-js. No representa el
// esquema completo campo por campo (ver arriba las interfaces de conveniencia que sí
// usa el resto de la aplicación) — evita tener que mantener dos fuentes de verdad.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any;

export const ESTADOS_LABEL: Record<EstadoCotizacion, string> = {
  PROSPECTO: 'Prospecto',
  PEND_AUTORIZAR: 'Pend. Autorizar',
  ENVIADO_CLIENTE: 'Enviado a Cliente',
  AUTORIZADO_CLIENTE: 'Aprob. Cliente · Pend. Facturar',
  FACTURADO: 'Facturado',
  ANULADO: 'Anulado',
};

export const ESTADOS_COLOR: Record<EstadoCotizacion, string> = {
  PROSPECTO: 'bg-slate-100 text-slate-700 border-slate-300',
  PEND_AUTORIZAR: 'bg-amber-100 text-amber-800 border-amber-300',
  ENVIADO_CLIENTE: 'bg-sky-100 text-sky-800 border-sky-300',
  AUTORIZADO_CLIENTE: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  FACTURADO: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  ANULADO: 'bg-red-100 text-red-700 border-red-300',
};
