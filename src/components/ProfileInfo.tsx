'use client';

import React from 'react';
import Image from 'next/image';
import { User, Instagram, Youtube, Music } from 'lucide-react';

// Extended interface for public figure data
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
  gender: string;
  company?: string;
  debutDate?: string;
  lastUpdated?: string;
}

interface IndividualPerson extends PublicFigureBase {
  is_group: false;
  birthDate?: string;
  chineseZodiac?: string;
  group?: string;
  school?: string[];
  zodiacSign?: string;
}

interface GroupProfile extends PublicFigureBase {
  is_group: true;
  members?: IndividualPerson[];
}

type PublicFigure = IndividualPerson | GroupProfile;

interface ProfileInfoProps {
  publicFigureData: PublicFigure;
  mainOverview?: {
    id: string;
    content: string;
    articleIds: string[];
  };
}

export default function ProfileInfo({ publicFigureData, mainOverview }: ProfileInfoProps) {
  const formatArrayValue = (value: string[] | undefined): string => {
    if (!value || value.length === 0) return 'N/A';
    return value.join(', ');
  };

  // Format date to be more readable 
  const formatDate = (dateString: string | undefined): string => {
    if (!dateString) return 'N/A';
    
    // Check if the dateString contains additional info after a colon
    const parts = dateString.split(':');
    const dateOnly = parts[0].trim();
    const additionalInfo = parts.length > 1 ? parts[1].trim() : '';
    
    try {
      const date = new Date(dateOnly);
      const options: Intl.DateTimeFormatOptions = { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      };
      const formattedDate = date.toLocaleDateString('en-US', options);
      return additionalInfo ? `${formattedDate} (${additionalInfo})` : formattedDate;
    } catch (error) {
      return dateString; // Return original if parsing fails
    }
  };
  
  // Determine which fields to display based on whether it's a group or individual
  interface ProfileField {
    label: string;
    value: string;
    details?: IndividualPerson[]; // Specifically for member info in groups
  }

  const getProfileFields = (): ProfileField[] => {
    const commonFields: ProfileField[] = [
      { label: "Gender", value: publicFigureData.gender },
      { label: "Nationality", value: publicFigureData.nationality },
      { label: "Company", value: publicFigureData.company || '' },
      { label: "Debut Date", value: formatDate(publicFigureData.debutDate) },
    ];

    if (publicFigureData.is_group) {
      // Group-specific fields
      return [
        ...commonFields,
        { 
          label: "Members", 
          value: (publicFigureData as GroupProfile).members?.length.toString() || "0",
          details: (publicFigureData as GroupProfile).members // Pass the full members array
        }
      ];
    } else {
      // Individual-specific fields
      const individualData = publicFigureData as IndividualPerson;
      return [
        ...commonFields,
        { label: "Birth Date", value: formatDate(individualData.birthDate) },
        { label: "Group", value: individualData.group || '' },
        { label: "Zodiac Sign", value: individualData.zodiacSign || '' },
        { label: "Chinese Zodiac", value: individualData.chineseZodiac || '' },
      ];
    }
  };

  // Additional info fields for the right section
  const getAdditionalFields = () => {
    const commonFields = [
      { label: "Occupation", value: formatArrayValue(publicFigureData.occupation) }
    ];

    if (!publicFigureData.is_group) {
      // Individual-specific additional fields
      const individualData = publicFigureData as IndividualPerson;
      return [
        ...commonFields,
        { label: "Education", value: formatArrayValue(individualData.school) }
      ];
    }

    return commonFields;
  };

  return (
    <div className="w-full bg-gray-50 dark:bg-slate-600 py-6 md:py-8 shadow-sm">
      <div className="w-[90%] md:w-[80%] mx-auto px-2 md:px-4">
        <div className="flex flex-col md:flex-row md:justify-between gap-6 md:gap-8">
          {/* Left Section - Profile Icon and Basic Info */}
          <div className="w-full md:w-64 flex flex-col items-center md:items-start md:border-r md:border-dashed md:border-gray-300 md:pr-4">
            <div className="w-32 h-32 rounded-lg bg-gray-200 overflow-hidden mb-4 flex items-center justify-center">
              {publicFigureData.profilePic ? (
                <Image 
                  src={publicFigureData.profilePic} 
                  alt={publicFigureData.name}
                  width={128}
                  height={128}
                  className="w-full h-full object-cover"
                  unoptimized
                />
              ) : (
                <User size={64} className="text-gray-400" />
              )}
            </div>

            <h1 className="text-xl md:text-2xl font-bold mb-1 text-center md:text-left text-black dark:text-white">
              {publicFigureData.name}
            </h1>
            
            {publicFigureData.name_kr && (
              <h2 className="text-lg md:text-xl font-medium mb-3 text-center md:text-left text-gray-600 dark:text-gray-300">
                {publicFigureData.name_kr}
              </h2>
            )}

            {/* Social Media Links */}
            {(publicFigureData.instagramUrl || publicFigureData.youtubeUrl || publicFigureData.spotifyUrl) && (
              <div className="flex space-x-3 mb-4">
                {publicFigureData.instagramUrl && (
                  <a href={publicFigureData.instagramUrl} target="_blank" rel="noopener noreferrer"
                    className="text-gray-600 hover:text-pink-500 transition-colors">
                    <Instagram size={20} />
                  </a>
                )}
                {publicFigureData.youtubeUrl && (
                  <a href={publicFigureData.youtubeUrl} target="_blank" rel="noopener noreferrer"
                    className="text-gray-600 hover:text-red-600 transition-colors">
                    <Youtube size={20} />
                  </a>
                )}
                {publicFigureData.spotifyUrl && (
                  <a href={publicFigureData.spotifyUrl} target="_blank" rel="noopener noreferrer"
                    className="text-gray-600 hover:text-green-500 transition-colors">
                    <Music size={20} />
                  </a>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 gap-y-3 w-full">
              {getProfileFields()
                .filter(item => item.value) // Only display fields with values
                .map((item, index) => (
                <div key={index} className="flex flex-col md:flex-row gap-1 md:gap-2">
                  <div className="text-sm font-medium text-center md:text-left text-black dark:text-white">
                    {item.label}:
                  </div>
                  <div className="text-sm text-center md:text-left text-black dark:text-white">
                    {item.value || "N/A"}
                    {/* Show member names if this is the Members field for a group */}
                    {item.label === "Members" && item.details && publicFigureData.is_group && (
                      <span className="block text-sm text-gray-600 dark:text-gray-300 mt-1">
                        {(item.details as IndividualPerson[]).map((member, i, arr) => (
                          <span key={member.name}>
                            {member.name}
                            {i < arr.length - 1 ? ', ' : ''}
                          </span>
                        ))}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              
              {/* Add occupation here */}
              <div className="flex flex-col md:flex-row gap-1 md:gap-2">
                <div className="text-sm font-medium text-center md:text-left text-black dark:text-white">
                  Occupation:
                </div>
                <div className="text-sm text-center md:text-left text-black dark:text-white">
                  {formatArrayValue(publicFigureData.occupation)}
                </div>
              </div>
            </div>
          </div>

          {/* Right Section - Main Overview */}
          <div className="w-full md:w-[70%] lg:w-[65%]">
            <h2 className="text-xl font-bold mb-6 text-black dark:text-white text-center md:text-left">
              Overview
            </h2>
            
            {mainOverview?.content ? (
              <div className="prose prose-sm text-black dark:text-gray-300 max-w-none">
                {mainOverview.content.replaceAll("*","'")}
              </div>
            ) : (
              <div className="text-center text-gray-500 dark:text-gray-400">
                No overview content available
              </div>
            )}
            
            {/* Add Last Updated Info */}
            {publicFigureData.lastUpdated && (
              <div className="mt-6 text-xs text-gray-500 dark:text-gray-400 text-right">
                Last Updated: {formatDate(publicFigureData.lastUpdated)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}