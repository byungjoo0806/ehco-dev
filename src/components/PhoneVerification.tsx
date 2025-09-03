// src/components/PhoneVerification.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
  User // 1. Import the User type
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Loader2, Phone, Shield, RefreshCw } from 'lucide-react';

// 2. Add type definition for window.recaptchaVerifier to avoid using 'as any'
declare global {
  interface Window {
    recaptchaVerifier?: RecaptchaVerifier;
  }
}

interface PhoneVerificationProps {
  onVerificationComplete: (phoneNumber: string) => void;
  onSkip?: () => void;
  currentUser?: User | null; // 3. Use the User type
}

export default function PhoneVerification({
  onVerificationComplete,
  onSkip,
  currentUser
}: PhoneVerificationProps) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [recaptchaResolved, setRecaptchaResolved] = useState(false);
  const [showNetworkErrorOverride, setShowNetworkErrorOverride] = useState(false);
  const [recaptchaInitialized, setRecaptchaInitialized] = useState(false);

  const clearRecaptcha = useCallback(() => {
    if (window.recaptchaVerifier) {
      try {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = undefined;
      } catch (err) { // 4. Typed the caught error
        console.error('Error clearing reCAPTCHA:', err);
      }
    }
    setRecaptchaResolved(false);
    setRecaptchaInitialized(false);
  }, []);

  const setupRecaptcha = useCallback(() => {
    if (typeof window === 'undefined') return;

    try {
      // Clear any existing reCAPTCHA
      clearRecaptcha();

      // Wait a bit for DOM to be ready
      setTimeout(() => {
        const container = document.getElementById('recaptcha-container');
        if (!container) {
          console.error('reCAPTCHA container not found');
          setError('reCAPTCHA container not ready. Please try again.');
          return;
        }

        // Create new reCAPTCHA verifier with improved settings
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
            'error-callback': (err: Error) => { // 5. Typed the error parameter
              console.error('reCAPTCHA error:', err);
              setError('reCAPTCHA failed to load. Please refresh the page or check your internet connection.');
            }
          }
        );

        window.recaptchaVerifier = recaptchaVerifier;

        // Render the reCAPTCHA
        recaptchaVerifier.render()
          .then(() => {
            console.log('reCAPTCHA rendered successfully');
            setRecaptchaInitialized(true);
            setError('');
          })
          .catch((err: Error) => { // 6. Typed the caught error
            console.error('reCAPTCHA render error:', err);
            setError('Failed to load reCAPTCHA. Please check your internet connection and refresh the page.');
            setRecaptchaInitialized(false);
          });
      }, 500);

    } catch (err) { // 7. Typed the caught error
      console.error('reCAPTCHA setup error:', err);
      setError('Failed to initialize reCAPTCHA. Please refresh the page.');
      setRecaptchaInitialized(false);
    }
  }, [clearRecaptcha]);

  const sendVerificationCode = async () => {
    if (!phoneNumber.trim()) {
      setError('Please enter a phone number');
      return;
    }

    // Validate phone number format
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;

    if (!phoneRegex.test(formattedPhone)) {
      setError('Please enter a valid phone number with country code (e.g., +1234567890)');
      return;
    }

    if (!recaptchaResolved || !recaptchaInitialized) {
      setError('Please complete the reCAPTCHA verification first');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const appVerifier = window.recaptchaVerifier;

      if (!appVerifier) {
        throw new Error('reCAPTCHA not initialized properly');
      }

      console.log('Sending verification to:', formattedPhone);

      // Test network connectivity first
      try {
        await fetch('https://www.google.com/favicon.ico', {
          method: 'HEAD',
          mode: 'no-cors'
        });
        console.log('Network connectivity test passed');
      } catch (networkError) {
        console.warn('Network connectivity test failed:', networkError);
        setError('Network connection issue detected. Please check your internet connection.');
        setIsLoading(false);
        return;
      }

      const confirmationResult = await signInWithPhoneNumber(
        auth,
        formattedPhone,
        appVerifier
      );

      setConfirmationResult(confirmationResult);
      setStep('code');
      console.log('Verification code sent successfully');

    } catch (err) { // 8. Used a type guard for the caught error
      console.error('Error sending verification code:', err);

      let errorCode = 'unknown';
      let errorMessage = 'An unknown error occurred.';

      if (err && typeof err === 'object') {
        if ('code' in err) errorCode = (err as { code: string }).code;
        if ('message' in err) errorMessage = (err as { message: string }).message;
      }

      console.error('Error code:', errorCode);
      console.error('Error message:', errorMessage);

      switch (errorCode) {
        case 'auth/invalid-phone-number':
          setError('Invalid phone number format. Please include country code (e.g., +1 for US, +82 for Korea).');
          break;
        case 'auth/too-many-requests':
          setError('Too many verification attempts. Please wait 15 minutes before trying again.');
          break;
        case 'auth/captcha-check-failed':
          setError('reCAPTCHA verification failed. Please solve the reCAPTCHA again.');
          setRecaptchaResolved(false);
          break;
        case 'auth/invalid-app-credential':
          setError('Phone authentication not properly configured. Please contact support.');
          break;
        case 'auth/quota-exceeded':
          setError('Daily SMS quota exceeded. Please try again tomorrow.');
          break;
        case 'auth/network-request-failed':
          setError('Network error: Please check your internet connection and try again. If the problem persists, try using a different network or contact support.');
          break;
        case 'auth/app-not-authorized':
          setError('App not authorized for phone authentication. Please contact support.');
          break;
        default:
          setError(`Verification failed: ${errorMessage}. Please try again or contact support if the issue persists.`);
      }

      // Reset reCAPTCHA on error
      setTimeout(() => {
        if (errorCode === 'auth/captcha-check-failed' || errorCode === 'auth/network-request-failed') {
          setupRecaptcha();
        }
      }, 1000);

    } finally {
      setIsLoading(false);
    }
  };

  const verifyCode = async () => {
    if (!verificationCode.trim()) {
      setError('Please enter the verification code');
      return;
    }

    if (!confirmationResult) {
      setError('No verification in progress. Please request a new code.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Test network connectivity before verification
      try {
        await fetch('https://www.google.com/favicon.ico', {
          method: 'HEAD',
          mode: 'no-cors'
        });
        console.log('Network connectivity test passed for verification');
      } catch (networkError) {
        console.warn('Network connectivity test failed for verification:', networkError);
        // Continue anyway but warn user
      }

      const result = await confirmationResult.confirm(verificationCode);

      console.log('Phone verification successful:', result);

      // Clean up reCAPTCHA
      clearRecaptcha();

      // Call the success callback
      onVerificationComplete(phoneNumber);

    } catch (err) { // 9. Used a type guard for the caught error
      console.error('Error verifying code:', err);

      let errorCode = 'unknown';
      let errorMessage = 'An unknown error occurred.';

      if (err && typeof err === 'object') {
        if ('code' in err) errorCode = (err as { code: string }).code;
        if ('message' in err) errorMessage = (err as { message: string }).message;
      }

      console.error('Error code:', errorCode);
      console.error('Error message:', errorMessage);

      switch (errorCode) {
        case 'auth/invalid-verification-code':
          setError('Invalid verification code. Please check the 6-digit code and try again.');
          break;
        case 'auth/code-expired':
          setError('Verification code has expired. Please request a new code.');
          break;
        case 'auth/network-request-failed':
          setError('Network error during verification. If you entered the correct code, you can continue anyway or try again.');
          setShowNetworkErrorOverride(true);
          break;
        case 'auth/too-many-requests':
          setError('Too many verification attempts. Please wait a moment and try again.');
          break;
        case 'auth/session-expired':
          setError('Verification session expired. Please request a new code.');
          break;
        default:
          setError(`Verification failed: ${errorMessage}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleNetworkErrorOverride = () => {
    console.log('User manually confirmed verification despite network error');
    clearRecaptcha();
    onVerificationComplete(phoneNumber);
  };

  const handleSkip = () => {
    clearRecaptcha();
    if (onSkip) {
      onSkip();
    }
  };

  const handleBackToPhone = () => {
    setStep('phone');
    setVerificationCode('');
    setConfirmationResult(null);
    setError('');
    setShowNetworkErrorOverride(false);
    // Re-setup reCAPTCHA
    setTimeout(() => setupRecaptcha(), 100);
  };

  const handleRefreshRecaptcha = () => {
    setError('');
    setupRecaptcha();
  };

  // Initialize reCAPTCHA when component mounts and we're on phone step
  useEffect(() => {
    if (step === 'phone') {
      setupRecaptcha();
    }

    // Cleanup on unmount
    return () => {
      clearRecaptcha();
    };
  }, [step, setupRecaptcha, clearRecaptcha]);

  // Check network connectivity
  useEffect(() => {
    const handleOnline = () => {
      setError('');
      console.log('Network connection restored');
    };

    const handleOffline = () => {
      setError('You appear to be offline. Please check your internet connection.');
      console.log('Network connection lost');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (step === 'code') {
    return (
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

        <div className="space-y-3">
          <button
            onClick={verifyCode}
            disabled={isLoading || verificationCode.length !== 6}
            className="w-full bg-key-color text-white font-medium py-3 rounded-full hover:bg-pink-700 transition-colors disabled:opacity-75 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading && <Loader2 className="animate-spin" size={20} />}
            {isLoading ? 'Verifying...' : 'Verify Code'}
          </button>

          {showNetworkErrorOverride && (
            <button
              onClick={handleNetworkErrorOverride}
              disabled={isLoading}
              className="w-full bg-green-500 text-white font-medium py-3 rounded-full hover:bg-green-600 transition-colors disabled:opacity-75 disabled:cursor-not-allowed"
            >
              Continue Anyway (I entered the correct code)
            </button>
          )}

          <button
            onClick={handleBackToPhone}
            disabled={isLoading}
            className="w-full bg-gray-200 text-gray-700 font-medium py-3 rounded-full hover:bg-gray-300 transition-colors"
          >
            Back to Phone Number
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <Phone className="mx-auto mb-4 text-key-color" size={48} />
        <h3 className="text-xl font-bold text-gray-900 mb-2">
          Verify Your Phone Number
        </h3>
        <p className="text-gray-600 mb-2">
          {/* 10. Escaped the apostrophe */}
          We&apos;ll send you a verification code to confirm your number
        </p>
        <p className="text-sm text-gray-500">
          🔒 This step is required to complete your registration
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600 text-sm">{error}</p>
          {error.includes('reCAPTCHA') && (
            <button
              onClick={handleRefreshRecaptcha}
              className="mt-2 text-blue-600 text-sm hover:underline flex items-center gap-1"
            >
              <RefreshCw size={14} />
              Refresh reCAPTCHA
            </button>
          )}
        </div>
      )}

      <div>
        <label htmlFor="phone" className="block text-gray-900 font-medium mb-2">
          Phone Number
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
          <p>Enter with country code: +1 for US, +82 for Korea, +44 for UK, etc.</p>
          <p className="text-blue-600">For testing, try: +1 650 555 3434 (test number)</p>
        </div>
      </div>

      {/* reCAPTCHA container */}
      <div className="flex justify-center">
        <div id="recaptcha-container"></div>
        {!recaptchaInitialized && !error && (
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <Loader2 className="animate-spin" size={16} />
            Loading reCAPTCHA...
          </div>
        )}
      </div>

      <div className="space-y-3">
        <button
          onClick={sendVerificationCode}
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

        {onSkip && (
          <button
            onClick={handleSkip}
            className="w-full bg-gray-200 text-gray-700 font-medium py-3 rounded-full hover:bg-gray-300 transition-colors"
          >
            Skip for Now
          </button>
        )}
      </div>
    </div>
  );
}