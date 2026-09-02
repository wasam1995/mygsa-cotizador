// Espejo en JS de la lógica fiscal y financiera que vive (y manda) en la base de datos
// (database/03_functions_triggers.sql + database/09_modulo_avanzado_cotizaciones.sql ->
// app.recalcular_cotizacion). Se usa SOLO para mostrar una vista previa instantánea en el
// formulario del cotizador; el cálculo que realmente se guarda siempre lo recalcula el
// trigger de Postgres, así que ambos lados nunca pueden desincronizarse en los datos
// persistidos.
//
// IMPORTANTE (Módulo Avanzado de Cotizaciones — Etapa 1): el "Precio Unitario" que digita
// el vendedor YA INCLUYE el IVA (igual que la hoja "Cotizacion" del Excel de referencia).
// La base gravable y el IVA se calculan hacia atrás a partir del total.

import type { EscalaComision, ParametrosFiscales } from './types';

export interface LineaCalculo {
  cantidad: number;
  precio_unitario: number;
  costo_unitario: number;
  descuento_linea_monto: number;
}

export interface CostoOperativoCalculo {
  cantidad: number;
  dias: number;
  costo_unitario: number;
}

export interface ResultadoFiscal {
  // Fiscal (lo que paga / retiene el cliente)
  subtotalBruto: number;
  descuentoLineas: number;
  descuentoGlobal: number;
  totalDescuentos: number;
  baseGravable: number;
  ivaMonto: number;
  totalCotizado: number; // ya incluye IVA
  isrRetencion: number;
  ivaRetencion: number;
  pagoNetoEmpresa: number;
  porcentajeDescuentoEfectivo: number;
  requiereAutorizacion: boolean;
  // Financiero interno (nunca se muestra al cliente)
  costoTotalProductos: number;
  costosOperativosTotal: number;
  costoTotalOperacion: number;
  utilidadBruta: number; // Venta Neta Base (SIN IVA) - costo de operación
  utilidadNeta: number; // utilidadBruta - ISR — base real de la comisión (Etapa 5)
  margenUtilidadPct: number; // fracción, ej 0.4571 — utilidadNeta / baseGravable
  escala: EscalaComision | null;
  comisionEstimadaPct: number; // fracción
  comisionEstimadaMonto: number; // sobre utilidadNeta
  gananciaNetaEstimada: number;
}

export function calcularCotizacion(
  lineas: LineaCalculo[],
  opts: {
    descuentoGlobalPct: number;
    descuentoGlobalMonto: number;
    clienteEsRetenedorIva: boolean;
    parametros: ParametrosFiscales;
    costosOperativos: CostoOperativoCalculo[];
    escalasComision: EscalaComision[];
  }
): ResultadoFiscal {
  const { descuentoGlobalPct, descuentoGlobalMonto, clienteEsRetenedorIva, parametros, costosOperativos, escalasComision } = opts;

  const subtotalBruto = lineas.reduce((acc, l) => acc + l.cantidad * l.precio_unitario, 0);
  const descuentoLineas = lineas.reduce((acc, l) => acc + (l.descuento_linea_monto || 0), 0);
  const subtotalNeto = subtotalBruto - descuentoLineas;

  const descuentoGlobal = descuentoGlobalPct > 0
    ? round2(subtotalNeto * (descuentoGlobalPct / 100))
    : (descuentoGlobalMonto || 0);

  // Total cotizado = lo que paga el cliente; YA incluye IVA. Base y IVA se sacan hacia atrás.
  const totalCotizado = Math.max(subtotalNeto - descuentoGlobal, 0);
  const baseGravable = round2(totalCotizado / (1 + parametros.iva_porcentaje));
  const ivaMonto = round2(totalCotizado - baseGravable);

  const isrRetencion = baseGravable <= parametros.isr_tramo1_limite
    ? round2(baseGravable * parametros.isr_tramo1_porcentaje)
    : round2((baseGravable - parametros.isr_tramo1_limite) * parametros.isr_tramo2_porcentaje + parametros.isr_tramo2_fijo);

  const ivaRetencion = clienteEsRetenedorIva ? round2(ivaMonto * parametros.retencion_iva_porcentaje) : 0;
  const pagoNetoEmpresa = round2(totalCotizado - isrRetencion - ivaRetencion);

  const porcentajeDescuentoEfectivo = subtotalBruto > 0
    ? round3(((descuentoLineas + descuentoGlobal) / subtotalBruto) * 100)
    : 0;

  // --- Resumen financiero interno (Etapa 5: nuevo modelo) ----------------------------
  // Utilidad Bruta = Venta Neta Base SIN IVA (baseGravable) - Costo total de operación.
  // Utilidad Neta = Utilidad Bruta - ISR (fórmula obligatoria) — es la base real de la
  // comisión y del % de margen que decide el rango de la escala.
  const costoTotalProductos = round2(lineas.reduce((acc, l) => acc + l.cantidad * l.costo_unitario, 0));
  const costosOperativosTotal = round2(costosOperativos.reduce((acc, c) => acc + c.cantidad * c.dias * c.costo_unitario, 0));
  const costoTotalOperacion = round2(costoTotalProductos + costosOperativosTotal);
  const utilidadBruta = round2(baseGravable - costoTotalOperacion);
  const utilidadNeta = round2(utilidadBruta - isrRetencion);
  const margenUtilidadPct = baseGravable > 0 ? round4(utilidadNeta / baseGravable) : 0;

  const escala = buscarEscalaComision(margenUtilidadPct, escalasComision);
  const comisionEstimadaPct = escala?.porcentaje_comision ?? 0;
  const comisionEstimadaMonto = round2(utilidadNeta * comisionEstimadaPct);
  const gananciaNetaEstimada = round2(utilidadNeta - comisionEstimadaMonto);

  return {
    subtotalBruto: round2(subtotalBruto),
    descuentoLineas: round2(descuentoLineas),
    descuentoGlobal: round2(descuentoGlobal),
    totalDescuentos: round2(descuentoLineas + descuentoGlobal),
    baseGravable,
    ivaMonto,
    totalCotizado: round2(totalCotizado),
    isrRetencion,
    ivaRetencion,
    pagoNetoEmpresa,
    porcentajeDescuentoEfectivo,
    // Requiere autorización si el descuento supera el umbral, O si la cotización cae en
    // el Rango 1 de comisión (0%, "Requiere aprobación gerencial").
    requiereAutorizacion: porcentajeDescuentoEfectivo > parametros.descuento_umbral_autorizacion * 100 || escala?.rango === 1,
    costoTotalProductos,
    costosOperativosTotal,
    costoTotalOperacion,
    utilidadBruta,
    utilidadNeta,
    margenUtilidadPct,
    escala,
    comisionEstimadaPct,
    comisionEstimadaMonto,
    gananciaNetaEstimada,
  };
}

