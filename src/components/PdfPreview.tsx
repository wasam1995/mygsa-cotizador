'use client';

import dynamic from 'next/dynamic';

// @react-pdf/renderer's <PDFViewer> renderiza el PDF real dentro de un <iframe> (usa el
// visor nativo del navegador) — se importa de forma dinámica y sin SSR porque solo puede
// ejecutarse en el navegador. Envolver este detalle aquí evita repetirlo en cada pantalla
// que necesita mostrar una vista previa (Cotizaciones → Vista previa, y el modal de
// "Vista previa antes de guardar" del cotizador).
const PDFViewer = dynamic(() => import('@react-pdf/renderer').then((m) => m.PDFViewer), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[300px] items-center justify-center text-sm text-slate-400">
      Generando vista previa del PDF…
    </div>
  ),
});

export default function PdfPreview({ children, alto = '100%' }: { children: React.ReactElement; alto?: string }) {
  return (
    <PDFViewer style={{ width: '100%', height: alto, border: 'none' }} showToolbar>
      {children}
    </PDFViewer>
  );
}
