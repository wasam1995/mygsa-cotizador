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

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_APP_NAME || 'MYGSA · Cotizador',
  description: 'Sistema de cotizaciones, inventario y comisiones — Estructuras MG',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={inter.variable}>
      <body className="min-h-screen bg-canvas font-sans text-[14px] text-ink antialiased">{children}</body>
    </html>
  );
}