// Igual que app.escalas_comision en la base de datos: el rango más alto cuyo "desde" ya
// se alcanzó. Si el margen es negativo (venta con pérdida), no hay rango que aplique y
// se usa el primero (0% de comisión) como referencia visual.
export function buscarEscalaComision(margenPct: number, escalas: EscalaComision[]): EscalaComision | null {
  const ordenadas = [...escalas].sort((a, b) => a.rango - b.rango);
  let encontrada: EscalaComision | null = null;
  for (const e of ordenadas) {
    const cumpleDesde = margenPct >= e.desde_pct;
    const cumpleHasta = e.hasta_pct === null || margenPct <= e.hasta_pct;
    if (cumpleDesde && cumpleHasta) encontrada = e;
  }
  return encontrada ?? ordenadas[0] ?? null;
}

// Precio de venta a partir de costo + % de margen SOBRE EL PRECIO DE VENTA (no sobre el
// costo) — misma fórmula que la hoja "Catalogo" del Excel: Precio = Costo / (1 - %Margen).
export function precioPorMargen(costoUnitario: number, margenPct: number): number {
  if (margenPct >= 1 || margenPct < 0) return 0;
  return round2(costoUnitario / (1 - margenPct));
}

// Reparte el total de costos operativos adicionales entre las líneas de productos, en
// proporción a la venta de cada una (cantidad x precio unitario). Solo para mostrar en la
// vista interna — no cambia la utilidad total de la cotización, que ya se calcula sobre el
// total de costos operativos sin importar cómo se repartan.
export function distribuirCostosOperativosPorLinea<T extends { cantidad: number; precio_unitario: number }>(
  lineas: T[],
  costosOperativosTotal: number
): number[] {
  const ventaTotal = lineas.reduce((acc, l) => acc + l.cantidad * l.precio_unitario, 0);
  if (ventaTotal <= 0 || costosOperativosTotal <= 0) return lineas.map(() => 0);
  return lineas.map((l) => round2(((l.cantidad * l.precio_unitario) / ventaTotal) * costosOperativosTotal));
}

function round2(n: number) { return Math.round((n + Number.EPSILON) * 100) / 100; }
function round3(n: number) { return Math.round((n + Number.EPSILON) * 1000) / 1000; }
function round4(n: number) { return Math.round((n + Number.EPSILON) * 10000) / 10000; }

// --- Número a letras (Quetzales) ---------------------------------------------------
const UNIDADES = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE',
  'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE', 'VEINTE'];
const DECENAS = ['', '', 'VEINTI', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
const CENTENAS = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS',
  'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

function tresDigitos(x: number): string {
  if (x === 0) return '';
  if (x === 100) return 'CIEN';
  const c = Math.floor(x / 100);
  const d = Math.floor((x % 100) / 10);
  const u = x % 10;
  let s = '';
  if (c > 0) s += CENTENAS[c] + ' ';
  if (d === 1) {
    s += UNIDADES[10 + u];
  } else if (d >= 2) {
    s += DECENAS[d];
    if (u > 0) s += d === 2 ? UNIDADES[u] : ' Y ' + UNIDADES[u];
  } else if (u > 0) {
    s += UNIDADES[u];
  }
  return s.trim();
}

export function numeroALetras(monto: number): string {
  let n = Math.floor(Math.abs(monto));
  const centavos = Math.round((Math.abs(monto) - Math.floor(Math.abs(monto))) * 100);
  let resultado = '';

  if (n === 0) {
    resultado = 'CERO';
  } else {
    if (n >= 1000000) {
      const millones = Math.floor(n / 1000000);
      resultado += millones === 1 ? 'UN MILLON ' : tresDigitos(millones) + ' MILLONES ';
      n %= 1000000;
    }
    if (n >= 1000) {
      const miles = Math.floor(n / 1000);
      resultado += miles === 1 ? 'MIL ' : tresDigitos(miles) + ' MIL ';
      n %= 1000;
    }
    if (n > 0) resultado += tresDigitos(n);
  }

  resultado = resultado.replace(/\s+/g, ' ').trim();
  return `${resultado} QUETZALES CON ${String(centavos).padStart(2, '0')}/100`;
}
