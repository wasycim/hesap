/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "x-vercel-skip-toolbar",
            value: "1",
          },
        ],
      },
    ]
  },
}

export default nextConfig
