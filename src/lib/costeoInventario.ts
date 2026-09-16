// Espejo en JS de las columnas calculadas de la base de datos (Etapa 8, corrección — ver
// database/19_etapa8_correccion_formulas_costo_empresa.sql). Se usa SOLO para mostrar una
// vista previa instantánea en el formulario de Inventario mientras se digitan los campos
// confidenciales de costo; el valor que realmente queda guardado en costo_empresa /
// costo_empresa_calculado siempre lo recalcula Postgres (columnas GENERATED), así que
// ambos lados nunca pueden desincronizarse en los datos persistidos.
//
// Costo Empresa = Costo Importación / (1 - % ganancia sobre costo) — margen sobre el
// precio de venta resultante, no sobre el costo (misma fórmula que precioPorMargen en
// fiscal.ts para el modo COSTO_MARGEN). "Costo Empresa se traslada a Costo Unitario".
export function costoEmpresaDesdeImportacion(costoImportacion: number, gananciaCostoPct: number): number {
  if (costoImportacion <= 0 || gananciaCostoPct >= 1 || gananciaCostoPct < 0) return 0;
  return round2(costoImportacion / (1 - gananciaCostoPct));
}

// Costo Empresa (Calculado) = Costo Empresa * (1 + Impuestos). "impuestos" se captura como
// fracción (ej. 0.12 = 12%), igual que ya lo hacía el formulario antes de esta corrección.
// "Costo Empresa (Calculado) se traslada a Precio Lista".
export function costoEmpresaCalculadoDesde(costoEmpresa: number, impuestosFraccion: number): number {
  return round2(costoEmpresa * (1 + impuestosFraccion));
}

function round2(n: number) { return Math.round((n + Number.EPSILON) * 100) / 100; }
