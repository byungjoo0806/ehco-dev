// src/components/ProfileInfo.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { User, Instagram, Youtube, Music, Globe, Twitter, Facebook, Star, LogIn, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { addToFavorites, removeFromFavorites, isInFavorites } from '@/lib/favorites-service';
import { createUrlSlug } from '@/lib/slugify';

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

// --- LOGIN PROMPT MODAL ---
const LoginPromptModal: React.FC<{ onClose: () => void; onLogin: () => void; onSignup: () => void }> = ({
  onClose,
  onLogin,
  onSignup
}) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={onClose}>
    <div className="bg-white rounded-lg p-6 max-w-sm w-full relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={onClose}
        className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 transition-colors"
        aria-label="Close modal"
      >
        <X size={24} />
      </button>
      <div className="text-center">
        <Star className="mx-auto mb-4 text-yellow-400" size={48} />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Save to Favorites</h3>
        <p className="text-gray-600 mb-6">Sign in or create an account to save your favorite figures and access them anytime.</p>

        <div className="space-y-3">
          <button
            onClick={onLogin}
            className="w-full bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
          >
            <LogIn size={18} />
            Sign In
          </button>

          <button
            onClick={onSignup}
            className="w-full bg-gray-100 text-gray-800 font-semibold py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Create Account
          </button>

          <button
            onClick={onClose}
            className="w-full text-gray-500 text-sm hover:text-gray-700 transition-colors"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  </div>
);

// --- HELPER COMPONENTS & FUNCTIONS ---
const InfoField: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div>
    <p className="text-xs font-semibold text-gray-500">{label}</p>
    <p className="text-sm text-gray-800">{value}</p>
  </div>
);

const SocialLink: React.FC<{ href?: string; icon: React.ReactNode; label: string }> = ({ href, icon, label }) => {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-blue-500 transition-colors"
    >
      {icon}
      {label}
    </a>
  );
};

// --- MAIN COMPONENT ---
export default function ProfileInfo({ publicFigureData }: ProfileInfoProps) {
  const { user } = useAuth();
  const [isFavorited, setIsFavorited] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  // Check if this figure is in user's favorites when component mounts or user changes
  useEffect(() => {
    const checkFavoriteStatus = async () => {
      if (user) {
        try {
          const favorited = await isInFavorites(user.uid, publicFigureData.id);
          setIsFavorited(favorited);
        } catch (error) {
          console.error('Error checking favorite status:', error);
        }
      } else {
        setIsFavorited(false);
      }
    };

    checkFavoriteStatus();
  }, [user, publicFigureData.id]);

  const renderRolesValue = (occupation: string): React.ReactNode => {
    const groupRegex = /^(.*?)\s*\((.*?)\)$/;
    const match = occupation.match(groupRegex);

    if (match) {
      const rolesText = match[1].trim();
      const groupName = match[2].trim();
      return (
        <>
          {rolesText} (
          <Link href={`/${createUrlSlug(groupName)}`} className="hover:underline hover:text-blue-500 transition-colors">
            {groupName}
          </Link>
          )
        </>
      );
    }

    return occupation; // Return the plain string if no match
  };

  const handleFavoriteClick = async () => {
    if (!user) {
      setShowLoginPrompt(true);
      return;
    }

    setIsLoading(true);
    try {
      if (isFavorited) {
        await removeFromFavorites(user.uid, publicFigureData.id);
        setIsFavorited(false);
      } else {
        await addToFavorites(user.uid, {
          figureId: publicFigureData.id,
          figureName: publicFigureData.name,
          figureNameKr: publicFigureData.name_kr,
          profilePic: publicFigureData.profilePic
        });
        setIsFavorited(true);
      }
    } catch (error) {
      console.error('Error updating favorites:', error);
      // You might want to show a toast notification here
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginRedirect = () => {
    sessionStorage.setItem('redirectPath', window.location.pathname);
    setShowLoginPrompt(false);
    window.location.href = '/login';
  };

  const handleSignupRedirect = () => {
    sessionStorage.setItem('redirectPath', window.location.pathname);
    setShowLoginPrompt(false);
    window.location.href = '/signup';
  };

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

  return (
    <>
      {/* Main container with two-column layout */}
      <div className="flex flex-col sm:flex-row gap-6 sm:gap-8 w-full p-4 border shadow-md rounded-lg relative">

        {/* Star Icon - positioned at top right */}
        <button
          onClick={handleFavoriteClick}
          disabled={isLoading}
          className="absolute top-4 right-4 z-10 p-2 rounded-full hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Star
            size={24}
            className={`transition-colors ${isFavorited
              ? 'fill-yellow-400 text-yellow-400'
              : 'text-gray-400 hover:text-yellow-400'
              }`}
          />
        </button>

        {/* --- LEFT COLUMN: PROFILE IMAGE --- */}
        <div className="w-full sm:w-1/3 md:w-48 lg:w-56 flex-shrink-0">
          <div className="aspect-square w-full bg-gray-200 rounded-lg overflow-hidden flex items-center justify-center">
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
          <h1 className="text-3xl font-bold text-gray-900 pr-12">{publicFigureData.name}</h1>
          <h2 className='text-xl font-bold text-gray-500 pr-12'>{publicFigureData.name_kr}</h2>

          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-y-4 gap-x-8 mt-6">
            {!publicFigureData.is_group && (
              <InfoField label="Born" value={formatDate((publicFigureData as IndividualPerson).birthDate)} />
            )}
            <InfoField label="Origin" value={publicFigureData.nationality} />
            {!publicFigureData.is_group && (
              <InfoField label="Roles" value={renderRolesValue(publicFigureData.occupation[0])} />
            )}
            <InfoField label="Labels" value={publicFigureData.company || 'N/A'} />
            {publicFigureData.is_group && (
              <div>
                <p className="text-xs font-semibold text-gray-500">Members</p>
                <div className="text-sm text-gray-800 flex flex-wrap items-center gap-x-1">
                  {publicFigureData.members?.map((member, index) => (
                    <React.Fragment key={member.name}>
                      <Link href={`/${createUrlSlug(member.name)}`} className="hover:underline hover:text-blue-500 transition-colors">
                        {member.name}
                      </Link>
                      {/* This check is safe because this code only runs if members exists */}
                      {publicFigureData.members && index < publicFigureData.members.length - 1 && <span>,</span>}
                    </React.Fragment>
                  ))}

                  {/* Explicitly render N/A if members is missing or empty */}
                  {(!publicFigureData.members || publicFigureData.members.length === 0) && (
                    <span>N/A</span>
                  )}
                </div>
              </div>
            )}
            <InfoField label="Years Active" value={getYearsActive(publicFigureData.debutDate)} />
          </div>

          {/* Official Links */}
          <div className="mt-8 pt-4 border-t border-gray-200">
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
        </div>
      </div>

      {/* Login Prompt Modal */}
      {showLoginPrompt && (
        <LoginPromptModal
          onClose={() => setShowLoginPrompt(false)}
          onLogin={handleLoginRedirect}
          onSignup={handleSignupRedirect}
        />
      )}
    </>
  );
}