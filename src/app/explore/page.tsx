'use client';

import { useEffect, useState, Suspense } from "react";
import { Loader2 } from "lucide-react";
import Link from 'next/link';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import Banner from "@/components/Banner";


interface Celebrity {
    id: string;
    name: string;
    profilePic: string;
    nationality: string;
    koreanName: string;
    birthDate: string;
    company: string;
}

// LoadingOverlay component
const LoadingOverlay = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg flex items-center space-x-3">
            <Loader2 className="animate-spin text-slate-600 dark:text-white" size={24} />
            <span className="text-slate-600 dark:text-white font-medium">Loading...</span>
        </div>
    </div>
);

// Create a separate component for the main content that uses useSearchParams
function ExploreContent({
    celebrities,
    onCelebrityClick
}: {
    celebrities: Celebrity[];
    onCelebrityClick: (id: string) => void;
}) {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const router = useRouter();

    useEffect(() => {
        onCelebrityClick(''); // Reset navigation state
    }, [pathname, searchParams, onCelebrityClick]);

    const handleCelebrityCardClick = async (e: React.MouseEvent, celebrity: Celebrity) => {
        e.preventDefault(); // Prevent default Link behavior
        onCelebrityClick(celebrity.id);
        router.push(`/${celebrity.id}?category=All&sort=newest&page=1`);
    };

    return (
        <div className="grid grid-cols-1 gap-8">
            {/* Add Banner component here */}
            <Banner
                celebrities={celebrities}
            />

            <div>
                <h2 className="text-2xl font-semibold mb-4">Featured Celebrities</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg::grid-cols-3 gap-4">
                    {celebrities.map((celebrity) => (
                        <Link
                            key={celebrity.id}
                            href={{
                                pathname: `/${celebrity.id}`,
                                query: {
                                    category: 'All',
                                    sort: 'newest',
                                    page: '1'
                                }
                            }}
                            onClick={(e) => handleCelebrityCardClick(e, celebrity)}
                        >
                            <div className="bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition-all duration-200 cursor-pointer hover:scale-110">
                                <div className="flex items-center space-x-4">
                                    {celebrity.profilePic && (
                                        <img
                                            src={celebrity.profilePic}
                                            alt={celebrity.name}
                                            className="w-16 h-16 rounded-full object-cover flex-shrink-0"
                                        />
                                    )}
                                    <div className="min-w-0 flex-1">
                                        <h3 className="font-semibold text-lg truncate">
                                            {celebrity.name}
                                        </h3>
                                        <p className="text-gray-600 text-sm truncate">
                                            {celebrity.koreanName}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default function ExplorePage() {
    const [celebrities, setCelebrities] = useState<Celebrity[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isNavigating, setIsNavigating] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const celebritiesRes = await fetch('/api/celebrities');

                if (!celebritiesRes.ok) {
                    throw new Error('Failed to fetch data');
                }

                const celebritiesData = await celebritiesRes.json();
                setCelebrities(celebritiesData.celebrities);
                setLoading(false);
            } catch (err) {
                console.error('Error fetching data:', err);
                setError('Failed to load data. Please try again later.');
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const handleCelebrityClick = async (celebrityId: string) => {
        if (celebrityId) {
            setIsNavigating(true);
            // Remove the loading state after navigation or after a timeout
            setTimeout(() => {
                setIsNavigating(false);
            }, 1000); // Adjust timeout as needed
        }
    };

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-red-500 text-center">
                    <p>{error}</p>
                </div>
            </div>
        );
    }

    return (
        <>
            {/* Show loading overlay during initial load or navigation */}
            {(loading || isNavigating) ? (
                <LoadingOverlay />
            ) : (
                <div className="w-[90%] md:w-[75%] lg:w-[60%] mx-auto px-4 py-8">
                    <Suspense fallback={
                        <div className="flex items-center justify-center p-8">
                            <Loader2 className="animate-spin text-slate-600" size={24} />
                        </div>
                    }>
                        <ExploreContent
                            celebrities={celebrities}
                            onCelebrityClick={handleCelebrityClick}
                        />
                    </Suspense>
                </div>
            )}
        </>
    );
}