// src/app/signup/page.tsx
import { Metadata } from 'next';
import EnhancedSignupForm from './enhanced-signup-form';

export const metadata: Metadata = {
  title: 'Sign Up - EHCO',
  description: 'Create your EHCO account to get personalized K-Entertainment content and timelines.',
};

export default function SignupPage() {
  return <EnhancedSignupForm />;
}