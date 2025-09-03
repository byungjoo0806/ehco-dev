// src/app/phone-verification-required/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react'; // 1. Imported useCallback
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
  linkWithPhoneNumber
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { updateUserProfile } from '@/lib/user-service';
import { Loader2, Phone, Shield, ArrowLeft } from 'lucide-react';

// 2. Add type definition for window.recaptchaVerifier to avoid using 'as any'
declare global {
  interface Window {
    recaptchaVerifier?: RecaptchaVerifier;
  }
}

type Step = 'phone' | 'code' | 'complete';

export default function PhoneVerificationRequired() {
  const [step, setStep] = useState<Step>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [recaptchaResolved, setRecaptchaResolved] = useState(false);
  const [recaptchaInitialized, setRecaptchaInitialized] = useState(false);

  const { user, signOut } = useAuth();
  const router = useRouter();

  // Redirect if user is not authenticated
  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    // If user already has a verified phone, you might want to redirect
  }, [user, router]);

  // 3. Wrapped functions used in useEffect with useCallback
  const clearRecaptcha = useCallback(() => {
    if (window.recaptchaVerifier) {
      try {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = undefined;
      } catch (error) {
        console.error('Error clearing reCAPTCHA:', error);
      }
    }
    setRecaptchaResolved(false);
    setRecaptchaInitialized(false);
  }, []);

  const setupRecaptcha = useCallback(() => {
    if (typeof window === 'undefined') return;

    try {
      clearRecaptcha();

      setTimeout(() => {
        const container = document.getElementById('recaptcha-container');
        if (!container) {
          console.error('reCAPTCHA container not found');
          setError('reCAPTCHA container not ready. Please try again.');
          return;
        }

        const recaptchaVerifier = new RecaptchaVerifier(
          auth,
          'recaptcha-container',
          {
            size: 'normal',
            callback: (response: string) => {
              console.log('reCAPTCHA solved:', response);
              setRecaptchaResolved(true);
              setError('');
            },
            'expired-callback': () => {
              console.log('reCAPTCHA expired');
              setRecaptchaResolved(false);
              setError('reCAPTCHA expired. Please solve it again.');
            },
            // 4. Typed the error parameter
            'error-callback': (err: Error) => {
              console.error('reCAPTCHA error:', err);
              setError('reCAPTCHA failed to load. Please refresh the page.');
            }
          }
        );

        window.recaptchaVerifier = recaptchaVerifier;

        recaptchaVerifier.render()
          .then(() => {
            console.log('reCAPTCHA rendered successfully');
            setRecaptchaInitialized(true);
            setError('');
          })
          // 5. Typed the error parameter
          .catch((err: Error) => {
            console.error('reCAPTCHA render error:', err);
            setError('Failed to load reCAPTCHA. Please refresh the page.');
            setRecaptchaInitialized(false);
          });
      }, 500);

    } catch (err) { // 6. Used a type guard for the caught error
      console.error('reCAPTCHA setup error:', err);
      setError('Failed to initialize reCAPTCHA. Please refresh the page.');
    }
  }, [clearRecaptcha]);

  useEffect(() => {
    if (step === 'phone') {
      setupRecaptcha();
    }

    return () => {
      if (step !== 'phone' && step !== 'code') {
        clearRecaptcha();
      }
    };
  }, [step, setupRecaptcha, clearRecaptcha]); // 7. Added missing dependencies

  const handlePhoneSubmit = async () => {
    if (!phoneNumber.trim()) {
      setError('Please enter a phone number');
      return;
    }

    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;

    if (!phoneRegex.test(formattedPhone)) {
      setError('Please enter a valid phone number with country code');
      return;
    }

    if (!recaptchaResolved || !recaptchaInitialized) {
      setError('Please complete the reCAPTCHA verification first');
      return;
    }

    if (!user) {
      setError('No authenticated user found');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const appVerifier = window.recaptchaVerifier;

      if (!appVerifier) {
        throw new Error('reCAPTCHA not initialized properly');
      }

      console.log('Linking phone number to existing account:', formattedPhone);

      const confirmationResult = await linkWithPhoneNumber(user, formattedPhone, appVerifier);

      setConfirmationResult(confirmationResult);
      setPhoneNumber(formattedPhone);
      setStep('code');
      console.log('Verification code sent successfully');

    } catch (err) { // 8. Used a type guard for the caught error
      console.error('Error sending verification code:', err);

      if (err && typeof err === 'object' && 'code' in err) {
        const firebaseError = err as { code: string; message: string };
        switch (firebaseError.code) {
          case 'auth/invalid-phone-number':
            setError('Invalid phone number format. Please include country code.');
            break;
          case 'auth/too-many-requests':
            setError('Too many verification attempts. Please wait and try again.');
            break;
          case 'auth/provider-already-linked':
            setError('A phone number is already linked to this account.');
            break;
          case 'auth/credential-already-in-use':
            setError('This phone number is already in use by another account.');
            break;
          case 'auth/network-request-failed':
            setError('Network error. Please check your connection and try again.');
            break;
          default:
            setError(`Verification failed: ${firebaseError.message}`);
        }
      } else if (err instanceof Error) {
        setError(`Verification failed: ${err.message}`);
      } else {
        setError('An unknown error occurred during verification.');
      }

      setTimeout(() => setupRecaptcha(), 1000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCodeVerification = async () => {
    if (!verificationCode.trim() || verificationCode.length !== 6) {
      setError('Please enter the 6-digit verification code');
      return;
    }

    if (!confirmationResult) {
      setError('No verification in progress');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await confirmationResult.confirm(verificationCode);
      console.log('Phone number linked successfully');

      if (user) {
        await updateUserProfile(user.uid, {
          phoneNumber: phoneNumber,
          phoneVerified: true,
        });
      }

      clearRecaptcha();
      setStep('complete');

      setTimeout(() => {
        router.push('/');
      }, 2000);

    } catch (err) { // 9. Used a type guard for the caught error
      console.error('Error verifying code:', err);

      if (err && typeof err === 'object' && 'code' in err) {
        const firebaseError = err as { code: string; message: string };
        switch (firebaseError.code) {
          case 'auth/invalid-verification-code':
            setError('Invalid verification code. Please check and try again.');
            break;
          case 'auth/code-expired':
            setError('Verification code expired. Please request a new one.');
            break;
          default:
            setError(`Verification failed: ${firebaseError.message}`);
        }
      } else if (err instanceof Error) {
        setError(`Verification failed: ${err.message}`);
      } else {
        setError('An unknown verification error occurred.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  const goBack = () => {
    setError('');
    if (step === 'code') {
      setStep('phone');
      setupRecaptcha();
    }
  };

  if (step === 'complete') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="max-w-md mx-auto px-4 text-center">
          <div className="mb-6">
            <Shield className="mx-auto text-green-500" size={64} />
          </div>
          <h1 className="text-3xl font-bold text-key-color mb-4">Phone Verified!</h1>
          <p className="text-gray-600 mb-4">
            {/* 10. Escaped the apostrophe */}
            Your phone number has been successfully verified and linked to your account.
            You&apos;ll be redirected to the home page shortly.
          </p>
          <div className="animate-pulse">
            <Loader2 className="mx-auto text-key-color animate-spin" size={24} />
          </div>
        </div>
      </div>
    );
  }

  if (step === 'code') {
    return (
      <div className="min-h-screen bg-white">
        <main className="max-w-md mx-auto px-4 py-16">
          <button
            onClick={goBack}
            className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-800"
          >
            <ArrowLeft size={20} />
            Back to Phone Number
          </button>

          <div className="space-y-6">
            <div className="text-center">
              <Shield className="mx-auto mb-4 text-key-color" size={48} />
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Enter Verification Code
              </h3>
              <p className="text-gray-600">
                We sent a 6-digit code to {phoneNumber}
              </p>
              {phoneNumber.includes('+1 650 555') && (
                <p className="text-sm text-blue-600 mt-2">
                  💡 For test number, use code: <strong>123456</strong>
                </p>
              )}
            </div>

            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            <div>
              <input
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Enter 6-digit code"
                className="w-full px-4 py-3 border-2 border-key-color rounded-full focus:outline-none focus:border-pink-700 transition-colors text-center text-lg tracking-widest"
                maxLength={6}
                autoComplete="one-time-code"
                inputMode="numeric"
              />
            </div>

            <button
              onClick={handleCodeVerification}
              disabled={isLoading || verificationCode.length !== 6}
              className="w-full bg-key-color text-white font-medium py-3 rounded-full hover:bg-pink-700 transition-colors disabled:opacity-75 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading && <Loader2 className="animate-spin" size={20} />}
              {isLoading ? 'Verifying...' : 'Verify Phone Number'}
            </button>
          </div>
        </main>
      </div>
    );
  }

  // Default: phone step
  return (
    <div className="min-h-screen bg-white">
      <main className="max-w-md mx-auto px-4 py-16">
        <div className="mb-6 flex justify-between items-center">
          <h2 className="text-sm text-gray-500">Signed in as {user?.email}</h2>
          <button
            onClick={handleSignOut}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Sign out
          </button>
        </div>

        <div className="space-y-6">
          <div className="text-center">
            <Phone className="mx-auto mb-4 text-key-color" size={48} />
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              Phone Verification Required
            </h3>
            <p className="text-gray-600 mb-2">
              To complete your EHCO account setup, please verify your phone number
            </p>
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-700">
                🔒 This is required for account security and to access all EHCO features
              </p>
            </div>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <div>
            <label htmlFor="phone" className="block text-gray-900 font-medium mb-2">
              Phone Number *
            </label>
            <input
              type="tel"
              id="phone"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+1 555 123 4567"
              className="w-full px-4 py-3 border-2 border-key-color rounded-full focus:outline-none focus:border-pink-700 transition-colors"
              inputMode="tel"
            />
            <div className="text-xs text-gray-500 mt-2 space-y-1">
              <p>Enter with country code: +1 for US, +82 for Korea, etc.</p>
              <p className="text-blue-600">For testing: +1 650 555 3434</p>
            </div>
          </div>

          <div className="flex justify-center">
            <div id="recaptcha-container"></div>
            {!recaptchaInitialized && !error && (
              <div className="flex items-center gap-2 text-gray-500 text-sm">
                <Loader2 className="animate-spin" size={16} />
                Loading reCAPTCHA...
              </div>
            )}
          </div>

          <button
            onClick={handlePhoneSubmit}
            disabled={isLoading || !recaptchaResolved || !recaptchaInitialized}
            className="w-full bg-key-color text-white font-medium py-3 rounded-full hover:bg-pink-700 transition-colors disabled:opacity-75 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading && <Loader2 className="animate-spin" size={20} />}
            {isLoading ? 'Sending Code...' : 'Send Verification Code'}
          </button>

          {(!recaptchaResolved || !recaptchaInitialized) && !isLoading && (
            <p className="text-xs text-center text-gray-500">
              {!recaptchaInitialized ? 'Waiting for reCAPTCHA to load...' : 'Please complete the reCAPTCHA above to continue'}
            </p>
          )}
        </div>
      </main>
    </div>
  );
}