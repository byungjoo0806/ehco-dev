// app/privacy-policy/page.tsx

import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Privacy Policy",
    description: 'Review the EHCO Privacy Policy to understand how we collect, use, and protect your personal data. Your privacy and trust are important to us.',
};

export default function PrivacyPolicy() {
    return (
        <div className="min-h-screen bg-white">
            <div className="max-w-3xl mx-auto px-4 py-8 text-black">
                <h1 className="text-3xl font-bold text-center mb-8 text-key-color">Privacy Policy</h1>

                <p className="text-gray-600 mb-8">Last Updated: May 4, 2025</p>

                <div className="prose max-w-none">
                    <p className="mb-6">
                        Welcome to EHCO (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;). We are committed to protecting your privacy. This Privacy Policy explains how
                        we collect, use, and disclose information when you use our website and services (the &ldquo;Service&rdquo;).
                    </p>

                    <h2 className="text-xl font-bold text-key-color mt-8 mb-4">1. Information We Collect</h2>
                    <p className="mb-4">
                        We collect minimal information to operate our Service effectively. The types of information we collect depend on how
                        you interact with us:
                    </p>
                    <ul className="list-disc ml-6 mb-6">
                        <li><span className="font-bold">Newsletter Subscription:</span>
                            If you choose to subscribe to our newsletter, we collect your email address solely for the purpose of
                            sending you updates and news related to EHCO.
                        </li>
                        <li><span className="font-bold">Contacting Us:</span> If you contact us directly (e.g., via email or a contact form),
                            we may collect information you provide, such as your name, email address, and the content of your message,
                            in order to respond to your inquiry.
                        </li>
                        <li><span className="font-bold">Website Usage Information:</span> Like most websites,
                            we may automatically collect certain non-personally identifiable information when you visit our Service.
                            This may include your IP address, browser type, operating system, pages viewed, and the dates/times of your visits.
                            This information is typically aggregated or anonymized and used for analytics purposes to understand
                            how our Service is used and to improve its functionality and security.
                        </li>
                        <li><span className="font-bold">Information We Do Not Collect:</span> We do not require registration
                            or account creation to use our Service. Therefore, we do not collect personal information typically associated with user accounts,
                            such as passwords or detailed user profiles.
                        </li>
                    </ul>

                    <h2 className="text-xl font-bold text-key-color mt-8 mb-4">2. How We Use Your Information</h2>
                    <p className="mb-4">We use the information we collect for the following purposes:</p>
                    <ul className="list-disc ml-6 mb-6">
                        <li>To send you newsletters and other communications if you have subscribed.</li>
                        <li>To respond to your inquiries, feedback, or requests for support.</li>
                        <li>To operate, maintain, and improve our Service, including analyzing usage trends and ensuring security.</li>
                        <li>To comply with legal obligations.</li>
                    </ul>

                    <h2 className="text-xl font-bold text-key-color mt-8 mb-4">3. Cookies and Similar Technologies</h2>
                    <p className="mb-6">
                        We may use cookies (small text files placed on your device) and similar technologies to help operate the Service,
                        enhance your experience, and gather usage data. For example, cookies may help us remember preferences or analyze
                        site performance. You can typically control cookies through your web browser&apos;s settings.
                    </p>

                    <h2 className="text-xl font-bold text-key-color mt-8 mb-4">4. Data Sharing and Disclosure</h2>
                    <p className="mb-4">
                        We do not sell, rent, or trade your personal information (such as your email address) with third parties for their
                        marketing purposes.
                    </p>
                    <p className="mb-4">We may share information in the following limited circumstances:</p>
                    <ul className="list-disc ml-6 mb-6">
                        <li><span className="font-bold">Service Providers:</span> We may share information with third-party vendors
                            and service providers who perform services on our behalf, such as email delivery services for our newsletter or analytics providers.
                            These providers are expected to protect your information and use it only for the purposes we specify.
                        </li>
                        <li><span className="font-bold">Legal Requirements:</span> We may disclose information if required to do so by law
                            or in the good faith belief that such action is necessary to comply with legal processes, protect our rights or property,
                            or ensure the safety of our users or the public.
                        </li>
                    </ul>

                    <h2 className="text-xl font-bold text-key-color mt-8 mb-4">5. Data Security</h2>
                    <p className="mb-6">
                        We implement reasonable administrative, technical, and physical measures to protect the information we collect from
                        unauthorized access, use, or disclosure. However, no internet transmission or electronic storage method is 100%
                        secure, and we cannot guarantee absolute security.
                    </p>

                    <h2 className="text-xl font-bold text-key-color mt-8 mb-4">6. Your Choices and Rights</h2>
                    <ul className="list-disc ml-6 mb-6">
                        <li><span className="font-bold">Newsletter:</span> You can unsubscribe from our newsletter at any time by
                            clicking the &ldquo;unsubscribe&rdquo; link provided in the emails.
                        </li>
                        <li><span className="font-bold">Contact Information:</span> If you have provided us with your email address for the newsletter
                            or through contacting us, you may request to review or delete this information by contacting us at the email address below.
                        </li>
                        <li><span className="font-bold">Cookies:</span> You can manage cookie preferences through your browser settings.</li>
                    </ul>

                    <h2 className="text-xl font-bold text-key-color mt-8 mb-4">7. Changes to This Privacy Policy</h2>
                    <p className="mb-6">
                        We may update this Privacy Policy from time to time. When we do, we will post the updated policy on this page and
                        revise the &ldquo;Last Updated&rdquo; date at the top. We encourage you to review this policy periodically.
                    </p>

                    <h2 className="text-xl font-bold text-key-color mt-8 mb-4">8. Contact Us</h2>
                    <p className="mb-2">If you have any questions or concerns about this Privacy Policy or our privacy practices, please contact us at:</p>
                    <p className="mb-6">Email: <span className="underline">info@ehco.com</span>
                    </p>

                    <p className="text-center text-gray-500 mt-12">© 2025 EHCO. All rights reserved.</p>
                </div>
            </div>
        </div>
    );
}