/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  // Gera /rota/index.html: funciona em qualquer hospedagem estática (Render, Azure SWA).
  trailingSlash: true,
  images: { unoptimized: true },
  transpilePackages: ['@cortex/schemas', '@cortex/seed', '@cortex/ui'],
};
export default nextConfig;
