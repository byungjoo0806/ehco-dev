
import Link from 'next/link';
import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'About Us',
    description: "Discover EHCO's mission to provide verified, real-time facts and timelines for Korean celebrities. Learn more about your trusted source for K-entertainment news.",
};

export default function AboutPage() {
    return (
        <div className="min-h-screen bg-white">
            <main className="max-w-4xl mx-auto px-4 py-16">
                <h1 className="text-4xl font-bold text-center mb-12 text-key-color">About Us</h1>

                {/* Mission Section */}
                <section className="mb-16">
                    <h2 className="text-2xl font-bold text-key-color mb-6">
                        Our Mission: Clarity in Context
                    </h2>
                    <p className="text-gray-700 mb-6">
                        In today&apos;s fast-paced digital world, understanding the full story of public figures can be challenging.
                        Information is often fragmented across countless sources, making it difficult to find reliable, neutral
                        and up to date context
                    </p>
                    <p className="text-gray-700">
                        EHCO was founded to solve this. Our mission is to provide accessible, transparent, and neutral
                        information, organized into comprehensive journeys that offer clear context. We believe everyone
                        deserves a straightforward way to understand the narratives shaping public perception.
                    </p>
                </section>

                {/* Solution Section */}
                <section className="mb-16">
                    <h2 className="text-2xl font-bold text-key-color mb-6">
                        Our Solution: Comprehensive Clarity
                    </h2>
                    <ul className="list-disc pl-6 space-y-3 text-gray-700">
                        <li>
                            <strong>Credible Sources</strong>: Information starts from established, trusted sources.
                        </li>
                        <li>
                            <strong>Structured Journeys</strong>: Organizing data chronologically into comprehensive event histories
                        </li>
                        <li>
                            <strong>Source Link</strong>: Every event links directly to its original source for transparency.
                        </li>
                        <li>
                            <strong>Accuracy Focus</strong>: Automation is paired with human review to ensure relevance and factual
                            grounding.
                        </li>
                    </ul>
                </section>

                {/* FAQ Section */}
                <section className="mb-16">
                    <h2 className="text-2xl font-bold text-key-color mb-8">
                        Frequently Asked Questions
                    </h2>

                    <div className="mb-8">
                        <h3 className="font-bold text-gray-900 mb-2">
                            Q: How is the information kept accurate?
                        </h3>
                        <p className="text-gray-700">
                            A: We prioritize sourcing from reputable outlets and use a combination of automated processes and
                            human review to maintain accuracy and neutrality. While we strive for precision, the dynamic nature of
                            information means context is always evolving. We encourage users to consult the original sources
                            linked for full details.
                        </p>
                    </div>

                    <div className="mb-8">
                        <h3 className="font-bold text-gray-900 mb-2">
                            Q: Can I contribute or suggest corrections?
                        </h3>
                        <p className="text-gray-700">
                            A: We value community input. If you spot something that needs updating or have suggestions, please
                            use our <Link href="/contact-us" className="text-key-color underline">Contact Us</Link> page. We review feedback regularly.
                        </p>
                    </div>
                </section>

                {/* Contact Section */}
                <section className="mb-16">
                    <h2 className="text-2xl font-bold text-key-color mb-4">
                        Contact Us
                    </h2>
                    <p className="text-gray-700">
                        Feedback? <Link href="/contact-us" className="text-key-color underline">Contact us here</Link>.
                    </p>
                </section>
            </main>
        </div>
    );
}
