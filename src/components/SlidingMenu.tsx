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
                className={`fixed top-0 left-0 h-full w-64 bg-white shadow-lg z-50 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'
                    }`}
            >
                <div className='w-full h-16 px-8 flex justify-start items-center border-b'>
                    <p className='text-xl font-bold'>Celebrities</p>
                </div>
                <div className="p-6">
                    <nav className="space-y-4">
                        {celebrities.map((item) => (
                            <Link key={item.id} href={{
                                pathname: `/${item.id}`,
                                query: {
                                  category: 'All',
                                  sort: 'newest',
                                  page: '1'
                                }
                              }} onClick={onClose} className='block p-2 hover:bg-gray-100 rounded-lg'>
                                {item.name}
                            </Link>
                        ))}
                    </nav>
                </div>
            </div>
        </>
    );
}