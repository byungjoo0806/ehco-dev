'use client';

import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useState } from "react";

export default function Home() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

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
  }

  return (
    <main className="p-4">
      <h1 className="text-2xl font-bold mb-4">Welcome to my website</h1>
      <p className="mb-4">This will now show up at the root URL (/)</p>

      <form onSubmit={handleSubmit} className="max-w-md space-y-4">
        <div>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            className="w-full px-3 py-2 border rounded"
            disabled={status === 'loading'}
          />
        </div>

        <button
          type="submit"
          disabled={status === 'loading'}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {status === 'loading' ? 'Subscribing...' : 'Subscribe to newsletter'}
        </button>

        {status === 'success' && (
          <p className="text-green-600">Successfully subscribed!</p>
        )}

        {status === 'error' && (
          <p className="text-red-600">{errorMessage}</p>
        )}
      </form>
    </main>
  )
}