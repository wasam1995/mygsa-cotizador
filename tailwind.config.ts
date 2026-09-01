import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#eef1f7', 100: '#d7deec', 200: '#b0bdda', 300: '#8899c4',
          400: '#5f73ab', 500: '#425692', 600: '#2f4176', 700: '#1F3864',
          800: '#172a4d', 900: '#101d36',
        },
        brand: {
          orange: '#E8720C',
          orangeDark: '#C65E08',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px 0 rgb(0 0 0 / 0.07), 0 1px 2px -1px rgb(0 0 0 / 0.07)',
      },
    },
  },
  plugins: [],
};

export default config;
