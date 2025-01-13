// src/app/[celebrity]/page.tsx
import ProfileInfo from '@/components/ProfileInfo';
import NewsFeed from '@/components/news/NewsFeed';
import { Suspense } from 'react';

interface CelebrityPageProps {
  params: Promise<{
    celebrity: string;
  }>;
}

export default async function CelebrityPage({ params } : CelebrityPageProps) {
  const resolvedParams = await params;
  const celebrityId = resolvedParams.celebrity.toLowerCase();
  
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <div className='w-full'>
        <ProfileInfo celebrityId={celebrityId} />
        <div className="w-[60%] mx-auto px-4 py-8">
          <NewsFeed celebrity={celebrityId} />
        </div>
      </div>
    </Suspense>
  );
}