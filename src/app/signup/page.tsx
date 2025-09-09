// src/app/signup/page.tsx
import { Metadata } from 'next';
import EnhancedSignupForm from './enhanced-signup-form';

export const metadata: Metadata = {
  title: 'Sign Up - EHCO',
  description: 'Create your EHCO account to stay up-to-date and get personalized K-Pop content and timelines.',
};

export default function SignupPage() {
  return <EnhancedSignupForm />;
}