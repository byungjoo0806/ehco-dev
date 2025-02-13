// src/app/[celebrity]/page.tsx
import { Suspense } from 'react';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import { Loader2 } from 'lucide-react';
import ProfileInfo from '@/components/ProfileInfo';
import CelebrityWiki from '@/components/CelebrityWiki';

interface CelebrityPageProps {
  params: Promise<{
    celebrity: string;
  }>;
}

// Key Work interface for special content
interface KeyWork {
  description: string;
  year: string;
  source: string;
}

interface RegularContent {
  id: string;
  subcategory: string;
  subcategory_overview: string;
  source_articles: string[];
  chronological_developments: string;
}

interface SpecialContent {
  id: string;
  key_works?: {
    [key: string]: Array<KeyWork>;
  };
  overall_overview?: string;
}

interface CelebrityContentData {
  regularContent: RegularContent[];
  specialContent: SpecialContent[];
}

interface FirestoreCelebrityData {
  name: string;
  koreanName: string;
  profilePic: string;
  birthDate: Timestamp;  // Only birthDate is a Timestamp
  debutDate?: string;    // debutDate is already a string
  nationality: string;
  company: string;
  youtubeUrl?: string;
  instagramUrl?: string;
  spotifyUrl?: string;
  school?: string[];
  occupation?: string[];
  group?: string;
  zodiacSign?: string;
  chineseZodiac?: string;
}

// Interface for the processed data
interface CelebrityData extends Omit<FirestoreCelebrityData, 'birthDate'> {
  birthDate: string;  // birthDate is converted to string
}

// Unified loading overlay component
const LoadingOverlay = () => (
  <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center">
    <div className="bg-white dark:bg-slate-800 p-6 rounded-lg flex items-center space-x-3">
      <Loader2 className="animate-spin text-slate-600 dark:text-white" size={24} />
      <span className="text-slate-600 dark:text-white font-medium">Loading...</span>
    </div>
  </div>
);

// Helper function to convert Timestamp to formatted date string
function formatTimestamp(timestamp: Timestamp): string {
  return timestamp.toDate().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

async function getCelebrityData(celebrityId: string): Promise<CelebrityData> {
  const docRef = doc(db, 'celebrities', celebrityId.toLowerCase());
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    throw new Error('Celebrity not found');
  }

  const data = docSnap.data() as FirestoreCelebrityData;

  // Only convert birthDate, leave all other fields as is
  const formattedData: CelebrityData = {
    ...data,
    birthDate: formatTimestamp(data.birthDate)
  };

  if (!formattedData.name ||
    !formattedData.koreanName ||
    !formattedData.profilePic ||
    !formattedData.birthDate ||
    !formattedData.nationality ||
    !formattedData.company) {
    throw new Error('Invalid celebrity data');
  }

  return formattedData;
}

// Separate viewport export
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export async function generateMetadata({ params }: { params: Promise<{ celebrity: string }> }): Promise<Metadata> {
  try {
    const resolvedParams = await params;
    const celebrityData = await getCelebrityData(resolvedParams.celebrity);

    const title = `${celebrityData.name} (${celebrityData.koreanName}) Timeline & News`
    const description = `Latest verified ${celebrityData.name} news, activities, and updates. Complete timeline of ${celebrityData.name}'s career including music, drama, variety shows, and entertainment activities.`

    return {
      title,
      description,
      keywords: [
        // English Keywords
        `${celebrityData.name} news`,
        `${celebrityData.name} latest`,
        `${celebrityData.name} updates`,
        `${celebrityData.name} timeline`,
        `${celebrityData.name} fact check`,
        `${celebrityData.name} schedule`,
        `${celebrityData.name} comeback`,
        `${celebrityData.name} drama`,
        `${celebrityData.name} ${celebrityData.company}`,
        // Korean Keywords
        `${celebrityData.koreanName} 소식`,
        `${celebrityData.koreanName} 최신`,
        `${celebrityData.koreanName} 일정`,
        `${celebrityData.koreanName} 컴백`,
        `${celebrityData.koreanName} 팩트체크`,
        `${celebrityData.koreanName} 드라마`,
        `${celebrityData.koreanName} 활동`,
        `${celebrityData.koreanName} 근황`
      ],
      alternates: {
        canonical: `https://ehco.ai/${resolvedParams.celebrity}`,
      },
      openGraph: {
        title: `${title} - EHCO`,
        description,
        url: `https://ehco.ai/${resolvedParams.celebrity}`,
        type: 'article',
        images: [
          {
            url: celebrityData.profilePic,
            width: 1200,
            height: 630,
            alt: `${celebrityData.name} profile image`,
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title: `${title} - EHCO`,
        description,
        images: [celebrityData.profilePic],
      }
    }
  } catch (error) {
    // Return basic metadata if celebrity data fetch fails
    return {
      title: 'Celebrity Profile - EHCO',
      description: 'K-pop celebrity news and updates',
    }
  }
}

async function getCelebrityContent(celebrityId: string): Promise<CelebrityContentData> {
  const headersList = await headers();
  const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
  const host = headersList.get('host') || 'localhost:3000';

  const response = await fetch(
    `${protocol}://${host}/api/celebrity-content/${celebrityId}`,
    {
      // Next.js 13+ revalidation syntax
      cache: 'force-cache',
      next: {
        revalidate: 3600 // 1 hour
      },
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch celebrity content');
  }

  return response.json();
}

// Update the special content processing
function processContentData(data: CelebrityContentData) {
  const { regularContent, specialContent } = data;
  // console.log(specialContent);

  const modifiedRegularContent = regularContent.map((item) => ({
    ...item,
    subcategory: item.id === 'ott,_film_tv_drama_awards' ? 'Film/TV/Drama Awards' : item.subcategory
  }));

  const sections = [
    ...specialContent.map(item =>
      item.id.split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
    ),
    ...regularContent.map(item =>
      item.subcategory.toLowerCase().includes('film/tv/drama awards')
        ? 'Film/TV/Drama Awards'
        : item.subcategory
    )
  ];

  // Ensure key_works matches the KeyWork interface
  const processedSpecialContent = {
    key_works: Object.entries(
      specialContent.find(item => item.id === 'key_works')?.key_works || {}
    ).reduce((acc, [key, works]) => ({
      ...acc,
      [key]: works.map((work: KeyWork) => ({
        description: work.description || '',
        year: work.year || '',
        source: work.source || ''
      }))
    }), {} as Record<string, KeyWork[]>),
    overall_overview: specialContent.find(item =>
      item.id === 'overall_summary')?.overall_overview || ''
  };

  return {
    sections,
    modifiedRegularContent,
    processedSpecialContent
  };
}

// Main content component
async function CelebrityPageContent({ celebrityId }: { celebrityId: string }) {
  // Fetch all data concurrently
  const [celebrityData, contentData] = await Promise.all([
    getCelebrityData(celebrityId),
    getCelebrityContent(celebrityId)
  ]);

  const { sections, modifiedRegularContent, processedSpecialContent } = processContentData(contentData);

  return (
    <div className="w-full">
      <ProfileInfo celebrityData={celebrityData} />
      <CelebrityWiki
        availableSections={sections}
        regularContent={modifiedRegularContent}
        specialContent={processedSpecialContent}
      />
    </div>
  );
}

// Main page component
export default async function CelebrityPage({ params }: CelebrityPageProps) {
  const celebrityId = (await params).celebrity.toLowerCase();

  return (
    <Suspense fallback={<LoadingOverlay />}>
      <CelebrityPageContent celebrityId={celebrityId} />
    </Suspense>
  );
}