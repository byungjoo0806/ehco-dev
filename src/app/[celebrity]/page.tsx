// src/app/[celebrity]/page.tsx
import ProfileInfo from '@/components/ProfileInfo';
import NewsFeed from '@/components/news/NewsFeed';
import { Suspense } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Metadata, Viewport } from 'next';

interface CelebrityPageProps {
  params: Promise<{
    celebrity: string;
  }>;
}

// Separate data fetching function for metadata
async function getCelebrityData(celebrityId: string) {
  const docRef = doc(db, 'celebrities', celebrityId.toLowerCase());
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    throw new Error('Celebrity not found');
  }

  return docSnap.data();
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

export default async function CelebrityPage({ params }: CelebrityPageProps) {
  const resolvedParams = await params;
  const celebrityId = resolvedParams.celebrity.toLowerCase();

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <div className='w-full'>
        <ProfileInfo celebrityId={celebrityId} />
        <div className="w-[60%] mx-auto px-4 py-8">
          <NewsFeed celebrityId={celebrityId} />
        </div>
      </div>
    </Suspense>
  );
}