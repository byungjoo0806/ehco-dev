'use client';

import { X } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';

interface SlidingMenuProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function SlidingMenu({ isOpen, onClose }: SlidingMenuProps) {
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
                className={`fixed top-0 left-0 h-full w-80 bg-white dark:bg-slate-800 shadow-lg z-50 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'
                    }`}
            >
                {/* Header with close button */}
                <div className="flex justify-end items-center p-6">
                    <button
                        onClick={onClose}
                        className="text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white transition-colors"
                        aria-label="Close menu"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Menu Items */}
                <nav className="px-8 py-4">
                    <ul className="space-y-8">
                        <li>
                            <Link
                                href="/"
                                onClick={onClose}
                                className="block text-2xl px-4 font-normal text-key-color hover:bg-slate-100 hover:rounded-full transition-colors"
                            >
                                Home
                            </Link>
                        </li>
                        <li>
                            <Link
                                href="/all-figures"
                                onClick={onClose}
                                className="block text-2xl px-4 font-normal text-key-color hover:bg-slate-100 hover:rounded-full transition-colors"
                            >
                                Explore All
                            </Link>
                        </li>
                        <li>
                            <Link
                                href="/about-ehco"
                                onClick={onClose}
                                className="block text-2xl px-4 font-normal text-key-color hover:bg-slate-100 hover:rounded-full transition-colors"
                            >
                                About Us
                            </Link>
                        </li>
                        <li>
                            <Link
                                href="/contact-us"
                                onClick={onClose}
                                className="block text-2xl px-4 font-normal text-key-color hover:bg-slate-100 hover:rounded-full transition-colors"
                            >
                                Contact
                            </Link>
                        </li>
                    </ul>
                </nav>
            </div>
        </>
    );
}