// src/app/login/page.tsx
import { Metadata } from 'next';
import LoginForm from './login-form';

export const metadata: Metadata = {
  title: 'Login - EHCO',
  description: 'Sign in to your EHCO account to unlock personalized K-Pop experiences, save favorite artists, access exclusive content, and connect with the Korean entertainment community. Secure login for premium features, personalized recommendations, and member-only content.',
};

export default function LoginPage() {
  return <LoginForm />;
}