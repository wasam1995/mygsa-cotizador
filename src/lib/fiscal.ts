// Espejo en JS de la lógica fiscal que vive (y manda) en la base de datos
// (database/03_functions_triggers.sql -> app.recalcular_cotizacion).
// Se usa SOLO para mostrar una vista previa instantánea en el formulario del cotizador;
// el cálculo que realmente se guarda siempre lo recalcula el trigger de Postgres,
// así que ambos lados nunca pueden desincronizarse en los datos persistidos.

import type { ParametrosFiscales } from './types';

export interface LineaCalculo {
  cantidad: number;
  precio_unitario: number;
  descuento_linea_monto: number;
}

export interface ResultadoFiscal {
  subtotalBruto: number;
  descuentoLineas: number;
  descuentoGlobal: number;
  totalDescuentos: number;
  baseGravable: number;
  ivaMonto: number;
  totalCotizado: number;
  isrRetencion: number;
  ivaRetencion: number;
  pagoNetoEmpresa: number;
  porcentajeDescuentoEfectivo: number;
  requiereAutorizacion: boolean;
}

export function calcularCotizacion(
  lineas: LineaCalculo[],
  opts: {
    descuentoGlobalPct: number;
    descuentoGlobalMonto: number;
    clienteEsRetenedorIva: boolean;
    parametros: ParametrosFiscales;
  }
): ResultadoFiscal {
  const { descuentoGlobalPct, descuentoGlobalMonto, clienteEsRetenedorIva, parametros } = opts;

  const subtotalBruto = lineas.reduce((acc, l) => acc + l.cantidad * l.precio_unitario, 0);
  const descuentoLineas = lineas.reduce((acc, l) => acc + (l.descuento_linea_monto || 0), 0);
  const subtotalNeto = subtotalBruto - descuentoLineas;

  const descuentoGlobal = descuentoGlobalPct > 0
    ? round2(subtotalNeto * (descuentoGlobalPct / 100))
    : (descuentoGlobalMonto || 0);

  const baseGravable = Math.max(subtotalNeto - descuentoGlobal, 0);
  const ivaMonto = round2(baseGravable * parametros.iva_porcentaje);
  const totalCotizado = baseGravable + ivaMonto;

  const isrRetencion = baseGravable <= parametros.isr_tramo1_limite
    ? round2(baseGravable * parametros.isr_tramo1_porcentaje)
    : round2((baseGravable - parametros.isr_tramo1_limite) * parametros.isr_tramo2_porcentaje + parametros.isr_tramo2_fijo);

  const ivaRetencion = clienteEsRetenedorIva ? round2(ivaMonto * 0.12) : 0;
  const pagoNetoEmpresa = totalCotizado - isrRetencion - ivaRetencion;

  const porcentajeDescuentoEfectivo = subtotalBruto > 0
    ? round3(((descuentoLineas + descuentoGlobal) / subtotalBruto) * 100)
    : 0;

  return {
    subtotalBruto: round2(subtotalBruto),
    descuentoLineas: round2(descuentoLineas),
    descuentoGlobal: round2(descuentoGlobal),
    totalDescuentos: round2(descuentoLineas + descuentoGlobal),
    baseGravable: round2(baseGravable),
    ivaMonto,
    totalCotizado: round2(totalCotizado),
    isrRetencion,
    ivaRetencion,
    pagoNetoEmpresa: round2(pagoNetoEmpresa),
    porcentajeDescuentoEfectivo,
    requiereAutorizacion: porcentajeDescuentoEfectivo > parametros.descuento_umbral_autorizacion * 100,
  };
}

function round2(n: number) { return Math.round((n + Number.EPSILON) * 100) / 100; }
function round3(n: number) { return Math.round((n + Number.EPSILON) * 1000) / 1000; }

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
