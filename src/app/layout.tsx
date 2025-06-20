// src/app/layout.tsx
import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Header from '@/components/Header';
import { Analytics } from '@vercel/analytics/next';
import AnalyticsProvider from './AnalyticsProvider';
import JsonLd from '@/components/JsonLd';
import Link from 'next/link';
import { FiguresProvider } from '@/context/FiguresContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Providers } from './providers';

const queryClient = new QueryClient();

const inter = Inter({ subsets: ['latin'] });

// Separate viewport export
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  // ...any other viewport settings you need
}

export const metadata: Metadata = {
  metadataBase: new URL('https://ehco.ai'),
  title: {
    default: 'EHCO - K-Entertainment Facts & Timeline',
    template: '%s | EHCO'
  },
  description: 'Real-time verified facts and timeline about Korean celebrities. Latest K-entertainment news with accurate fact-checking.',
  keywords: [
    // English Keywords
    'Korean celebrity news',
    'K-pop idol news',
    'Korean actor updates',
    'K-drama actor news',
    'Korean entertainment facts',
    'Korean celebrity timeline',
    'K-pop idol timeline',
    'Korean celebrity fact check',
    'IU latest news',
    'Kim Soo Hyun updates',
    'Han So Hee news',
    // Korean Keywords
    '한국 연예인 뉴스',
    '케이팝 아이돌 소식',
    '한류 스타 새소식',
    '연예인 타임라인',
    '연예뉴스 팩트체크'
  ],
  authors: [{ name: 'EHCO' }],
  creator: 'EHCO',
  publisher: 'EHCO',
  icons: {
    icon: "/ehco_branding_bi_fin_ehcio_bi_color-6.png"
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    title: 'EHCO - Real-time K-Entertainment Timeline',
    description: 'Accurate, real-time timeline and fact-checking for Korean celebrities. Latest verified news and updates.',
    url: 'https://ehco.ai',
    siteName: 'EHCO',
    locale: 'en_US',
    alternateLocale: 'ko_KR',
    type: 'website',
    images: [{
      url: 'https://ehco.ai/og-image.jpg',
      width: 1200,
      height: 630,
      alt: 'EHCO - K-Entertainment Timeline'
    }]
  },
  twitter: {
    card: 'summary_large_image',
    title: 'EHCO - K-Entertainment Timeline',
    description: 'Real-time verified updates about Korean celebrities',
    images: ['https://ehco.ai/twitter-image.jpg'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "EHCO - K-Entertainment Facts & Timeline",
    "url": "https://ehco.ai",
    "potentialAction": {
      "@type": "SearchAction",
      "target": "https://ehco.ai/search?q={search_term_string}",
      "query-input": "required name=search_term_string"
    }
  };

  return (
    <html lang="en">
      <head>
        <meta name="google-adsense-account" content="ca-pub-1708240738390806" />
        {/* <link rel="icon" type="image/x-icon" href="/favicon.ico"></link>
        <link rel="shortcut icon" type="image/x-icon" href="/favicon.ico"></link> */}
        <meta name="referrer" content="no-referrer" />
        <meta name="yandex-verification" content="d95a704c62f53c58" />
        <meta name="naver-site-verification" content="264ce0fdcec0f8516f15473b626bad62bc29202e" />
        <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1708240738390806"
          crossOrigin="anonymous"></script>
      </head>
      <body className={inter.className}>
        <Providers>
          <div className="fixed top-0 left-0 right-0 z-50 shadow-md">
            <Header />
          </div>
          <main className="min-h-screen pt-16">
            {children}
            <JsonLd data={websiteSchema} />
          </main>

          {/* Footer - white background with only copyright and links */}
          <footer className="mt-0 bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-gray-700 py-8">
            <div className="w-[90%] md:w-[80%] mx-auto px-4">
              <div className="text-center">
                <p className="text-xs md:text-sm mb-4 text-gray-600 dark:text-gray-300">© 2025 EHCO. All rights reserved.</p>
                <div className="flex flex-col md:flex-row flex-wrap justify-center items-center gap-3 md:gap-4 text-xs md:text-sm text-gray-600 dark:text-gray-300">
                  <Link
                    href="/about-ehco"
                    className='hover:underline'
                  >
                    About Ehco
                  </Link>

                  {/* MODIFIED: This separator is hidden on mobile */}
                  <span className="hidden md:block">|</span>

                  <Link
                    href="/contact-us"
                    className='hover:underline'
                  >
                    Contact Us
                  </Link>

                  {/* MODIFIED: This separator is hidden on mobile */}
                  <span className="hidden md:block">|</span>

                  <Link
                    href="/terms-of-service"
                    className='hover:underline'
                  >
                    Terms of Service
                  </Link>

                  {/* MODIFIED: This separator is hidden on mobile */}
                  <span className="hidden md:block">|</span>

                  <Link
                    href="/privacy-policy"
                    className='hover:underline'
                  >
                    Privacy Policy
                  </Link>
                </div>
              </div>
            </div>
          </footer>

          <Analytics />
          <AnalyticsProvider />
        </Providers>
      </body>
    </html>
  )
}