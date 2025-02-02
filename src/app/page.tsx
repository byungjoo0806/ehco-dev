'use client';

import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import Link from "next/link";
import { useState } from "react";
import { Loader2 } from "lucide-react";

export default function Home() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [isNavigating, setIsNavigating] = useState(false);

  const handleNavigate = () => {
    setIsNavigating(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      setErrorMessage('Please enter an email address')
      setStatus('error')
      return
    };

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setErrorMessage('Please enter a valid email address')
      setStatus('error')
      return
    };

    setStatus('loading');

    try {
      // Check if email already exists
      const docRef = doc(db, 'subscribers', email.toLowerCase())
      const docSnap = await getDoc(docRef)

      if (docSnap.exists()) {
        setStatus('error')
        setErrorMessage('This email is already subscribed to our newsletter!')
        return
      }

      // Add new subscriber
      await setDoc(docRef, {
        email: email.toLowerCase(),
        createdAt: new Date()
      })

      setStatus('success')
      setEmail('')
      setErrorMessage('')
    } catch (error) {
      console.error('Error adding subscriber:', error)
      setStatus('error')
      setErrorMessage('Failed to subscribe. Please try again.')
    }
  };

  return (
    <>
      {/* Navigation Loading Overlay */}
      {isNavigating && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-lg flex items-center space-x-3">
            <Loader2 className="animate-spin text-slate-600 dark:text-white" size={24} />
            <span className="text-slate-600 dark:text-white font-medium">Loading...</span>
          </div>
        </div>
      )}

      <div className="w-full">
        <div className="w-[90%] md:w-[75%] lg:w-[60%] mx-auto py-8 px-4">
          {/* Main Hero Section */}
          <div className="flex flex-col justify-center items-center text-center h-80">
            <h1 className="text-2xl md:text-4xl font-bold mb-4">
              Entertainment News, <br />
              <span className="text-key-color">Organized</span> For You
            </h1>
            <p className="text-gray-600 mb-8">
              Track your favorite K-entertainment stars <br />
              with our comprehensive timeline of verified news from trusted sources.
            </p>
            <div className="flex justify-center gap-4">
              <Link href="/explore" onClick={handleNavigate}>
                <button className="bg-black text-white px-6 py-2 rounded-full text-sm md:text-base">
                  Start Exploring
                </button>
              </Link>
            </div>
          </div>

          {/* EHCO Experience Section */}
          {/* <div className="bg-gray-50 p-8 rounded-lg mb-16">
          <h2 className="text-xl md:text-2xl font-bold text-center mb-2">The EHCO Experience</h2>
          <p className="text-center text-gray-600 mb-12 text-sm md:text-base">
            Follow your favorite public figures with clarity and context
          </p> */}

          {/* Steps */}
          {/* <div className="space-y-12">
            <div className="text-center">
              <span className="text-2xl md:text-3xl text-red-500 font-bold">01</span>
              <h3 className="text-lg md:text-xl font-bold mt-2">Choose Your Focus</h3>
              <p className="text-gray-600 text-sm md:text-base">
                Select from our featured personalities, starting with top Korean celebrities
              </p>
            </div>

            <div className="text-center">
              <span className="text-2xl md:text-3xl text-red-500 font-bold">02</span>
              <h3 className="text-lg md:text-xl font-bold mt-2">Explore Their Timeline</h3>
              <p className="text-gray-600 text-sm md:text-base">
                See their journey unfold chronologically through verified news stories
              </p>
            </div>

            <div className="text-center">
              <span className="text-2xl md:text-3xl text-red-500 font-bold">03</span>
              <h3 className="text-lg md:text-xl font-bold mt-2">Filter By Interest</h3>
              <p className="text-gray-600 text-sm md:text-base">
                Focus on specific aspects -
                from career moves to public appearances
              </p>
            </div>
          </div>
        </div> */}
        </div>
        {/* Stay Updated Section */}
        <div className="bg-black text-white p-8 text-center h-88 flex flex-col justify-center items-center">
          <h2 className="text-xl md:text-4xl font-bold mb-4">Stay <span className="text-key-color">EHCO</span>ed!</h2>
          <p className="mb-8 text-sm md:text-base">
            Sign up for updates, special perks, <br />
            and stories that matter.
          </p>
          <form onSubmit={handleSubmit} className="w-full max-w-md mx-auto flex flex-col items-center">
            <div className="w-full flex flex-col items-center">
              <div className="w-64 sm:w-80 md:w-96">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="w-[80%] px-3 py-2 border rounded placeholder:text-center text-black"
                  disabled={status === 'loading'}
                />
              </div>

              {status === 'error' && (
                <p className="text-red-600">{errorMessage}</p>
              )}

              {status === 'success' && (
                <p className="text-green-600">Thanks for subscribing!</p>
              )}
            </div>

            <button
              type="submit"
              disabled={status === 'loading'}
              className="w-40 sm:w-48 px-4 py-2 mt-2 bg-key-color text-white rounded-lg hover:bg-red-400 disabled:opacity-50"
            >
              {status === 'loading' ? 'Subscribing...' : 'Subscribe'}
            </button>


          </form>
        </div>

        {/* Footer */}
        <div className="text-center text-gray-600 mt-4 mb-16">
          © 2025 EHCO. All rights reserved.
        </div>
      </div>
    </>
  )
}