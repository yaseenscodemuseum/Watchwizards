/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['image.tmdb.org'], // For movie posters
  },
  distDir: '.next',
  experimental: {
    appDir: true
  }
}

export default nextConfig; 