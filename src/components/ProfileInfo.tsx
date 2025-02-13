'use client';

import { Instagram, Music, Youtube } from 'lucide-react';

interface CelebrityData {
  name: string;
  koreanName: string;
  profilePic: string;
  youtubeUrl?: string;
  instagramUrl?: string;
  spotifyUrl?: string;
  birthDate: string;
  nationality: string;
  company: string;
  school?: string[];
  debutDate?: string;
  occupation?: string[];
  group?: string;
  zodiacSign?: string;
  chineseZodiac?: string;
}

interface ProfileInfoProps {
  celebrityData: CelebrityData;
}

export default function ProfileInfo({ celebrityData }: ProfileInfoProps) {
  const hasSocialMedia = celebrityData.youtubeUrl || celebrityData.instagramUrl || celebrityData.spotifyUrl;

  const formatArrayValue = (value: string[] | undefined): string => {
    if (!value || value.length === 0) return 'N/A';
    return value.join(', ');
  };

  return (
    <div className="w-full bg-gray-50 dark:bg-slate-600 py-6 md:py-8 shadow-sm">
      <div className="w-[90%] md:w-[80%] mx-auto px-2 md:px-4">
        <div className="flex flex-col md:flex-row md:justify-between gap-6 md:gap-8">
          {/* Left Section - Profile Picture and Basic Info */}
          <div className="w-full md:w-64 flex flex-col items-center md:items-start md:border-r md:border-dashed md:border-black md:pr-4">
            <div className="w-32 h-32 rounded-lg bg-gray-200 overflow-hidden mb-4">
              <img src={celebrityData.profilePic} alt={celebrityData.name} className="w-full h-full object-cover" />
            </div>

            <h1 className="text-xl md:text-2xl font-bold mb-3 text-center md:text-left text-black dark:text-white">
              {celebrityData.name}
            </h1>

            {hasSocialMedia && (
              <div className="flex justify-center md:justify-start gap-4 mb-4 w-full">
                {celebrityData.youtubeUrl && (
                  <a href={celebrityData.youtubeUrl} target="_blank" rel="noopener noreferrer"
                    className="text-black dark:text-white hover:text-red-600 dark:hover:text-red-400 transition-colors">
                    <Youtube size={24} />
                  </a>
                )}
                {celebrityData.instagramUrl && (
                  <a href={celebrityData.instagramUrl} target="_blank" rel="noopener noreferrer"
                    className="text-black dark:text-white hover:text-pink-600 dark:hover:text-pink-400 transition-colors">
                    <Instagram size={24} />
                  </a>
                )}
                {celebrityData.spotifyUrl && (
                  <a href={celebrityData.spotifyUrl} target="_blank" rel="noopener noreferrer"
                    className="text-black dark:text-white hover:text-green-600 dark:hover:text-green-400 transition-colors">
                    <Music size={24} />
                  </a>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 gap-y-3 w-full">
              {[
                { label: "Actual Name", value: celebrityData.koreanName },
                { label: "Birth of Date", value: celebrityData.birthDate },
                { label: "Nationality", value: celebrityData.nationality },
                { label: "Management", value: celebrityData.company || "N/A" }
              ].map((item, index) => (
                <div key={index} className="flex flex-col md:flex-row gap-1 md:gap-2">
                  <div className="text-sm font-medium text-center md:text-left text-black dark:text-white">
                    {item.label}:
                  </div>
                  <div className="text-sm text-center md:text-left text-black dark:text-white">
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Section - Additional Info */}
          <div className="w-full md:w-[70%] lg:w-[65%]">
            <h2 className="text-xl font-bold mb-6 text-black dark:text-white text-center md:text-left">
              Basic Info
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { label: "School", value: formatArrayValue(celebrityData.school) },
                { label: "Debut", value: celebrityData.debutDate },
                { label: "Occupation", value: formatArrayValue(celebrityData.occupation) },
                ...(celebrityData.group ? [{ label: "Group", value: celebrityData.group }] : []),
                { label: "Zodiac Sign", value: celebrityData.zodiacSign },
                { label: "Chinese Zodiac", value: celebrityData.chineseZodiac }
              ].map((item, index) => (
                <div key={index} className="flex flex-col gap-2">
                  <div className="text-sm font-medium text-black dark:text-white text-center md:text-left">
                    {item.label}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-300 text-center md:text-left">
                    {item.value || "N/A"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}