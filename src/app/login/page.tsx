// src/app/login/page.tsx
import { Metadata } from 'next';
import LoginForm from './login-form';

export const metadata: Metadata = {
  title: 'Login - EHCO',
  description: 'Sign in to your EHCO account to access personalized K-Entertainment content.',
};

export default function LoginPage() {
  return <LoginForm />;
}