// app/contact-us/contact-form.tsx

// We MUST mark this component as a Client Component.
'use client';

import { useState } from 'react';
import { Loader2, CheckCircle, X } from 'lucide-react';

// Success Modal Component
function SuccessModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    if (!isOpen) return null;

    const handleOverlayClick = (e: React.MouseEvent) => {
        // Only close if clicking on the overlay itself, not the modal content
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={handleOverlayClick}>
            <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 relative animate-in fade-in zoom-in duration-200">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
                >
                    <X size={24} />
                </button>

                <div className="text-center">
                    <div className="mx-auto flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                        <CheckCircle className="w-8 h-8 text-green-600" />
                    </div>

                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                        Thank You!
                    </h3>

                    <p className="text-gray-600 mb-6">
                        Your feedback has been sent successfully! You should receive a confirmation email shortly.
                    </p>

                    <button
                        onClick={onClose}
                        className="bg-key-color text-white font-medium px-6 py-2 rounded-full hover:bg-pink-700 transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}

// Error Modal Component
function ErrorModal({
    isOpen,
    onClose,
    errorMessage
}: {
    isOpen: boolean;
    onClose: () => void;
    errorMessage: string;
}) {
    if (!isOpen) return null;

    const handleOverlayClick = (e: React.MouseEvent) => {
        // Only close if clicking on the overlay itself, not the modal content
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={handleOverlayClick}>
            <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 relative animate-in fade-in zoom-in duration-200">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
                >
                    <X size={24} />
                </button>

                <div className="text-center">
                    <div className="mx-auto flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
                        <X className="w-8 h-8 text-red-600" />
                    </div>

                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                        Oops!
                    </h3>

                    <p className="text-gray-600 mb-6">
                        {errorMessage}
                    </p>

                    <button
                        onClick={onClose}
                        className="bg-gray-600 text-white font-medium px-6 py-2 rounded-full hover:bg-gray-700 transition-colors"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        </div>
    );
}

// Main Contact Form Component
export default function ContactForm() {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        subject: '',
        message: ''
    });
    const [isLoading, setIsLoading] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [showErrorModal, setShowErrorModal] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const response = await fetch('/api/contact', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            });

            const result = await response.json();

            if (response.ok) {
                setFormData({ name: '', email: '', subject: '', message: '' });
                setShowSuccessModal(true);
            } else {
                setErrorMessage(result.error || 'Sorry, there was an error sending your message.');
                setShowErrorModal(true);
            }
        } catch (error) {
            console.error('Form submission error:', error);
            setErrorMessage('Sorry, there was an error sending your message.');
            setShowErrorModal(true);
        } finally {
            setIsLoading(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    return (
        <div className="min-h-screen bg-white">
            <main className="max-w-3xl mx-auto px-4 py-16">
                <h1 className="text-4xl font-bold text-center text-key-color mb-8">Contact Us</h1>

                <p className="text-center text-key-color font-medium mb-12">
                    We value your feedback! <br />
                    Please let us know your thoughts, suggestions, or any issues you encounter
                </p>

                <form onSubmit={handleSubmit} className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <label htmlFor="name" className="block text-gray-900 font-medium mb-2">Name (Optional)</label>
                            <input
                                type="text"
                                id="name"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                placeholder="Your Name"
                                className="w-full px-4 py-3 border-2 border-key-color rounded-full focus:outline-none focus:border-pink-700"
                            />
                        </div>
                        <div>
                            <label htmlFor="email" className="block text-gray-900 font-medium mb-2">Email</label>
                            <input
                                type="email"
                                id="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                placeholder="email@example.com"
                                required
                                className="w-full px-4 py-3 border-2 border-key-color rounded-full focus:outline-none focus:border-pink-700"
                            />
                        </div>
                    </div>
                    <div>
                        <label htmlFor="subject" className="block text-gray-900 font-medium mb-2">Subject</label>
                        <select
                            id="subject"
                            name="subject"
                            value={formData.subject}
                            onChange={handleChange}
                            required
                            className="w-full px-4 py-3 border-2 border-key-color rounded-full appearance-none focus:outline-none focus:border-pink-700 cursor-pointer select-arrow-light text-gray-900"
                        >
                            <option value="">Select a topic</option>
                            <option value="General Feedback">General Feedback</option>
                            <option value="Feature Request">Feature Request</option>
                            <option value="Bug Report">Bug Report</option>
                            <option value="Wrong Information">Wrong Information</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>
                    <div>
                        <label htmlFor="message" className="block text-gray-900 font-medium mb-2">Message</label>
                        <textarea
                            id="message"
                            name="message"
                            value={formData.message}
                            onChange={handleChange}
                            placeholder="Tell us more..."
                            required
                            rows={6}
                            className="w-full px-4 py-3 border-2 border-key-color rounded-3xl focus:outline-none focus:border-pink-700 resize-none"
                        />
                    </div>
                    <div className="text-center">
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="bg-key-color text-white font-medium px-8 py-3 rounded-full hover:bg-pink-700 transition-colors disabled:opacity-75 disabled:cursor-not-allowed flex items-center justify-center gap-2 mx-auto"
                        >
                            {isLoading && <Loader2 className="animate-spin text-white" size={24} />}
                            {isLoading ? 'Sending...' : 'Send Feedback'}
                        </button>
                    </div>
                </form>
            </main>

            {/* Custom Modals */}
            <SuccessModal
                isOpen={showSuccessModal}
                onClose={() => setShowSuccessModal(false)}
            />
            <ErrorModal
                isOpen={showErrorModal}
                onClose={() => setShowErrorModal(false)}
                errorMessage={errorMessage}
            />
        </div>
    );
}