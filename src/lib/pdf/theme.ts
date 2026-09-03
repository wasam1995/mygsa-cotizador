import type { ParametrosFiscales } from '@/lib/types';

// Paleta y helpers compartidos entre PrintQuote (versión cliente) y PrintQuoteInterno
// (versión interna) — ambos documentos @react-pdf/renderer toman su color/tipografía de
// app.parametros_fiscales (Etapa 4/7), igual que la versión HTML anterior. Se centraliza
// aquí para no repetir la misma extracción de colores en cada documento.
//
// Fuente: se usa siempre "Helvetica" (una de las 14 fuentes estándar de PDF, embebida en
// cualquier lector) en vez de intentar cargar Inter/Google Fonts — @react-pdf/renderer
// necesita poder descargar el archivo de la fuente en el momento de generar el PDF, y
// depender de una red externa en ese paso es un punto de falla innecesario (ver también
// la decisión de usar la fuente del sistema en el rediseño de la interfaz).
export function paletaPdf(parametros: ParametrosFiscales) {
  return {
    primario: parametros.color_primario || '#0f172a',
    acento: parametros.color_acento || '#f97316',
    acentoOscuro: parametros.color_acento_oscuro || '#ea580c',
    fondo: parametros.color_fondo || '#f8fafc',
    fondoAlterno: parametros.color_fondo_alterno || '#fff7ed',
    borde: parametros.color_borde || '#e2e8f0',
  };
}

export const PDF_FONT = 'Helvetica';

// Datos de muestra usados por el editor visual de plantillas (para mostrar cómo se ve
// una plantilla sin depender de una cotización real) y como último respaldo si algún
// documento se abre sin datos.
export const COTIZACION_DEMO_NUMERO = 'COT-0000';
