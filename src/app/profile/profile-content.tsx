// src/app/profile/profile-content.tsx
'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
// import { getUserProfile } from '@/lib/user-service';
import { removeFromFavorites } from '@/lib/favorites-service';
import ProfileScrappedSectionEnhanced from '@/components/ProfileScrappedSectionEnhanced';
// import { Article } from '@/types/definitions';
import { User, Mail, Calendar, Loader2, Phone, Star, Trash2, Heart, Settings, FileText, ChevronDown } from 'lucide-react';
// --- UPDATED: Added sendEmailVerification ---
import { updateProfile, sendEmailVerification } from 'firebase/auth';
// import { PublicFigure } from '@/lib/figures-service';

// Import your new custom hook to consume the data
import { useProfileData } from '@/context/ProfileDataContext';
import { removeFromScrappedEvents } from '@/lib/scrapping-service';
import LoadingOverlay from '@/components/LoadingOverlay'; // Import the LoadingOverlay

type TabType = 'account' | 'favorites' | 'scrapped';

type ProfileContentProps = {
  initialTab: TabType;
};

export default function ProfileContent({ initialTab }: ProfileContentProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Consume all shared data from the context provider
  const {
    userProfile,
    favorites,
    scrappedEvents,
    articles,
    figureData,
    isLoading, // Single loading state for favorites & scrapped data
    isRouteLoading, // New: Route loading state
    setFavorites, // Function to update context state
    setScrappedEvents,
    setRouteLoading // New: Function to control route loading
  } = useProfileData();

  // State specific to this component's UI remains here
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [openAccordionTabs, setOpenAccordionTabs] = useState<TabType[]>([initialTab]); // <-- ADD THIS NEW STATE for mobile
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateMessage, setUpdateMessage] = useState('');
  const [removingId, setRemovingId] = useState<string | null>(null);
  // --- NEW: State for resend email button ---
  const [isResending, setIsResending] = useState(false);

  const mobileNavRef = useRef<HTMLElement>(null);

  // This useEffect is now simplified to only handle login checks and the basic user profile.
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (user) {
      setDisplayName(user.displayName || '');
    }
  }, [user, loading, router]);

  // This effect for syncing the tab with the URL remains unchanged
  useEffect(() => {
    const tabFromPath = pathname.split('/').pop();
    const validTabs: TabType[] = ['account', 'favorites', 'scrapped'];

    if (validTabs.includes(tabFromPath as TabType)) {
      if (activeTab !== tabFromPath) {
        setActiveTab(tabFromPath as TabType);
      }
    } else {
      // Handles the base '/profile' case
      if (activeTab !== 'account') {
        setActiveTab('account');
      }
    }
  }, [pathname, activeTab]);

  // mobile tab status
  useEffect(() => {
    if (mobileNavRef.current) {
      // Find the button that corresponds to the active tab
      const activeTabElement = mobileNavRef.current.querySelector(`[data-tab-id="${activeTab}"]`);

      if (activeTabElement) {
        // If the element is found, scroll it into the visible area
        activeTabElement.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'nearest'
        });
      }
    }
  }, [activeTab]);

  const handleRemoveFavorite = async (figureId: string) => {
    if (!user) return;
    setRemovingId(figureId);
    try {
      await removeFromFavorites(user.uid, figureId);
      // Update the shared state in the context directly
      setFavorites(prev => prev.filter(fav => fav.figureId !== figureId));
    } catch (error) {
      console.error('Error removing favorite:', error);
    } finally {
      setRemovingId(null);
    }
  };

  const handleRemoveScrappedEvent = async (scrappedEventId: string) => {
    if (!user) return;
    try {
      await removeFromScrappedEvents(user.uid, scrappedEventId);
      // Update the central state in the context
      setScrappedEvents(prev => prev.filter(event => event.id !== scrappedEventId));
    } catch (error) {
      console.error('Error removing scrapped event:', error);
    }
  };

  const handleUpdateProfile = async () => {
    if (!user) return;

    setIsUpdating(true);
    setUpdateMessage('');

    try {
      await updateProfile(user, { displayName });
      setUpdateMessage('Profile updated successfully!');
      setIsEditing(false);
    } catch (error) {
      setUpdateMessage('Failed to update profile. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  // --- NEW: Handler to resend verification email ---
  const handleResendVerification = async () => {
    if (!user) return;
    setIsResending(true);
    setUpdateMessage('');
    try {
      await sendEmailVerification(user);
      setUpdateMessage('A new verification email has been sent to your address.');
    } catch (error) {
      console.error("Error resending verification email:", error);
      setUpdateMessage('Failed to send verification email. Please try again later.');
    } finally {
      setIsResending(false);
    }
  };

  const handleTabClick = (tabId: TabType) => {
    // Show loading overlay before navigation
    setRouteLoading(true);
    
    // --- This part handles the Desktop Logic (unchanged behavior) ---
    setActiveTab(tabId);
    const newPath = tabId === 'account' ? '/profile' : `/profile/${tabId}`;
    router.push(newPath, { scroll: false });

    // --- This part handles the Mobile Accordion Logic ---
    setOpenAccordionTabs(prevOpenTabs => {
      // Check if the clicked tab is already in the array (i.e., it's open)
      if (prevOpenTabs.includes(tabId)) {
        // If it is, filter it out of the array to CLOSE it.
        return prevOpenTabs.filter(id => id !== tabId);
      } else {
        // If it's not, add it to the array to OPEN it.
        return [...prevOpenTabs, tabId];
      }
    });

    // Hide loading after a short delay to allow for smooth transition
    setTimeout(() => {
      setRouteLoading(false);
    }, 400);
  };

  const handleAccordionClick = (tabId: TabType) => {
    setOpenAccordionTabs(prevOpenTabs => {
      // Check if the clicked tab is already in the array (i.e., it's open)
      if (prevOpenTabs.includes(tabId)) {
        // If it is, filter it out of the array to CLOSE it.
        return prevOpenTabs.filter(id => id !== tabId);
      } else {
        // If it's not, add it to the array to OPEN it.
        return [...prevOpenTabs, tabId];
      }
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex items-center gap-3">
          <Loader2 className="animate-spin text-key-color" size={24} />
          <span className="text-gray-600">Loading...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to login
  }

  const joinDate = user.metadata.creationTime
    ? new Date(user.metadata.creationTime).toLocaleDateString()
    : 'Unknown';

  const navigationItems = [
    { id: 'account' as TabType, label: 'Account Information', icon: Settings },
    { id: 'favorites' as TabType, label: 'Favorites', icon: Star },
    { id: 'scrapped' as TabType, label: 'Scrapped Events', icon: FileText },
  ];

  const renderAccountSection = () => (
    <div className="bg-gray-50 rounded-2xl p-8">
      <h2 className="hidden md:block text-2xl font-bold text-gray-900 mb-6">Account Information</h2>
      <div className="space-y-6">
        <div>
          <label className="flex items-center gap-2 text-gray-900 font-medium mb-3">
            <User size={18} /> Display Name
          </label>
          {isEditing ? (
            <div className="space-y-3">
              <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Enter your display name" className="w-full px-4 py-3 border-2 border-key-color rounded-full focus:outline-none focus:border-pink-700 transition-colors" />
              <div className="flex gap-3">
                <button onClick={handleUpdateProfile} disabled={isUpdating} className="bg-key-color text-white font-medium px-6 py-2 rounded-full hover:bg-pink-700 transition-colors disabled:opacity-75 disabled:cursor-not-allowed flex items-center gap-2">
                  {isUpdating && <Loader2 className="animate-spin" size={16} />}
                  {isUpdating ? 'Saving...' : 'Save'}
                </button>
                <button onClick={() => { setIsEditing(false); setDisplayName(user.displayName || ''); }} className="bg-gray-300 text-gray-700 font-medium px-6 py-2 rounded-full hover:bg-gray-400 transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-gray-700 text-lg">{user.displayName || 'Not set'}</span>
              <button onClick={() => setIsEditing(true)} className="text-key-color hover:underline text-sm font-medium">Edit</button>
            </div>
          )}
        </div>
        {/* --- UPDATED: Email Address Section --- */}
        <div>
          <label className="flex items-center gap-2 text-gray-900 font-medium mb-3">
            <Mail size={18} /> Email Address
          </label>
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-gray-700 text-lg">{user.email}</span>
              <span className={`text-sm px-2 py-1 rounded-full w-fit mt-1 ${user.emailVerified ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                {user.emailVerified ? '✓ Verified' : '⚠ Not Verified'}
              </span>
            </div>
            {!user.emailVerified &&
              <button onClick={handleResendVerification} disabled={isResending} className="text-key-color hover:underline text-sm font-medium disabled:opacity-50 disabled:cursor-wait">
                {isResending ? 'Sending...' : 'Resend Email'}
              </button>
            }
          </div>
        </div>

        {/* --- REMOVED: Phone Verification Section --- */}

        <div>
          <label className="flex items-center gap-2 text-gray-900 font-medium mb-3">
            <Calendar size={18} /> Member Since
          </label>
          <span className="text-gray-700 text-lg">{joinDate}</span>
        </div>
        {user.providerData.length > 0 && (
          <div>
            <label className="block text-gray-900 font-medium mb-3">Sign-in Method</label>
            <div className="flex flex-wrap gap-2">
              {user.providerData.map((provider, index) => (
                <span key={index} className="bg-key-color text-white text-sm px-3 py-1 rounded-full">
                  {provider.providerId === 'google.com' ? 'Google' : provider.providerId === 'password' ? 'Email & Password' : provider.providerId}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="mt-8 pt-6 border-t border-gray-200">
        <p className="text-sm text-gray-500 mb-4">Need to change your password or delete your account?</p>
        <div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-4 sm:items-center">
          <button className="text-key-color hover:underline text-sm font-medium">Change Password</button>
          <span className="hidden sm:block text-gray-300">|</span>
          <button className="text-red-600 hover:underline text-sm font-medium">Delete Account</button>
        </div>
      </div>
    </div>
  );

  const renderFavoritesSection = () => (
    <div className="bg-gray-50 rounded-2xl p-8">
      <div className="hidden md:flex md:flex-row items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Star className="text-yellow-400 fill-yellow-400" size={24} />
          <h2 className="text-2xl font-bold text-gray-900">Your Favorites</h2>
        </div>
        <span className="text-sm text-gray-500 bg-gray-200 px-3 py-1 mt-2 md:mt-0 rounded-full">{favorites.length} item{favorites.length !== 1 ? 's' : ''}</span>
      </div>
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin text-gray-400" size={32} />
        </div>
      ) : favorites.length === 0 ? (
        <div className="text-center py-12">
          <Heart className="mx-auto mb-4 text-gray-300" size={64} />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No favorites yet</h3>
          <p className="text-gray-500 text-sm mb-6">Start favoriting figures to see them here</p>
          <Link href="/all-figures" className="inline-block bg-key-color text-white font-medium py-3 px-6 rounded-full hover:bg-pink-700 transition-colors">
            Explore Figures
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {favorites.map((favorite) => (
            <div key={favorite.figureId} className="flex items-center gap-3 p-4 bg-white rounded-xl hover:shadow-md transition-shadow">
              <div className="w-14 h-14 bg-gray-200 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0">
                {favorite.profilePic ? (
                  <Image src={favorite.profilePic} alt={favorite.figureName} width={56} height={56} className="w-full h-full object-cover" unoptimized />
                ) : (
                  <User size={24} className="text-gray-400" />
                )}
              </div>
              <div className="flex-grow min-w-0">
                <Link href={`/${favorite.figureId}`}>
                  <h3 className="font-medium text-gray-900 text-sm truncate hover:text-key-color transition-colors">{favorite.figureName}</h3>
                  <p className="text-xs text-gray-500 truncate">{favorite.figureNameKr}</p>
                </Link>
              </div>
              <button onClick={() => handleRemoveFavorite(favorite.figureId)} disabled={removingId === favorite.figureId} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0" title="Remove from favorites">
                {removingId === favorite.figureId ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderScrappedSection = () => {
    if (isLoading) {
      return (
        <div className="bg-gray-50 rounded-2xl p-8">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin text-gray-400" size={32} />
            <span className="ml-3 text-gray-600">Loading scrapped events and sources...</span>
          </div>
        </div>
      );
    }
    return <ProfileScrappedSectionEnhanced isFullView={true} isLoading={isLoading} articles={articles} figureData={figureData} scrappedEvents={scrappedEvents} onRemove={handleRemoveScrappedEvent} />;
  };

  return (
    <>
      {/* Loading Overlay */}
      <LoadingOverlay isVisible={isRouteLoading} message="Loading..." />
      
      <div className="min-h-screen bg-white">
      <main className="w-[90%] md:w-[80%] mx-auto px-4 py-8 lg:py-16">
        <div className="text-center mb-8">
          <h1 className="text-3xl lg:text-4xl font-bold text-key-color mb-4">Your Profile</h1>
          <p className="text-gray-600">Manage your account information and favorites</p>
        </div>
        {updateMessage && (
          <div className={`mb-6 p-4 rounded-lg max-w-4xl mx-auto ${updateMessage.includes('successfully') || updateMessage.includes('sent') ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
            <p className="text-sm">{updateMessage}</p>
          </div>
        )}

        {/* --- NEW: Mobile Tab Navigation --- */}
        {/* --- NEW: Mobile Accordion Navigation --- */}
        <div className="block lg:hidden space-y-3">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = openAccordionTabs.includes(item.id);

            return (
              <div key={item.id} className="border border-gray-200 rounded-xl overflow-hidden">
                {/* Accordion Header/Button */}
                <button
                  onClick={() => handleAccordionClick(item.id)}
                  className="w-full flex items-center justify-between p-4 text-left bg-gray-50 hover:bg-gray-100 focus:outline-none"
                >
                  <div className="flex items-center gap-3">
                    <Icon size={18} className="text-key-color" />
                    <span className="font-medium text-gray-900">{item.label}</span>
                  </div>
                  <ChevronDown
                    size={20}
                    className={`text-gray-500 transform transition-transform duration-300 ${isActive ? 'rotate-180' : ''
                      }`}
                  />
                </button>

                {/* Accordion Content Panel */}
                <div
                  className={`transition-all duration-500 ease-in-out overflow-hidden ${isActive ? 'max-h-screen' : 'max-h-0'
                    }`}
                >
                  <div className="p-4 border-t border-gray-200">
                    {item.id === 'account' && renderAccountSection()}
                    {item.id === 'favorites' && renderFavoritesSection()}
                    {item.id === 'scrapped' && renderScrappedSection()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          <div className="hidden lg:block w-64 flex-shrink-0">
            <nav className="lg:sticky lg:top-20">
              <div className="bg-gray-50 rounded-2xl p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-4 px-3">Navigation</h3>
                <ul className="space-y-1">
                  {navigationItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <li key={item.id}>
                        <button onClick={() => handleTabClick(item.id)} className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-colors ${isActive ? 'bg-key-color text-white shadow-md' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}>
                          <Icon size={18} />
                          <span className="font-medium">{item.label}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <div className="mt-6 pt-4 border-t border-gray-200">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3 px-3">Quick Stats</h4>
                  <div className="space-y-2 px-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Favorites</span>
                      <span className="font-medium text-gray-900">{favorites.length}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Scrapped Events</span>
                      <span className="font-medium text-gray-900">{scrappedEvents.length}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Member Since</span>
                      <span className="font-medium text-gray-900">{joinDate}</span>
                    </div>
                  </div>
                </div>
              </div>
            </nav>
          </div>
          <div className="hidden lg:block flex-1">
            {activeTab === 'account' && renderAccountSection()}
            {activeTab === 'favorites' && renderFavoritesSection()}
            {activeTab === 'scrapped' && renderScrappedSection()}
          </div>
        </div>
      </main>
      </div>
    </>
  );
}