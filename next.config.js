/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  env: {
    UNIVALLE_PORTAL_URL: process.env.UNIVALLE_PORTAL_URL,
  },
}

module.exports = nextConfig

