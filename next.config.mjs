/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: { bodySizeLimit: '10mb' },
  },
  // @react-pdf/renderer (Etapa 7) se publica solo como ESM — sin esto, Next.js intenta
  // requerirlo como CommonJS al compilar los componentes cliente que lo usan y falla el
  // build ("ESM packages need to be imported").
  transpilePackages: ['@react-pdf/renderer'],
};

export default nextConfig;
