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
      },
      {
        protocol: 'https',
        hostname: 'image.genie.co.kr',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'i.scdn.co',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'i.namu.wiki',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'upload.wikimedia.org',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
