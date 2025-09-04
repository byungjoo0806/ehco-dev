// src/app/login/login-form.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useLoading } from '@/context/LoadingContext'; // 1. Import useLoading

export default function LoginForm() {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [rememberMe, setRememberMe] = useState(false);
  const [stayLoggedIn, setStayLoggedIn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const { signIn, signInWithGoogle } = useAuth();
  const { showLoading } = useLoading(); // 2. Get the showLoading function from the context
  const router = useRouter();

  // Check for signup success message
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('signup') === 'success') {
      setSuccessMessage('Account created successfully! Please sign in with your credentials.');
    }
  }, []);

  // Load remembered email on component mount
  useEffect(() => {
    const rememberedEmail = localStorage.getItem('rememberedEmail');
    if (rememberedEmail) {
      setFormData(prev => ({ ...prev, email: rememberedEmail }));
      setRememberMe(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await signIn(formData.email, formData.password);

      // Handle remember me functionality
      if (rememberMe) {
        localStorage.setItem('rememberedEmail', formData.email);
      } else {
        localStorage.removeItem('rememberedEmail');
      }

      // Handle stay logged in (you can implement session persistence here)
      if (stayLoggedIn) {
        // Set longer session duration or persistent storage
        localStorage.setItem('stayLoggedIn', 'true');
      }

      const redirectPath = sessionStorage.getItem('redirectPath');
      sessionStorage.removeItem('redirectPath'); // Clean up after use
      router.push(redirectPath || '/'); // Redirect to saved path or homepage
    } catch (err) { // 1. Corrected 'error: any'
      if (err instanceof Error) {
        setError(err.message || 'Failed to sign in');
      } else {
        setError('An unexpected error occurred.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError('');

    try {
      await signInWithGoogle();

      const redirectPath = sessionStorage.getItem('redirectPath');
      sessionStorage.removeItem('redirectPath'); // Clean up after use
      router.push(redirectPath || '/'); // Redirect to saved path or homepage
    } catch (err) { // 2. Corrected 'error: any'
      if (err instanceof Error) {
        setError(err.message || 'Failed to sign in with Google');
      } else {
        setError('An unexpected error occurred.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  // 3. Create a handler to show loading before navigation
  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, path: string) => {
    e.preventDefault(); // Prevent the link from navigating immediately
    showLoading('Loading page...'); // Show the global loading overlay
    router.push(path); // Programmatically navigate
  };


  return (
    <div className="min-h-screen bg-white">
      <main className="max-w-md mx-auto px-4 py-16">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-key-color mb-4">Welcome Back</h1>
          <p className="text-gray-600">Sign in to your EHCO account</p>
        </div>

        {successMessage && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-600 text-sm">{successMessage}</p>
          </div>
        )}

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
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="your@email.com"
              required
              className="w-full px-4 py-3 border-2 border-key-color rounded-full focus:outline-none focus:border-pink-700 transition-colors"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-gray-900 font-medium mb-2">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Enter your password"
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
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="rememberMe"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 text-key-color border-2 border-gray-300 rounded focus:ring-key-color"
              />
              <label htmlFor="rememberMe" className="text-sm text-gray-700">
                Remember my email address
              </label>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="stayLoggedIn"
                checked={stayLoggedIn}
                onChange={(e) => setStayLoggedIn(e.target.checked)}
                className="w-4 h-4 text-key-color border-2 border-gray-300 rounded focus:ring-key-color"
              />
              <label htmlFor="stayLoggedIn" className="text-sm text-gray-700">
                Keep me signed in for 30 days
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-key-color text-white font-medium py-3 rounded-full hover:bg-pink-700 transition-colors disabled:opacity-75 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading && <Loader2 className="animate-spin" size={20} />}
            {isLoading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <div className="my-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Or</span>
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
          {/* 3. Corrected unescaped entity */}
          Don&apos;t have an account?{' '}
          {/* 4. Update the Sign Up link */}
          <Link
            href="/signup"
            onClick={(e) => handleLinkClick(e, '/signup')}
            className="text-key-color font-medium hover:underline"
          >
            Sign up here
          </Link>
        </div>

        <div className="mt-4 text-center text-sm text-gray-600">
          {/* 4. Update the Forgot Password link */}
          <Link
            href="/forgot-password"
            onClick={(e) => handleLinkClick(e, '/forgot-password')}
            className="text-key-color hover:underline"
          >
            Forgot your password?
          </Link >
        </div>
      </main>
    </div>
  );
}