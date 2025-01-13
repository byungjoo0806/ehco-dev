'use client';

import { useCelebrity } from '@/lib/hooks/useCelebrity';

interface ProfileInfoProps {
  celebrityId: string;
}

export default function ProfileInfo({ celebrityId }: ProfileInfoProps) {
  const { celebrity, loading, error } = useCelebrity(celebrityId);
  // console.log(celebrity);

  if (loading) {
    return (
      <div className="bg-gray-50 py-8">
        <div className="container mx-auto px-4">
          <div className="flex gap-8">
            <div className="w-32 h-32 rounded-full bg-gray-200 animate-pulse" />
            <div className="flex-1">
              <div className="h-8 bg-gray-200 rounded w-1/4 mb-4 animate-pulse" />
              <div className="grid grid-cols-2 gap-y-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="col-span-2 flex gap-4">
                    <div className="h-4 bg-gray-200 rounded w-1/4 animate-pulse" />
                    <div className="h-4 bg-gray-200 rounded w-1/4 animate-pulse" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !celebrity) {
    return (
      <div className="bg-gray-50 py-8">
        <div className="container mx-auto px-4 text-red-500">
          Error loading celebrity information
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-gray-50 py-8">
      <div className="w-[60%] mx-auto px-4">
        <div className="flex gap-8">
          <div className="w-32 h-32 rounded-full bg-gray-200 overflow-hidden">
            <img src={celebrity.profilePic} alt={celebrity.name} className='w-full h-full object-cover' />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold mb-4">{celebrity.name}</h1>
            <div className="grid grid-cols-2 gap-y-2">
              <div className="text-sm">Actual Name:</div>
              <div className="text-sm">{celebrity.koreanName}</div>
              <div className="text-sm">Birth of Date:</div>
              <div className="text-sm">{celebrity.birthDate}</div>
              <div className="text-sm">Nationality:</div>
              <div className="text-sm">{celebrity.nationality}</div>
              <div className="text-sm">Management Company:</div>
              {celebrity.company ? (
                <div className="text-sm">{celebrity.company}</div>
              ) : (
                <div className="text-sm">N/A</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}