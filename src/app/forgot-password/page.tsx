// src/app/forgot-password/page.tsx
import { Metadata } from 'next';
import ForgotPasswordForm from './forgot-password-form';

export const metadata: Metadata = {
  title: 'Reset Password - EHCO',
  description: 'Securely reset your EHCO account password to regain access to your personalized K-Pop dashboard. Follow our simple password recovery process to restore account access and continue enjoying exclusive Korean entertainment content and features.',
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}