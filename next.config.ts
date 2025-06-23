import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: '*.yna.co.kr',
      },
      // Consolidated with wildcard
      {
        protocol: 'https',
        hostname: '*.yna.co.kr',
      },
      // Consolidated with wildcard
      {
        protocol: 'https',
        hostname: '*.redd.it',
      },
      // Unique hostnames
      {
        protocol: 'https',
        hostname: 'wimg.heraldcorp.com',
      },
      {
        protocol: 'https',
        hostname: 'koreajoongangdaily.joins.com',
      },
      {
        protocol: 'https',
        hostname: 'image.genie.co.kr',
      },
      {
        protocol: 'https',
        hostname: 'i.scdn.co',
      },
      {
        protocol: 'https',
        hostname: 'i.namu.wiki',
      },
      {
        protocol: 'https',
        hostname: 'upload.wikimedia.org',
      },
      {
        protocol: 'https',
        hostname: 'www.instagram.com',
      },
      {
        protocol: 'https',
        hostname: 'ibighit.com',
      },
      {
        protocol: 'https',
        hostname: 'www.billieeilish.com',
      },
      {
        protocol: 'https',
        hostname: 'i.imgur.com',
      },
      {
        protocol: 'https',
        hostname: 'm.media-amazon.com',
      },
      {
        protocol: 'https',
        hostname: 'img.imageimg.net',
      },
      {
        protocol: 'https',
        hostname: 'img.smlounge.co.kr',
      },
      {
        protocol: 'https',
        hostname: 'asianwiki.com',
      },
      {
        protocol: 'https',
        hostname: 'api.time.com',
      },
      {
        protocol: 'https',
        hostname: 'news.vocofm.com',
      },
      {
        protocol: 'https',
        hostname: 'static.wikia.nocookie.net',
      },
      {
        protocol: 'https',
        hostname: 'voguesg.s3.ap-southeast-1.amazonaws.com',
      },
      {
        protocol: 'https',
        hostname: 'idolinsights.com',
      },
      {
        protocol: 'https',
        hostname: 'entertainimg.kbsmedia.co.kr',
      },
      {
        protocol: 'https',
        hostname: 'talkimg.imbc.com',
      },
      {
        protocol: 'https',
        hostname: 'i.mydramalist.com',
      },
      {
        protocol: 'https',
        hostname: 'www.famousbirthdays.com',
      },
      {
        protocol: 'https',
        hostname: 'img1.daumcdn.net',
      },
      {
        protocol: 'https',
        hostname: 'cdn.dkilbo.com',
      },
      {
        protocol: 'https',
        hostname: 'cdn.srtimes.kr',
      },
      {
        protocol: 'https',
        hostname: 'b3903846.smushcdn.com',
      },
      {
        protocol: 'https',
        hostname: 'file2.nocutnews.co.kr',
      },
      {
        protocol: 'https',
        hostname: 'image.kmib.co.kr',
      },
      {
        protocol: 'https',
        hostname: 'hips.hearstapps.com',
      },
      {
        protocol: 'https',
        hostname: '1.vikiplatform.com',
      },
      {
        protocol: 'https',
        hostname: 'deadline.com',
      },
      {
        protocol: 'https',
        hostname: 'rukminim2.flixcart.com',
      },
      {
        protocol: 'https',
        hostname: 'pbs.twimg.com',
      },
      {
        protocol: 'https',
        hostname: 'wimg.mk.co.kr',
      },
      {
        protocol: 'https',
        hostname: 'magazine.weverse.io',
      },
      // Placeholder - remove if not needed
      {
        protocol: 'https',
        hostname: 'image.url',
      },
    ],
  },
};

export default nextConfig;