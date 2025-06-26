'use client';

import React, { useState } from 'react';
import { Loader2 } from 'lucide-react'; // Import the loader icon

// Define the props the component will accept
interface WelcomeBannerProps {
    onClose: () => void;
}

// Email validation function (copied from page.tsx)
const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

const WelcomeBanner: React.FC<WelcomeBannerProps> = ({ onClose }) => {
    // --- START: COPIED AND ADAPTED STATE FROM page.tsx ---
    const [email, setEmail] = useState('');
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [subscriptionError, setSubscriptionError] = useState('');
    const [isSubscribing, setIsSubscribing] = useState(false);
    // --- END: STATE ---


    // --- START: COPIED AND ADAPTED HANDLER FROM page.tsx ---
    const handleSubscribe = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubscriptionError('');

        if (!isValidEmail(email)) {
            setSubscriptionError('Please enter a valid email address.');
            return;
        }

        setIsSubscribing(true);

        try {
            const response = await fetch('/api/newsletter/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });

            const data = await response.json();

            if (response.ok) {
                setIsSubscribed(true);
                setEmail('');
            } else if (response.status === 409) {
                setSubscriptionError('This email is already subscribed.');
            } else {
                setSubscriptionError(data.message || 'Something went wrong. Please try again.');
            }
        } catch (error) {
            console.error('Subscription error:', error);
            setSubscriptionError('Network error. Please check your connection.');
        } finally {
            setIsSubscribing(false);
        }
    };

    const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setEmail(e.target.value);
        if (subscriptionError) {
            setSubscriptionError('');
        }
    };
    // --- END: HANDLER ---

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 md:p-8 text-center relative animate-fade-in-up">
                <button onClick={onClose} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>

                <div className="w-12 h-12 mx-auto mb-4 rounded-full flex items-center justify-center bg-[#FEE2E2]">
                    <span className="text-2xl text-[#D10041]">👋</span>
                </div>

                <h2 className="text-2xl font-bold text-gray-800">Welcome, friend!</h2>
                <p className="mt-2 text-gray-600">
                    We&apos;re a small team trying to build something valuable. Thank you for checking us out!
                </p>
                <div className="mt-4 p-3 bg-yellow-100 text-yellow-800 text-sm rounded-lg">
                    <p>
                        <span className="font-bold">EHCO is in Beta.</span> This means our data isn&apos;t perfect yet, but we&apos;re working hard to improve it every day.
                    </p>
                </div>

                {/* --- START: UPDATED FORM LOGIC --- */}
                {isSubscribed ? (
                    <div className="mt-6 p-4 bg-green-100 text-green-800 rounded-lg">
                        <p className="font-bold">Thank you for subscribing!</p>
                        <p className="text-sm">You&apos;re all set.</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubscribe} className="mt-6">
                        <div className="flex flex-col sm:flex-row gap-2">
                            <input
                                type="email"
                                value={email}
                                onChange={handleEmailChange}
                                placeholder="your.email@example.com"
                                required
                                className="flex-grow px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-300"
                                disabled={isSubscribing}
                            />
                            <button
                                type="submit"
                                className="px-5 py-2 text-white font-semibold rounded-lg shadow-md hover:opacity-90 transition-opacity flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed bg-key-color"
                                disabled={isSubscribing || !email.trim()}
                            >
                                {isSubscribing ? (
                                    <>
                                        <Loader2 className="animate-spin mr-2" size={18} />
                                        Subscribing...
                                    </>
                                ) : (
                                    'Get Updates'
                                )}
                            </button>
                        </div>
                        {subscriptionError && (
                            <p className="text-red-600 text-sm mt-2 text-left">{subscriptionError}</p>
                        )}
                    </form>
                )}
                {/* --- END: UPDATED FORM LOGIC --- */}

                <a
                    href="https://forms.gle/cygqvAxfaqR2FLSG8"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-block w-full px-5 py-3 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition-colors"
                >
                    Give Feedback on Google Forms
                </a>

                <button onClick={onClose} className="mt-3 text-sm text-gray-500 hover:underline">Continue to site</button>
            </div>
            <style>{`
                @keyframes fade-in-up {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in-up {
                    animation: fade-in-up 0.4s ease-out forwards;
                }
            `}</style>
        </div>
    );
};

export default WelcomeBanner;