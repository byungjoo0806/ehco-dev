'use client';

import React, { useEffect, useState } from 'react';
import { useAllCelebrities } from '@/lib/hooks/useAllCelebrities';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { usePathname, useSearchParams } from 'next/navigation';

interface SlidingMenuProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function SlidingMenu({ isOpen, onClose }: SlidingMenuProps) {
    const { celebrities } = useAllCelebrities();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [isNavigating, setIsNavigating] = useState(false);

    useEffect(() => {
        setIsNavigating(false);
    }, [pathname, searchParams]);

    const handleClick = (celebrityId: string) => {
        const currentCelebrityId = pathname.split('/')[1];
        if (currentCelebrityId !== celebrityId) {
            setIsNavigating(true);
        }
        onClose();
    };

    return (
        <>
            {isNavigating && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center">
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-lg flex items-center space-x-3">
                        <Loader2 className="animate-spin text-slate-600 dark:text-white" size={24} />
                        <span className="text-slate-600 dark:text-white font-medium">Loading...</span>
                    </div>
                </div>
            )}

            {isOpen && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 z-40 backdrop-blur-sm"
                    onClick={onClose}
                />
            )}

            <div
                className={`fixed top-0 left-0 h-full w-72 bg-white dark:bg-slate-800 shadow-xl z-50 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'
                    }`}
            >
                <div className="h-16 px-6 flex items-center bg-slate-50 dark:bg-slate-700">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white">Celebrities</h2>
                </div>

                <div className="p-4 overflow-y-auto max-h-[calc(100vh-4rem)]">
                    <nav className="space-y-3">
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
                                onClick={() => handleClick(celebrity.id)}
                            >
                                <div className="group p-3 rounded-lg transition-all duration-200 hover:bg-slate-100 dark:hover:bg-slate-700 hover:shadow-md">
                                    <div className="flex items-center space-x-4">
                                        <div className="relative">
                                            <img
                                                src={celebrity.profilePic}
                                                alt={celebrity.name}
                                                className="w-14 h-14 rounded-full object-cover ring-2 ring-slate-200 dark:ring-slate-600 group-hover:ring-slate-300 dark:group-hover:ring-slate-500 transition-all duration-200"
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="font-semibold text-slate-800 dark:text-white group-hover:text-slate-900 dark:group-hover:text-slate-200 transition-colors">
                                                {celebrity.name}
                                            </h3>
                                            <p className="text-sm text-slate-500 dark:text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300">
                                                {celebrity.koreanName}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </nav>
                </div>
            </div>
        </>
    );
}