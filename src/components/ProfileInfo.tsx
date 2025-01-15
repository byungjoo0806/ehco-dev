'use client';

import { useCelebrity } from '@/lib/hooks/useCelebrity';

interface ProfileInfoProps {
  celebrityId: string;
}

export default function ProfileInfo({ celebrityId }: ProfileInfoProps) {
  const { celebrity, loading, error } = useCelebrity(celebrityId);

  if (loading) {
    return (
      <div className="w-full bg-gray-50 dark:bg-slate-600 py-4 md:py-8">
        <div className="w-full md:w-[60%] mx-auto px-4">
          <div className="flex flex-col items-center md:flex-row md:items-start md:gap-8">
            <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-gray-200 animate-pulse mb-4 md:mb-0" />
            <div className="flex-1 w-full md:w-auto">
              <div className="h-8 bg-gray-200 rounded w-3/4 md:w-1/4 mb-4 animate-pulse mx-auto md:mx-0" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-y-2 max-w-sm mx-auto md:mx-0">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="col-span-1 md:col-span-2 flex flex-col md:flex-row gap-2 md:gap-4">
                    <div className="h-4 bg-gray-200 rounded w-full md:w-1/4 animate-pulse" />
                    <div className="h-4 bg-gray-200 rounded w-full md:w-1/4 animate-pulse" />
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
      <div className="bg-gray-50 dark:bg-slate-600 py-4 md:py-8">
        <div className="container mx-auto px-4 text-red-500 text-center md:text-left">
          Error loading celebrity information
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-gray-50 dark:bg-slate-600 py-4 md:py-8">
      <div className="w-full md:w-[60%] mx-auto px-4">
        <div className="flex flex-col items-center md:flex-row md:items-start md:gap-8">
          <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-gray-200 mb-4 md:mb-0 overflow-hidden">
            <img src={celebrity.profilePic} alt={celebrity.name} className='w-full h-full object-cover' />
          </div>
          <div className="flex-1 w-full md:w-auto">
            <h1 className="text-xl md:text-2xl font-bold mb-4 text-center md:text-left text-black dark:text-white">{celebrity.name}</h1>
            <div className="grid grid-cols-1 gap-y-2 max-w-sm mx-auto md:mx-0">
              <div className='flex justify-between'>
                <div className="w-[45%] text-sm text-end md:text-start font-medium md:font-normal text-black dark:text-white">Actual Name:</div>
                <div className="w-[45%] text-sm text-black dark:text-white">{celebrity.koreanName}</div>
              </div>
              <div className='flex justify-between'>
                <div className="w-[45%] text-sm text-end md:text-start font-medium md:font-normal text-black dark:text-white">Birth of Date:</div>
                <div className="w-[45%] text-sm text-black dark:text-white">{celebrity.birthDate}</div>
              </div>
              <div className='flex justify-between'>
                <div className="w-[45%] text-sm text-end md:text-start font-medium md:font-normal text-black dark:text-white">Nationality:</div>
                <div className="w-[45%] text-sm text-black dark:text-white">{celebrity.nationality}</div>
              </div>
              <div className='flex justify-between'>
                <div className="w-[45%] text-sm text-end md:text-start font-medium md:font-normal text-black dark:text-white">Management:</div>
                {celebrity.company ? (
                  <div className="w-[45%] text-sm text-black dark:text-white">{celebrity.company}</div>
                ) : (
                  <div className="w-[45%] text-sm text-black dark:text-white">N/A</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}