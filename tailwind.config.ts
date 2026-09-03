import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#eef1f7', 100: '#d7deec', 200: '#b0bdda', 300: '#8899c4',
          400: '#5f73ab', 500: '#425692', 600: '#2f4176', 700: '#1F3864',
          800: '#172a4d', 900: '#101d36', 950: '#0b1120',
        },
        brand: {
          orange: '#E8720C',
          orangeDark: '#C65E08',
          orangeLight: '#FDEEE0',
        },
      },
      boxShadow: {
        card: '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)',
        soft: '0 4px 16px -4px rgb(15 23 42 / 0.08), 0 2px 6px -2px rgb(15 23 42 / 0.05)',
        lift: '0 12px 28px -8px rgb(15 23 42 / 0.16), 0 4px 10px -4px rgb(15 23 42 / 0.08)',
        nav: '2px 0 12px 0 rgb(0 0 0 / 0.12)',
      },
      backgroundImage: {
        'sidebar-gradient': 'linear-gradient(180deg, #1F3864 0%, #172a4d 55%, #101d36 100%)',
      },
    },
  },
  plugins: [],
};

export default config;
