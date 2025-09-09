// src/app/profile/[[...tab]]/page.tsx
import { Metadata } from 'next';
import ProfileContent from '../profile-content';
import { ProfileDataProvider } from '@/context/ProfileDataContext';

export const metadata: Metadata = {
  title: 'Profile - EHCO',
  description: 'Access and customize your EHCO profile dashboard. Manage account settings, view your favorite K-Pop artists, organize saved content, and personalize your Korean entertainment experience. Control privacy settings, notification preferences, and account security.',
};

// Define the type for the URL parameters
type ProfilePageProps = {
  params: Promise<{
    tab?: string[];
  }>;
};

export default async function ProfilePage({ params }: ProfilePageProps) {
  // Determine the active tab from the URL. Default to 'account'.
  // params.tab will be an array, e.g., ['favorites']. We take the first item.
  const resolvedParams = await params;
  const activeTab = resolvedParams.tab?.[0] || 'account';

  // Ensure the tab is one of the valid types.
  const validTabs = ['account', 'favorites', 'scrapped'];
  const initialTab = validTabs.includes(activeTab) ? activeTab : 'account';

  return (
    <ProfileContent initialTab={initialTab as 'account' | 'favorites' | 'scrapped'} />
  );
}