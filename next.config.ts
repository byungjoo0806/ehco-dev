import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'wimg.heraldcorp.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'koreajoongangdaily.joins.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'img.yna.co.kr',
        pathname: '/**',
      }
    ],
  },
};

export default nextConfig;
