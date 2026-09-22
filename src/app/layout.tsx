import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';

// Inter como tipografía principal del rediseño empresarial — auto-hospedada con
// next/font/local (el .woff2 vive en src/app/fonts/, sin ninguna llamada de red en
// tiempo de build ni de ejecución) y expuesta como variable CSS que tailwind.config.ts
// usa en font-sans, así toda la app la hereda sin tener que agregar la clase en cada
// página. Es la fuente variable (weight 100–900), cubre el rango Latin-1 (incluye
// tildes y eñes del español).
const inter = localFont({
  src: './fonts/inter-latin-variable.woff2',
  weight: '100 900',
  variable: '--font-inter',
  display: 'swap',
});

// metadataBase resuelve las URLs absolutas del ícono/OG que Next genera solo a partir de
// icon.png / apple-icon.png / opengraph-image.png (archivos en src/app/) — sin esto, esas
// imágenes quedarían con URL relativa y algunos clientes (WhatsApp, Messenger) no las
// resuelven bien al mostrar la vista previa del enlace.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://mygsa-cotizador.vercel.app';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: process.env.NEXT_PUBLIC_APP_NAME || 'MYGSA · Cotizador',
  description: 'Construcciones y Soluciones Metálicas M&G — Sistema de Cotizaciones, Inventario y Comisiones',
  appleWebApp: {
    title: 'MYGSA',
    statusBarStyle: 'default',
  },
  openGraph: {
    title: 'MYGSA — Cotizador',
    description: 'Construcciones y Soluciones Metálicas M&G · Sistema de Cotizaciones, Inventario y Comisiones',
    siteName: 'MYGSA',
    locale: 'es_GT',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#172436',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={inter.variable}>
      <body className="min-h-screen bg-canvas font-sans text-[14px] text-ink antialiased">{children}</body>
    </html>
  );
}
