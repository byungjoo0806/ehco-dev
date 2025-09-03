// src/app/forgot-password/page.tsx
import { Metadata } from 'next';
import ForgotPasswordForm from './forgot-password-form';

export const metadata: Metadata = {
  title: 'Reset Password - EHCO',
  description: 'Reset your EHCO account password.',
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}