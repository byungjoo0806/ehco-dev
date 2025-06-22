// src/components/ProfileInfo.tsx
'use client';

import React from 'react';
import Image from 'next/image';
import { User, Instagram, Youtube, Music, Globe, Twitter, Facebook, Plus } from 'lucide-react';

// --- TYPE DEFINITIONS ---
// These interfaces are based on what's available in page.tsx
interface PublicFigureBase {
  id: string;
  name: string;
  name_kr: string;
  nationality: string;
  occupation: string[];
  profilePic?: string;
  instagramUrl?: string;
  spotifyUrl?: string;
  youtubeUrl?: string;
  // Assuming these might be added later based on the screenshot
  companyUrl?: string;
  twitterUrl?: string;
  facebookUrl?: string;
  gender: string;
  company?: string;
  debutDate?: string;
  lastUpdated?: string;
}

interface IndividualPerson extends PublicFigureBase {
  is_group: false;
  birthDate?: string;
}

interface GroupProfile extends PublicFigureBase {
  is_group: true;
  members?: IndividualPerson[];
}

type PublicFigure = IndividualPerson | GroupProfile;

interface ProfileInfoProps {
  publicFigureData: PublicFigure;
}


// --- HELPER COMPONENTS & FUNCTIONS ---
const InfoField: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <p className="text-xs font-semibold text-gray-500">{label}</p>
    <p className="text-sm text-gray-800 dark:text-gray-200">{value}</p>
  </div>
);

const SocialLink: React.FC<{ href?: string; icon: React.ReactNode; label: string }> = ({ href, icon, label }) => {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-blue-500 transition-colors dark:text-gray-400 dark:hover:text-blue-400"
    >
      {icon}
      {label}
    </a>
  );
};


// --- MAIN COMPONENT ---
export default function ProfileInfo({ publicFigureData }: ProfileInfoProps) {

  const formatDate = (dateString: string | undefined): string => {
    if (!dateString) return 'N/A';
    const dateOnly = dateString.split(':')[0].trim();
    try {
      const date = new Date(dateOnly);
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch (error) {
      return dateString;
    }
  };

  const getYearsActive = (dateString: string | undefined): string => {
    if (!dateString) return 'N/A';
    const year = dateString.split('-')[0].split(' ')[0].trim();
    return `${year} - Present`;
  };

  // const description = `${publicFigureData.nationality} ${publicFigureData.occupation.join(', ')}. Renowned for...`; // Example description

  return (
    // Main container with two-column layout
    <div className="flex flex-col sm:flex-row gap-6 sm:gap-8 w-full p-4 border shadow-md rounded-lg">

      {/* --- LEFT COLUMN: PROFILE IMAGE --- */}
      <div className="w-full sm:w-1/3 md:w-48 lg:w-56 flex-shrink-0">
        <div className="aspect-square w-full bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden flex items-center justify-center">
          {publicFigureData.profilePic ? (
            <Image
              src={publicFigureData.profilePic}
              alt={publicFigureData.name}
              width={224} // Corresponds to w-56
              height={224}
              className="w-full h-full object-cover"
              unoptimized
            />
          ) : (
            <div className='text-center text-gray-500'>
              <User size={64} className="mx-auto text-gray-400 mb-2" />
              Image Not Found
            </div>
          )}
        </div>
      </div>

      {/* --- RIGHT COLUMN: ALL TEXTUAL INFO --- */}
      <div className="flex flex-col flex-grow">

        {/* Name and Description */}
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{publicFigureData.name}</h1>
        <h2>{publicFigureData.name_kr}</h2>

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-y-4 gap-x-8 mt-6">
          {!publicFigureData.is_group && (
            <InfoField label="Born" value={formatDate((publicFigureData as IndividualPerson).birthDate)} />
          )}
          <InfoField label="Origin" value={publicFigureData.nationality} />
          {!publicFigureData.is_group && (
            <InfoField label="Roles" value={publicFigureData.occupation[0]} />
          )}
          <InfoField label="Labels" value={publicFigureData.company || 'N/A'} />
          {publicFigureData.is_group && (
            <InfoField label="Members" value={publicFigureData.members?.map(member => member.name).join(', ') || 'N/A'}/>
          )}
          <InfoField label="Years Active" value={getYearsActive(publicFigureData.debutDate)} />
        </div>

        {/* Official Links */}
        <div className="mt-8 pt-4 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-500 mb-3">Official Links</h3>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <SocialLink href={publicFigureData.companyUrl} icon={<Globe size={16} />} label="Website" />
            <SocialLink href={publicFigureData.instagramUrl} icon={<Instagram size={16} />} label="Instagram" />
            <SocialLink href={publicFigureData.twitterUrl} icon={<Twitter size={16} />} label="Twitter" />
            <SocialLink href={publicFigureData.youtubeUrl} icon={<Youtube size={16} />} label="YouTube" />
            <SocialLink href={publicFigureData.facebookUrl} icon={<Facebook size={16} />} label="Facebook" />
            <SocialLink href={publicFigureData.spotifyUrl} icon={<Music size={16} />} label="Spotify" />
          </div>
        </div>

        {/* Follow Button */}
        {/* <div className="mt-8">
          <button className="w-full bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors">
            <Plus size={20} />
            Follow
          </button>
        </div> */}
      </div>
    </div>
  );
}