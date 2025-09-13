/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // output: 'standalone', // Removed - causing issues with PM2
  env: {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-5-mini',
  },
  experimental: {
    serverActions: {
      allowedOrigins: [
        '52.4.68.118',
        '52.4.68.118:80',
        'localhost:3000',
        'localhost:3002'
      ]
    }
  }
}

module.exports = nextConfig
