import React from 'react';
import { useAllCelebrities } from '@/lib/hooks/useAllCelebrities';
import Link from 'next/link';

interface SlidingMenuProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function SlidingMenu({ isOpen, onClose }: SlidingMenuProps) {
    const { celebrities } = useAllCelebrities();
    // console.log(celebrities);

    return (
        <>
            {/* Overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 z-40"
                    onClick={onClose}
                />
            )}

            {/* Sliding Menu */}
            <div
                className={`fixed top-0 left-0 h-full w-64 bg-white dark:bg-slate-500 shadow-lg z-50 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'
                    }`}
            >
                <div className='w-full h-16 px-8 flex justify-start items-center border-b border-b-black dark:border-b-white'>
                    <p className='text-xl font-bold text-black dark:text-white'>Celebrities</p>
                </div>
                <div className="p-6">
                    <nav>
                        {celebrities.map((celebrity) => (
                            <Link key={celebrity.id} href={{
                                pathname: `/${celebrity.id}`,
                                query: {
                                    category: 'All',
                                    sort: 'newest',
                                    page: '1'
                                }
                            }} onClick={onClose} >
                                <div key={celebrity.name} className="flex items-center py-2 space-x-3 cursor-pointer border-b border-dashed border-b-black dark:border-b-white hover:bg-slate-200 dark:hover:bg-slate-600">
                                    <img
                                        src={celebrity.profilePic}
                                        alt={celebrity.name}
                                        className="w-12 h-12 rounded-full object-cover"
                                    />
                                    <div>
                                        <p className="font-medium text-black dark:text-white">{celebrity.name}</p>
                                        <p className="text-sm text-gray-600 dark:text-white">{celebrity.koreanName}</p>
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