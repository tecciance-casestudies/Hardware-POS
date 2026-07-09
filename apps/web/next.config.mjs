/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Transpile shared workspace packages so they can ship raw TypeScript.
  transpilePackages: ['@hardware-pos/shared'],
};

export default nextConfig;
