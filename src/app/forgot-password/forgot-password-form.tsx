// src/app/forgot-password/forgot-password-form.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2, ArrowLeft, CheckCircle } from 'lucide-react';
import { sendPasswordResetEmail, AuthError } from 'firebase/auth'; // It's good practice to use AuthError type if available, but checking properties is also fine.
import { auth } from '@/lib/firebase';

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await sendPasswordResetEmail(auth, email);
      setEmailSent(true);
    } catch (err) { // 1. Changed 'error: any' to 'err' (which is of type 'unknown')
      // Type guard to safely access the error code
      if (err && typeof err === 'object' && 'code' in err) {
        const errorCode = (err as { code: string }).code;
        switch (errorCode) {
          case 'auth/user-not-found':
            setError('No account found with this email address.');
            break;
          case 'auth/invalid-email':
            setError('Please enter a valid email address.');
            break;
          default:
            setError('Failed to send reset email. Please try again.');
        }
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (emailSent) {
    return (
      <div className="min-h-screen bg-white">
        <main className="max-w-md mx-auto px-4 py-16">
          <div className="text-center">
            <CheckCircle className="mx-auto mb-6 text-green-500" size={64} />
            <h1 className="text-3xl font-bold text-key-color mb-4">Check Your Email</h1>
            <p className="text-gray-600 mb-8">
              {/* 2. Fixed unescaped entity */}
              We&apos;ve sent a password reset link to <strong>{email}</strong>
            </p>
            <p className="text-sm text-gray-500 mb-8">
              {/* 3. Fixed unescaped entity */}
              Didn&apos;t receive the email? Check your spam folder or try again.
            </p>

            <div className="space-y-4">
              <button
                onClick={() => setEmailSent(false)}
                className="w-full bg-key-color text-white font-medium py-3 rounded-full hover:bg-pink-700 transition-colors"
              >
                Send Another Email
              </button>

              <Link
                href="/login"
                className="w-full bg-white border-2 border-gray-300 text-gray-700 font-medium py-3 rounded-full hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
              >
                <ArrowLeft size={20} />
                Back to Login
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <main className="max-w-md mx-auto px-4 py-16">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-key-color mb-4">Reset Password</h1>
          <p className="text-gray-600">
            {/* 4. Fixed unescaped entity */}
            Enter your email address and we&apos;ll send you a link to reset your password.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-gray-900 font-medium mb-2">
              Email Address
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              className="w-full px-4 py-3 border-2 border-key-color rounded-full focus:outline-none focus:border-pink-700 transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-key-color text-white font-medium py-3 rounded-full hover:bg-pink-700 transition-colors disabled:opacity-75 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading && <Loader2 className="animate-spin" size={20} />}
            {isLoading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>

        <div className="mt-8 text-center">
          <Link
            href="/login"
            className="text-key-color font-medium hover:underline flex items-center justify-center gap-2"
          >
            <ArrowLeft size={16} />
            Back to Login
          </Link>
        </div>
      </main>
    </div>
  );
}