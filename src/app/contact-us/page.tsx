'use client';

import { Loader2 } from 'lucide-react';
import { useState } from 'react';

export default function ContactPage() {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        subject: '',
        message: ''
    });
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const response = await fetch('https://formspree.io/f/xvgrkeae', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ...formData,
                    _replyto: formData.email, // This sets the reply-to address
                    _subject: `New feedback: ${formData.subject}` // Custom subject
                }),
            });

            if (response.ok) {
                alert('Thank you for your feedback!');
                setFormData({ name: '', email: '', subject: '', message: '' });
            }
        } catch (error) {
            alert('Sorry, there was an error sending your message.');
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
                <h1 className="text-4xl font-bold text-center mb-8">Contact Us</h1>

                <p className="text-center text-[#E4287C] font-medium mb-12">
                    We value your feedback! <br />
                    Please let us know your thoughts, suggestions, or any issues you encounter
                </p>

                <form onSubmit={handleSubmit} className="space-y-8" action="https://formspree.io/f/xvgrkeae" method="POST">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <label htmlFor="name" className="block text-gray-900 font-medium mb-2">
                                Name (Optional)
                            </label>
                            <input
                                type="text"
                                id="name"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                placeholder="Your Name"
                                className="w-full px-4 py-3 border-2 border-[#E4287C] rounded-full focus:outline-none focus:border-pink-700"
                            />
                        </div>

                        <div>
                            <label htmlFor="email" className="block text-gray-900 font-medium mb-2">
                                Email
                            </label>
                            <input
                                type="email"
                                id="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                placeholder="email@example.com"
                                required
                                className="w-full px-4 py-3 border-2 border-[#E4287C] rounded-full focus:outline-none focus:border-pink-700"
                            />
                        </div>
                    </div>

                    <div>
                        <label htmlFor="subject" className="block text-gray-900 font-medium mb-2">
                            Subject
                        </label>
                        <select
                            id="subject"
                            name="subject"
                            value={formData.subject}
                            onChange={handleChange}
                            required
                            className="w-full px-4 py-3 border-2 border-[#E4287C] rounded-full appearance-none focus:outline-none focus:border-pink-700 cursor-pointer"
                            style={{
                                backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2716%27 height=%2716%27 viewBox=%270 0 16 16%27%3E%3Cpath fill=%27%23E4287C%27 d=%27M4.427 6.427l3.573 3.573 3.573-3.573L12.5 7.36l-4.5 4.5-4.5-4.5z%27/%3E%3C/svg%3E")',
                                backgroundRepeat: 'no-repeat',
                                backgroundPosition: 'right 16px center',
                            }}
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
                        <label htmlFor="message" className="block text-gray-900 font-medium mb-2">
                            Message
                        </label>
                        <textarea
                            id="message"
                            name="message"
                            value={formData.message}
                            onChange={handleChange}
                            placeholder="Tell us more..."
                            required
                            rows={6}
                            className="w-full px-4 py-3 border-2 border-[#E4287C] rounded-3xl focus:outline-none focus:border-pink-700 resize-none"
                        />
                    </div>

                    <div className="text-center">
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="bg-[#E4287C] text-white font-medium px-8 py-3 rounded-full hover:bg-pink-700 transition-colors disabled:opacity-75 disabled:cursor-not-allowed flex items-center justify-center gap-2 mx-auto"
                        >
                            {isLoading && (
                                <Loader2 className="animate-spin text-white" size={24} />
                            )}
                            {isLoading ? 'Sending...' : 'Send Feedback'}
                        </button>
                    </div>
                </form>
            </main>
        </div>
    );
}
