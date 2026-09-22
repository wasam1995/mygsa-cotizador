import type { MetadataRoute } from 'next';

// Manifiesto para "Agregar a pantalla de inicio" en Android/Chrome — define el nombre y
// el ícono que se muestran cuando alguien guarda el enlace como acceso directo en el
// celular. Next.js lo detecta solo por el nombre del archivo (app/manifest.ts) y genera
// el /manifest.webmanifest correspondiente, sin necesidad de enlazarlo a mano en <head>.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'MYGSA — Cotizador',
    short_name: 'MYGSA',
    description: 'Construcciones y Soluciones Metálicas M&G — Sistema de Cotizaciones, Inventario y Comisiones',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#F7F8FA',
    theme_color: '#172436',
    icons: [
      { src: '/icon.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
