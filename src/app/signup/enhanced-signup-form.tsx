// src/app/signup/enhanced-signup-form.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Eye, EyeOff, Check, X, Upload, User, Star, Mail, CheckCircle2, XCircle, Search } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { createUserProfile } from '@/lib/user-service';
import { getTopFigures, PublicFigure } from '@/lib/figures-service';
// --- UPDATED: Simplified imports for email verification flow ---
import { signOut, updateProfile, sendEmailVerification, fetchSignInMethodsForEmail, AuthError } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, storage } from '@/lib/firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';

interface PasswordRequirement {
  label: string;
  test: (password: string) => boolean;
}

const passwordRequirements: PasswordRequirement[] = [
  { label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { label: 'Contains uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { label: 'Contains lowercase letter', test: (p) => /[a-z]/.test(p) },
  { label: 'Contains number', test: (p) => /\d/.test(p) },
];

// --- UPDATED: Simplified steps ---
type SignupStep = 'details' | 'creating' | 'complete';
type AvailabilityStatus = 'idle' | 'loading' | 'available' | 'taken' | 'error';

interface SignupData {
  email: string;
  password: string;
  confirmPassword: string;
  nickname: string;
  favoriteFigure: string;
  phoneNumber: string; // Kept as an optional data field
  privacyPolicyAccepted: boolean;
}

export default function EnhancedSignupForm() {
  // Main state
  const [step, setStep] = useState<SignupStep>('details');
  const [formData, setFormData] = useState<SignupData>({
    email: '',
    password: '',
    confirmPassword: '',
    nickname: '',
    favoriteFigure: '',
    phoneNumber: '',
    privacyPolicyAccepted: false
  });

  // UI state
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [profileImagePreview, setProfileImagePreview] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [popularFigures, setPopularFigures] = useState<PublicFigure[]>([]);
  const [figuresLoading, setFiguresLoading] = useState(true);

  const [emailAvailability, setEmailAvailability] = useState<AvailabilityStatus>('idle');
  const [nicknameAvailability, setNicknameAvailability] = useState<AvailabilityStatus>('idle');
  const [nicknameMessage, setNicknameMessage] = useState('');
  const [emailMessage, setEmailMessage] = useState('');

  const { signUp, signInWithGoogle } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Scroll to the top of the page when the step changes to 'creating' or 'complete'
    if (step === 'creating' || step === 'complete') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [step]);

  // Load popular figures on component mount
  useEffect(() => {
    const loadFigures = async () => {
      try {
        const figures = await getTopFigures(15);
        setPopularFigures(figures);
      } catch (error) {
        console.error('Failed to load figures:', error);
      } finally {
        setFiguresLoading(false);
      }
    };
    loadFigures();
  }, []);

  // 1. Made debounce function type-safe with generics
  const debounce = <A extends unknown[]>(
    func: (...args: A) => unknown,
    delay: number
  ) => {
    let timeout: NodeJS.Timeout;
    return (...args: A): void => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), delay);
    };
  };

  const checkAvailability = async (type: 'email' | 'nickname', value: string) => {
    if (!value) return;

    if (type === 'email') setEmailAvailability('loading');
    if (type === 'nickname') setNicknameAvailability('loading');

    try {
      const functions = getFunctions();
      const checkAvailabilityFn = httpsCallable(functions, 'checkAvailability');
      const result = await checkAvailabilityFn({ type, value });

      const data = result.data as { available: boolean, message: string };

      if (type === 'email') {
        setEmailAvailability(data.available ? 'available' : 'taken');
        setEmailMessage(data.message); // Use setEmailMessage
      }
      if (type === 'nickname') {
        setNicknameAvailability(data.available ? 'available' : 'taken');
        setNicknameMessage(data.message); // Use setNicknameMessage
      }

    } catch (error) {
      console.error(`Error checking ${type} availability:`, error);
      if (type === 'email') {
        setEmailAvailability('error');
        setEmailMessage(`Could not check email.`); // Use setEmailMessage
      }
      if (type === 'nickname') {
        setNicknameAvailability('error');
        setNicknameMessage(`Could not check nickname.`); // Use setNicknameMessage
      }
    }
  };

  // Form validation (remains the same)
  const validateDetailsForm = () => {
    if (!formData.email || !formData.password || !formData.confirmPassword || !formData.nickname) {
      setError('Please fill in all required fields');
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    const allRequirementsMet = passwordRequirements.every(req => req.test(formData.password));
    if (!allRequirementsMet) {
      setError('Password does not meet all requirements');
      return false;
    }
    if (!formData.privacyPolicyAccepted) {
      setError('You must accept the Privacy Policy to continue');
      return false;
    }
    return true;
  };

  // --- NEW: Combined handler for creating account and sending verification email ---
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateDetailsForm()) {
      return;
    }

    setStep('creating');
    setIsLoading(true);

    try {
      // Step 1: Create the user with email and password
      await signUp(formData.email, formData.password, formData.nickname);

      const createdUser = auth.currentUser;
      if (!createdUser) {
        throw new Error('Failed to retrieve created user account.');
      }

      // Step 2: Send the verification email
      await sendEmailVerification(createdUser);
      console.log('✅ Verification email sent.');

      // Step 3: Upload profile image if provided
      let profilePictureUrl = '';
      if (profileImage) {
        const imageRef = ref(storage, `profile-pictures/${createdUser.uid}/${profileImage.name}`);
        const snapshot = await uploadBytes(imageRef, profileImage);
        profilePictureUrl = await getDownloadURL(snapshot.ref);
      }

      await updateProfile(createdUser, {
        displayName: formData.nickname,
        photoURL: profilePictureUrl || undefined, // Use undefined if no image
      });

      // Step 4: Create user profile in Firestore
      await createUserProfile(createdUser, {
        nickname: formData.nickname,
        favoriteFigure: formData.favoriteFigure,
        phoneNumber: formData.phoneNumber,
        phoneVerified: false,
        emailVerified: false, // User needs to click link to make this true
        profilePicture: profilePictureUrl,
      });

      // Step 5: Sign out to force the user to log in after verifying
      await signOut(auth);
      setStep('complete');

      setTimeout(() => {
        router.push('/login?signup=success');
      }, 3000);

    } catch (err) { // 2. Corrected 'error: any' with a type guard
      console.error('❌ Account creation error:', err);
      if (err instanceof Error) {
        setError(err.message || 'Failed to create account. Please try again.');
      } else {
        setError('An unknown error occurred. Please try again.');
      }
      setStep('details'); // Go back to the details form on error
    } finally {
      setIsLoading(false);
    }
  };

  // Google Sign-in handler
  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError('');
    try {
      await signInWithGoogle();
      router.push('/');
    } catch (err) { // 3. Corrected 'error: any' with a type guard for Firebase Auth errors
      // --- THIS IS THE CRITICAL LOGIC ---
      if (err instanceof Error && 'code' in err && 'customData' in err) {
        const authError = err as AuthError & { customData?: { email?: string } };
        if (authError.code === 'auth/account-exists-with-different-credential') {
          const email = authError.customData?.email;
          if (email) {
            const methods = await fetchSignInMethodsForEmail(auth, email);
            if (methods.includes('password')) {
              setError('This email is already registered. Please sign in with your password instead.');
            } else {
              setError(`This email is already registered with another provider (${methods.join(', ')}). Please sign in using that method.`);
            }
          } else {
            setError('This account already exists with a different sign-in method.');
          }
        } else {
          setError(authError.message || 'Failed to sign up with Google');
        }
      } else if (err instanceof Error) {
        setError(err.message || 'Failed to sign up with Google');
      } else {
        setError('An unknown error occurred with Google Sign-In.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const debouncedCheckNickname = debounce(checkAvailability, 500);
  const debouncedCheckEmail = debounce(checkAvailability, 500);

  // Form field handlers (remain the same)
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;

    // Reset availability status on change
    if (name === 'nickname') {
      setNicknameAvailability('idle');
      setNicknameMessage('');
    }
    if (name === 'email') {
      setEmailAvailability('idle');
      setEmailMessage('');
    }

    if (type === 'checkbox') {
      setFormData({ ...formData, [name]: (e.target as HTMLInputElement).checked });
    } else {
      setFormData({ ...formData, [name]: value });

      if (name === 'nickname') {
        debouncedCheckNickname('nickname', value);
      }
      if (name === 'email') {
        // Simple regex to check for a basic email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (emailRegex.test(value)) {
          debouncedCheckEmail('email', value);
        }
      }
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Profile picture must be less than 5MB');
        return;
      }
      if (!file.type.startsWith('image/')) {
        setError('Please select a valid image file');
        return;
      }
      setProfileImage(file);
      setError('');
      const reader = new FileReader();
      reader.onload = (e) => { setProfileImagePreview(e.target?.result as string); };
      reader.readAsDataURL(file);
    }
  };

  const renderFeedbackIcon = (status: AvailabilityStatus) => {
    switch (status) {
      case 'loading':
        return <Loader2 size={20} className="animate-spin text-gray-400" />;
      case 'available':
        return <CheckCircle2 size={20} className="text-green-500" />;
      case 'taken':
      case 'error':
        return <XCircle size={20} className="text-red-500" />;
      default:
        return null;
    }
  };

  // Render different steps
  if (step === 'complete') {
    return (
      // --- UPDATED: 'complete' step UI and text ---
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="max-w-md mx-auto px-4 text-center">
          <div className="mb-6">
            <Check className="mx-auto text-green-500" size={64} />
          </div>
          <h1 className="text-3xl font-bold text-key-color mb-4">Account Created!</h1>
          <p className="text-gray-600 mb-6">
            {/* 4. Corrected unescaped entity */}
            One last step! We&apos;ve sent a verification link to <strong>{formData.email}</strong>.
            Please check your inbox to complete your registration.
          </p>
          <div className="mb-4">
            <p className="text-sm text-gray-500">Redirecting to login page...</p>
            <div className="animate-pulse mt-2">
              <Loader2 className="mx-auto text-key-color animate-spin" size={24} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'creating') {
    return (
      // --- UPDATED: 'creating' step UI and text ---
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="max-w-md mx-auto px-4 text-center">
          <div className="mb-6">
            <Loader2 className="mx-auto text-key-color animate-spin" size={64} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Creating Your Account</h1>
          <p className="text-gray-600">
            Please wait while we set up your EHCO account and send a verification email...
          </p>
        </div>
      </div>
    );
  }

  // --- REMOVED: The JSX for 'phone-code' and 'phone-verify' steps is gone ---

  // Details step
  return (
    <div className="min-h-screen bg-white">
      <main className="max-w-md mx-auto px-4 py-16">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-key-color mb-4">Join EHCO</h1>
          <p className="text-gray-600">Create your account to get started</p>
          {/* --- UPDATED: Info box text --- */}
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-700 flex items-center justify-center gap-2">
              <Mail size={16} /> <strong>Required:</strong> An email verification link will be sent to complete registration.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {/* --- UPDATED: form's onSubmit now calls the new handler --- */}
        <form onSubmit={handleCreateAccount} className="space-y-6">

          {/* ... All your form fields (Profile Pic, Nickname, Email, etc.) remain the same ... */}
          {/* Profile Picture Upload */}
          <div className="text-center">
            <div className="relative inline-block">
              {profileImagePreview ? (
                <img
                  src={profileImagePreview}
                  alt="Profile preview"
                  className="w-24 h-24 rounded-full object-cover border-4 border-key-color"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-gray-200 border-4 border-key-color flex items-center justify-center">
                  <User className="text-gray-400" size={32} />
                </div>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 bg-key-color text-white rounded-full p-2 hover:bg-pink-700 transition-colors"
              >
                <Upload size={16} />
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
            <p className="text-xs text-gray-500 mt-2">Optional • Max 5MB</p>
          </div>

          {/* Nickname */}
          <div>
            <label htmlFor="nickname" className="block text-gray-900 font-medium mb-2">
              Nickname *
            </label>
            <div className="relative">
              <input
                type="text"
                id="nickname"
                name="nickname"
                value={formData.nickname}
                onChange={handleChange}
                placeholder="How should we call you?"
                required
                className="w-full px-4 py-3 pr-12 border-2 border-key-color rounded-full focus:outline-none focus:border-pink-700 transition-colors"
              />
              <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                {renderFeedbackIcon(nicknameAvailability)}
              </div>
            </div>
            {['available', 'taken', 'error'].includes(nicknameAvailability) && (
              <p className={`mt-2 text-sm ${nicknameAvailability === 'available' ? 'text-green-600' : 'text-red-600'}`}>
                {nicknameMessage}
              </p>
            )}
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-gray-900 font-medium mb-2">
              Email Address *
            </label>
            <div className="relative">
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="your@email.com"
                required
                className="w-full px-4 py-3 pr-12 border-2 border-key-color rounded-full focus:outline-none focus:border-pink-700 transition-colors"
              />
              <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                {renderFeedbackIcon(emailAvailability)}
              </div>
            </div>
            {['available', 'taken', 'error'].includes(emailAvailability) && (
              <p className={`mt-2 text-sm ${emailAvailability === 'available' ? 'text-green-600' : 'text-red-600'}`}>
                {emailMessage}
              </p>
            )}
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="block text-gray-900 font-medium mb-2">
              Password *
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                placeholder="Create a secure password"
                required
                className="w-full px-4 py-3 pr-12 border-2 border-key-color rounded-full focus:outline-none focus:border-pink-700 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

            {(passwordFocused || formData.password) && (
              <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-700 mb-2">Password requirements:</p>
                <div className="space-y-1">
                  {passwordRequirements.map((req, index) => (
                    <div key={index} className="flex items-center gap-2">
                      {req.test(formData.password) ? (
                        <Check size={16} className="text-green-600" />
                      ) : (
                        <X size={16} className="text-gray-400" />
                      )}
                      <span className={`text-sm ${req.test(formData.password) ? 'text-green-600' : 'text-gray-500'}`}>
                        {req.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label htmlFor="confirmPassword" className="block text-gray-900 font-medium mb-2">
              Confirm Password *
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Confirm your password"
                required
                className="w-full px-4 py-3 pr-12 border-2 border-key-color rounded-full focus:outline-none focus:border-pink-700 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {formData.confirmPassword && formData.password !== formData.confirmPassword && (
              <p className="mt-2 text-sm text-red-600">Passwords do not match</p>
            )}
          </div>

          {/* Favorite Figure */}
          {/* <div>
            <label htmlFor="favoriteFigure" className="block text-gray-900 font-medium mb-2">
              <div className="flex items-center gap-2">
                <Star size={18} />
                Favorite K-Figure (Optional)
              </div>
            </label>
            <select
              id="favoriteFigure"
              name="favoriteFigure"
              value={formData.favoriteFigure}
              onChange={handleChange}
              disabled={figuresLoading}
              className="w-full px-4 py-3 border-2 border-key-color rounded-full focus:outline-none focus:border-pink-700 transition-colors appearance-none cursor-pointer disabled:opacity-50"
            >
              <option value="">
                {figuresLoading ? 'Loading figures...' : 'Select your favorite (optional)'}
              </option>
              {popularFigures.map((figure) => (
                <option key={figure.id} value={figure.id}>
                  {figure.name}
                  {figure.name_kr && ` (${figure.name_kr})`}
                </option>
              ))}
            </select>
          </div> */}

          {/* Privacy Policy Consent */}
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="privacyPolicyAccepted"
                name="privacyPolicyAccepted"
                checked={formData.privacyPolicyAccepted}
                onChange={handleChange}
                required
                className="mt-1 w-4 h-4 text-key-color border-2 border-key-color rounded focus:ring-key-color"
              />
              <label htmlFor="privacyPolicyAccepted" className="text-sm text-gray-700">
                I agree to the{' '}
                <Link href="/privacy-policy" className="text-key-color hover:underline" target="_blank">
                  Privacy Policy
                </Link>{' '}
                and{' '}
                <Link href="/terms-of-service" className="text-key-color hover:underline" target="_blank">
                  Terms of Service
                </Link>
                {' '}<span className="text-red-500">*</span>
              </label>
            </div>
          </div>

          {/* --- UPDATED: Submit button text --- */}
          <button
            type="submit"
            disabled={isLoading || !formData.privacyPolicyAccepted}
            className="w-full bg-key-color text-white font-medium py-3 rounded-full hover:bg-pink-700 transition-colors disabled:opacity-75 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading && <Loader2 className="animate-spin" size={20} />}
            {isLoading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <div className="my-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Or continue with</span>
            </div>
          </div>
        </div>

        <button
          onClick={handleGoogleSignIn}
          disabled={isLoading}
          className="w-full bg-white border-2 border-gray-300 text-gray-700 font-medium py-3 rounded-full hover:bg-gray-50 transition-colors disabled:opacity-75 disabled:cursor-not-allowed flex items-center justify-center gap-3"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Continue with Google
        </button>

        <div className="mt-8 text-center text-sm text-gray-600">
          Already have an account?{' '}
          <Link href="/login" className="text-key-color font-medium hover:underline">
            Sign in here
          </Link>
        </div>
      </main>
    </div>
  );
}