'use client';

import { X } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLoading } from '@/context/LoadingContext'; // Import the loading hook

interface SlidingMenuProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function SlidingMenu({ isOpen, onClose }: SlidingMenuProps) {
    const router = useRouter(); // Add router for programmatic navigation
    const { showLoading } = useLoading(); // Use the loading context

    // Handle escape key press
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            // Prevent body scroll when menu is open
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose]);

    // Handle navigation with loading
    const handleNavigation = (path: string, loadingMessage: string) => {
        onClose(); // Close the menu first
        showLoading(loadingMessage);
        router.push(path);
    };

    return (
        <>
            {/* Backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 z-40"
                    onClick={onClose}
                />
            )}

            {/* Sliding Menu */}
            <div
                className={`fixed top-0 left-0 h-full w-80 bg-white shadow-lg z-50 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'
                    }`}
            >
                {/* Header with close button */}
                <div className="flex justify-end items-center p-6">
                    <button
                        onClick={onClose}
                        className="text-gray-600 hover:text-gray-800 transition-colors"
                        aria-label="Close menu"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Menu Items */}
                <nav className="px-8 py-4">
                    <ul className="space-y-8">
                        <li>
                            <button
                                onClick={() => handleNavigation('/', 'Loading home...')}
                                className="block w-full text-left text-2xl px-4 font-normal text-key-color hover:bg-slate-100 hover:rounded-full transition-colors"
                            >
                                Home
                            </button>
                        </li>
                        <li>
                            <button
                                onClick={() => handleNavigation('/all-figures', 'Loading all figures...')}
                                className="block w-full text-left text-2xl px-4 font-normal text-key-color hover:bg-slate-100 hover:rounded-full transition-colors"
                            >
                                Explore All
                            </button>
                        </li>
                        <li>
                            <button
                                onClick={() => handleNavigation('/favorites', 'Loading your favorites...')}
                                className="block w-full text-left text-2xl px-4 font-normal text-key-color hover:bg-slate-100 hover:rounded-full transition-colors"
                            >
                                My Favorites
                            </button>
                        </li>
                        <li>
                            <button
                                onClick={() => handleNavigation('/scrapped', 'Loading scrapped events...')}
                                className="block w-full text-left text-2xl px-4 font-normal text-key-color hover:bg-slate-100 hover:rounded-full transition-colors"
                            >
                                Scrapped Events
                            </button>
                        </li>
                        <li>
                            <button
                                onClick={() => handleNavigation('/about-ehco', 'Loading about us...')}
                                className="block w-full text-left text-2xl px-4 font-normal text-key-color hover:bg-slate-100 hover:rounded-full transition-colors"
                            >
                                About Us
                            </button>
                        </li>
                        <li>
                            <button
                                onClick={() => handleNavigation('/contact-us', 'Loading contact page...')}
                                className="block w-full text-left text-2xl px-4 font-normal text-key-color hover:bg-slate-100 hover:rounded-full transition-colors"
                            >
                                Contact Us
                            </button>
                        </li>
                    </ul>
                </nav>
            </div>
        </>
    );
}
