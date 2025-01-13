// src/app/layout.tsx
import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Header from '@/components/Header'

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
    template: '%s | EHCO Timeline'
  },
  description: 'Real-time verified facts and timeline about Korean celebrities IU, Kim Soo Hyun, and Han So Hee. Latest K-entertainment news with accurate fact-checking.',
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
  return (
    <html lang="en">
      <head>
        <meta name="google-adsense-account" content="ca-pub-1708240738390806" />
      </head>
      <body className={inter.className}>
        <Header />
        <main className="min-h-screen bg-white">
          {children}
        </main>
      </body>
    </html>
  )
}