import type { Config } from 'tailwindcss';

// Design tokens — Etapa "rediseño empresarial" (2026-09). Lenguaje visual sobrio tipo
// ERP/SaaS empresarial (referencia de nivel: Linear, Stripe Dashboard, Dynamics 365,
// SAP Fiori — no se copian componentes ni branding de esos productos, solo el nivel de
// sobriedad). Se mantienen los NOMBRES de los tokens que ya usa toda la app (navy,
// brand.orange, shadow.card/soft/lift/nav) para que este cambio se propague solo con
// editar este archivo y globals.css, sin tener que tocar cada página una por una — solo
// se ajustan sus VALORES a algo más neutro, y se retira todo lo decorativo (gradiente de
// sidebar, sombras "glow", radios exagerados).
const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Azul corporativo sobrio — antes era un poco más saturado/violáceo; esta
        // versión es un azul neutro de negocios, sin caer en el "azul IA" ni en morado.
        navy: {
          50: '#f0f3f8', 100: '#dce3ee', 200: '#b9c6dd', 300: '#93a7c6',
          400: '#6c85ab', 500: '#4d6690', 600: '#374f77', 700: '#2a3f61',
          800: '#1f2f49', 900: '#172436', 950: '#0e1622',
        },
        // Color de marca de Estructuras MG — se conserva, pero su uso se restringe a
        // detalles puntuales (marca, un botón primario, un indicador), nunca como
        // gradiente ni como "glow" decorativo.
        brand: {
          orange: '#C6620F',
          orangeDark: '#A4500A',
          orangeLight: '#FBEDE1',
        },
        // Superficie/fondo/texto — valores exactos pedidos para el rediseño.
        canvas: '#F7F8FA',
        surface: '#FFFFFF',
        ink: {
          DEFAULT: '#111827',
          secondary: '#667085',
          muted: '#98A2B3',
        },
        line: {
          DEFAULT: '#E5E7EB',
          strong: '#D0D5DD',
        },
      },
      fontSize: {
        // Jerarquía tipográfica del rediseño — evita títulos de 32/40px salvo casos
        // ya marcados como excepción explícita (login).
        'page-title': ['22px', { lineHeight: '1.3', fontWeight: '600' }],
        'section-title': ['15px', { lineHeight: '1.4', fontWeight: '600' }],
      },
      boxShadow: {
        // Antes eran sombras "glow" (soft/lift) pensadas para dar sensación de
        // profundidad tipo landing page. Ahora las cuatro son variantes mínimas de una
        // sola elevación discreta — se conservan los nombres para no tener que editar
        // cada archivo que ya usa shadow-card/soft/lift/nav.
        card: '0 1px 2px 0 rgb(16 24 40 / 0.05)',
        soft: '0 1px 2px 0 rgb(16 24 40 / 0.06), 0 1px 3px 0 rgb(16 24 40 / 0.06)',
        lift: '0 1px 3px 0 rgb(16 24 40 / 0.08), 0 2px 6px -2px rgb(16 24 40 / 0.06)',
        nav: '1px 0 0 0 rgb(16 24 40 / 0.06)',
      },
    },
  },
  plugins: [],
};

export default config;
