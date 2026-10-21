/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  // Gera /rota/index.html: funciona em qualquer hospedagem estática (Render, Azure SWA).
  trailingSlash: true,
  images: { unoptimized: true },
  transpilePackages: ['@cortex/schemas', '@cortex/seed', '@cortex/engine', '@cortex/tour', '@cortex/ui'],
};
export default nextConfig;
