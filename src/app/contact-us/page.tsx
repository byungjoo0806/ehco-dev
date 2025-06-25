// app/contact-us/page.tsx

// NO "use client" here! This is now a Server Component.

import { Metadata } from 'next';
import ContactForm from './contact-form'; // We will create this component next

// This metadata export is now valid because 'use client' is gone.
export const metadata: Metadata = {
    title: 'Contact Us',
    description: "Have questions, feedback, or a correction? Get in touch with the EHCO team. We're here to help with inquiries about our K-entertainment facts and timelines.",
};

// The default export simply renders the client component that contains the form.
export default function ContactPage() {
    return <ContactForm />;
}
