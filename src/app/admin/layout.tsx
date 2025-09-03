// src/app/admin/layout.tsx
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Admin Dashboard | EHCO',
  description: 'Administrative dashboard for EHCO platform',
  robots: 'noindex, nofollow', // Prevent search engines from indexing admin pages
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      {children}
    </div>
  );
}
