// app/terms-of-service/page.tsx

import { Metadata } from "next";

export const metadata: Metadata = {
    title: 'Terms of Service',
    description: 'Read the official Terms of Service for using EHCO. This page outlines the rules and user agreement for accessing our K-entertainment data and services.',
};

export default function TermsOfService() {
    return (
        <div className="min-h-screen bg-white">
            <div className="max-w-3xl mx-auto px-4 py-8 text-black">
                <h1 className="text-3xl font-bold text-center mb-8 text-key-color">Terms of Service</h1>

                <p className="text-gray-600 mb-8">Last Updated: May 4, 2025</p>

                <div className="prose max-w-none">
                    <p className="mb-4">
                        Welcome to EHCO! Our mission is to provide accessible, transparent, and neutral information about public figures,
                        organized into comprehensive journeys that offer clear context.
                        We aggregate, structure, and summarize publicly available information to help you understand how narratives develop over time.
                    </p>
                    <p className="mb-6">
                        By accessing or using the EHCO service (the &ldquo;Service&rdquo;), you agree to be bound by these Terms of Service (&ldquo;ToS&rdquo;)
                        and our accompanying Copyright and Attribution Policy, which is incorporated herein by reference.
                        Please read both documents carefully.
                    </p>


                    <h2 className="text-xl font-bold text-key-color mt-8 mb-4">1. Service Description</h2>
                    <p className="mb-6">
                        EHCO provides structured timelines and summaries derived from publicly available information,
                        primarily reputable news sources. We utilize Artificial Intelligence (AI) technology to assist in the aggregation,
                        categorization, and summarization process. This AI operates under human oversight to prioritize neutrality and accuracy.
                        Our service aims to provide context and track the evolution of information, always linking back to original sources where possible.
                    </p>


                    <h2 className="text-xl font-bold text-key-color mt-8 mb-4">2. Use of the Service</h2>
                    <p className="mb-4"> <span className="font-bold">Permitted Use:</span>
                        You may use the Service for your personal, non-commercial informational purposes. You are permitted to:
                    </p>
                    <ul className="list-disc ml-6 mb-4">
                        <li>View content displayed at this Service.</li>
                        <li>Search for information about specific individuals</li>
                        <li>Note that accessing the service is not a license provided for EHCO, provides you guys proper attribution to EHCO
                            link, where applicable, the original source.</li>
                    </ul>
                    <p className="mb-4"><span className="font-bold">Prohibited Use:</span> You agree not to:</p>
                    <ul className="list-disc ml-6 mb-6">
                        <li>Use the Service for any commercial purpose without obtaining explicit prior written permission from EHCO.</li>
                        <li>Systematically scrape, copy, or reproduce EHCO&apos;s structured timelines, database, or proprietary organization of content.</li>
                        <li>Create derivative works based on EHCO&apos;s unique content structure or presentation.</li>
                        <li>Use the Service in any manner that could damage, disable, overburden, or impair the Service or interfere with
                            any other party&apos;s use of the Service.</li>
                    </ul>


                    <h2 className="text-xl font-bold text-key-color mt-8 mb-4">3. Content and Intellectual Property</h2>
                    <p className="mb-4"><span className="font-bold">Third-Party Content:</span>
                        The Service displays limited excerpts of content from third-party sources (e.g., news articles)
                        under the principles of fair use for purposes such as reporting, commentary, education, and historical documentation.
                        We are committed to providing clear attribution for all sourced content, including the source name, publication date,
                        and a direct link to the original source whenever available.
                    </p>
                    <p className="mb-4"><span className="font-bold">EHCO Content:</span>
                        The unique organization, structure, and presentation of information on the Service are
                        the proprietary intellectual property of EHCO. All rights are reserved.
                    </p>
                    <p className="mb-6"><span className="font-bold">Copyright and Attribution Policy:</span>
                        Your use of the Service is subject to our <span></span>
                        <a
                            href="#ads"
                            className="text-key-color underline cursor-pointer hover:text-pink-600"
                        >
                            Copyright and Attribution Policy
                        </a>
                        , which details our approach to fair use, source attribution, DMCA compliance, and content usage rights.
                        Please review this policy carefully.
                    </p>


                    <h2 className="text-xl font-bold text-key-color mt-8 mb-4">4. Accuracy and Corrections</h2>
                    <p className="mb-4">
                        EHCO strives for accuracy and neutrality in the information presented.
                        However, given the dynamic nature of news and public information, we cannot guarantee the absolute accuracy
                        or completeness of all content at all times. We provide links to original sources for verification.
                    </p>
                    <p className="mb-6">
                        We are committed to correcting factual errors promptly. If you believe any information on the Service is inaccurate,
                        please contact us using the information provided below or via our Contact Us page. Corrections will be made transparently.
                    </p>


                    <h2 className="text-xl font-bold text-key-color mt-8 mb-4">5. Disclaimers</h2>
                    <p className="mb-4">
                        Informational Purposes Only: The content provided on the Service is for general informational purposes only.
                        It does not constitute legal, financial, medical, or any other type of professional advice.
                        You should consult with qualified professionals for advice specific to your circumstances.
                    </p>
                    <p className="mb-4">
                        Limitation of Liability: EHCO is not liable for any decisions made or actions taken based on the information provided
                        through the Service. Your use of the Service and reliance on its content is solely at your own risk.
                    </p>
                    <p className="mb-6">
                        No Endorsement: References to any third-party sources, individuals, products, or services
                        do not constitute an endorsement or affiliation unless explicitly stated.
                    </p>


                    <h2 className="text-xl font-bold text-key-color mt-8 mb-4">6. Individual Rights and Defamation</h2>
                    <p className="mb-6">
                        EHCO is committed to presenting information neutrally and factually, respecting the rights and reputations of individuals,
                        including public figures. We report only on publicly available information from reputable sources
                        and do not create original news or engage in sensationalism. If any individual believes their portrayal on the Service
                        is inaccurate or unfair, they may contact us for a review.
                    </p>


                    <h2 className="text-xl font-bold text-key-color mt-8 mb-4">7. Modifications to Terms</h2>
                    <p className="mb-6">
                        EHCO reserves the right to modify these ToS at any time. We will post the revised ToS on our website,
                        and the changes will be effective immediately upon posting. Your continued use of the Service after any such changes
                        constitutes your acceptance of the new ToS.
                    </p>


                    <h2 id="ads" className="text-xl font-bold text-key-color mt-8 mb-4">8. Contact Information</h2>
                    <p className="mb-6">
                        If you have any questions about these Terms of Service or need to report inaccuracies or copyright concerns,
                        please contact us at: info@ehco.ai
                    </p>

                    <div className="rounded-md w-full h-40">
                        {/* for ads */}
                    </div>

                    <br />
                    <br />
                    <br />

                    <h1 className="text-3xl font-bold text-center mb-8 mt-20">Copyright and Attribution Policy</h1>

                    <p className="text-gray-600 mb-8">Last Updated: May 4, 2025</p>

                    <h2 className="text-xl font-bold text-key-color mt-8 mb-4">1. Introduction</h2>
                    <p className="mb-4">
                        At EHCO, our mission is to provide accurate, verifiable information with transparent sourcing and historical context.
                        We believe that tracking how information evolves over time is essential for fostering truth and accountability.
                        This Copyright and Attribution Policy outlines our approach to content usage, intellectual property, and attribution standards,
                        ensuring clarity for our users, content partners, and rights holders.
                    </p>
                    <p className="mb-6">
                        Our platform is designed to organize and present information in a structured, neutral manner,
                        allowing users to trace how narratives develop over time. By accessing or using our platform,
                        you acknowledge and agree to comply with this policy.
                    </p>


                    <h2 className="text-xl font-bold text-key-color mt-8 mb-4">2. Use of the Service</h2>

                    <h3 className="font-bold text-key-color mt-4 mb-4">2.1 Fair Use Compliance</h3>

                    <p className="mb-4">
                        EHCO operates under the principles of fair use as defined in copyright law,
                        including compliance with the Digital Millennium Copyright Act (DMCA).
                        Our use of third-party content is transformative, focused on:
                    </p>
                    <ul className="list-disc ml-6 mb-4">
                        <li>Recording the historical development of information and structuring insights from reputable news sources</li>
                        <li>Enhancing understanding through structured timelines that track information evolution</li>
                        <li>Facilitating access to original sources by linking back to them</li>
                    </ul>
                    <p className="mb-6">
                        We believe that our approach aligns with established fair use principles,
                        balancing the need for public information dissemination with respect for intellectual property rights.
                        If a copyright holder believes their material has been used improperly, they may submit a DMCA takedown request,
                        and we will review and process it in accordance with applicable regulations.
                    </p>


                    <h3 className="font-bold text-key-color mt-4 mb-4">2.2 Source Attribution</h3>

                    <p className="mb-4">
                        All content presented on EHCO includes:
                    </p>
                    <ul className="list-disc ml-6 mb-4">
                        <li>Original source attribution</li>
                        <li>Publication date</li>
                        <li>Direct links to the original source when available</li>
                    </ul>
                    <p className="mb-6">
                        We do not alter the meaning of sourced content and strive to provide users with direct access to full articles when appropriate.
                    </p>


                    <h2 className="text-xl font-bold text-key-color mt-8 mb-4">3. AI-Generated Content Disclaimer</h2>
                    <p className="mb-4">
                        EHCO utilizes AI technology to assist in the summarization of news articles. Our AI tools:
                    </p>
                    <ul className="list-disc ml-6 mb-6">
                        <li>Do not generate original news but rather organize and structure publicly available information</li>
                        <li>Prioritize neutrality and accuracy, avoiding editorialization or opinion-based reporting</li>
                        <li>Operate under human oversight, with content reviewed for quality and accuracy</li>
                        <li>By disclosing our AI usage, we aim to maintain transparency while leveraging technology to enhance information accessibility.</li>
                    </ul>


                    <h2 className="text-xl font-bold text-key-color mt-8 mb-4">4. Content Usage and Reproduction</h2>

                    <h3 className="font-bold text-key-color mt-4 mb-4">4.1 Third-Party Content</h3>

                    <p className="mb-4">
                        EHCO displays limited excerpts of third-party content for informational purposes related to:
                    </p>
                    <ul className="list-disc ml-6 mb-4">
                        <li>News reporting</li>
                        <li>Commentary and analysis</li>
                        <li>Educational reference</li>
                        <li>Historical documentation</li>
                    </ul>
                    <p className="mb-6">
                        We do not republish full articles, and our methodology is designed to drive traffic to original sources rather than replace them.
                    </p>

                    <h3 className="font-bold text-key-color mt-4 mb-4">4.2 EHCO&apos;s Content Protections</h3>

                    <p className="mb-4">
                        The organization and structuring of content on EHCO are proprietary. Users may:
                    </p>
                    <ul className="list-disc ml-6 mb-4">
                        <li>View content for personal, non-commercial use</li>
                        <li>Share EHCO content via links</li>
                        <li>Quote limited portions with proper attribution</li>
                    </ul>
                    <p className="mb-4">
                        Users may not:
                    </p>
                    <ul className="list-disc ml-6 mb-6">
                        <li>Scrape or reproduce EHCO&apos;s structured timelines and database</li>
                        <li>Use EHCO content for commercial purposes without explicit permission</li>
                        <li>Create derivative works based on EHCO&apos;s unique content organization</li>
                    </ul>


                    <h2 className="text-xl font-bold text-key-color mt-8 mb-4">5. Defamation, Publicity Rights, and Individual Protections</h2>

                    <h3 className="font-bold text-key-color mt-4 mb-4">5.1 Responsible Reporting and Reputation Protection</h3>

                    <p className="mb-4">
                        EHCO is committed to presenting neutral, verifiable information while respecting individuals&apos; rights, including those of public figures. We follow these key principles:
                    </p>
                    <ul className="list-disc ml-6 mb-4">
                        <li>No original news creation – We summarize only from reputable sources</li>
                        <li>No sensationalism – Our AI and editors focus on factual representation</li>
                        <li>No defamatory content – We do not knowingly publish false or misleading information</li>
                    </ul>
                    <p className="mb-6">
                        If any individual believes that EHCO has presented inaccurate or misleading information, they may contact us for review, and we will take corrective action as necessary.
                    </p>

                    <h3 className="font-bold text-key-color mt-4 mb-4">5.2 Public Figures and Right of Publicity</h3>

                    <p className="mb-4">
                        Public figures, including celebrities and high-profile individuals, are frequently covered in media. EHCO:
                    </p>
                    <ul className="list-disc ml-6 mb-4">
                        <li>Reports on publicly available information relevant to newsworthy events</li>
                        <li>Does not imply endorsement or commercial affiliation unless explicitly stated</li>
                        <li>Uses images and names only in journalistic and factual contexts</li>
                    </ul>
                    <p className="mb-6">
                        We acknowledge that public figures have legitimate concerns over their portrayal in the media.
                        If an individual or their representative has a concern regarding their depiction on EHCO,
                        they may submit a formal request, which we will review in accordance with applicable standards.
                    </p>


                    <h2 className="text-xl font-bold text-key-color mt-8 mb-4">6. DMCA Compliance and Takedown Requests</h2>

                    <h3 className="font-bold text-key-color mt-4 mb-4">6.1 Copyright Infringement Claims</h3>

                    <p className="mb-4">
                        EHCO respects intellectual property rights. If you believe that copyrighted material has been improperly used on our platform, you may submit a DMCA takedown request, including:
                    </p>
                    <ul className="list-disc ml-6 mb-6">
                        <li>Identification of the copyrighted work</li>
                        <li>Identification of the material claimed to be infringing (URL or other details)</li>
                        <li>Your contact information</li>
                        <li>A statement of good faith belief that the use is unauthorized</li>
                        <li>A statement, under penalty of perjury, that you are authorized to act on behalf of the copyright owner</li>
                    </ul>

                    <h3 className="font-bold text-key-color mt-4 mb-4">6.2 Counter-Notification Procedure</h3>

                    <p className="mb-4">
                        If you believe that content was removed in error, you may submit a counter-notification including:
                    </p>
                    <ul className="list-disc ml-6 mb-4">
                        <li>Identification of the material removed and its former location</li>
                        <li>Statement under penalty of perjury that the removal was mistaken</li>
                        <li>Your contact information</li>
                        <li>Statement of consent to the jurisdiction of relevant legal authorities</li>
                    </ul>
                    <p className="mb-6">
                        DMCA notices and counter-notifications may be sent to: <br />
                        Email: <span className="underline">info@ehco.com</span>
                    </p>


                    <h2 className="text-xl font-bold text-key-color mt-8 mb-4">7. Content Corrections and Accuracy Standards</h2>
                    <p className="mb-4">
                        EHCO is committed to accuracy and accountability. If factual errors are identified:
                    </p>
                    <ul className="list-disc ml-6 mb-6">
                        <li>Corrections will be issued and timestamped</li>
                        <li>Historical changes will be transparently logged</li>
                        <li>Users can report inaccuracies via <span className="underline">info@ehco.com</span></li>
                    </ul>


                    <h2 className="text-xl font-bold text-key-color mt-8 mb-4">8. General Disclaimer</h2>
                    <p className="mb-4">
                        Informational Purposes Only: All content on EHCO is provided for informational purposes only and does not constitute legal, financial, or personal advice. Users should consult professionals for guidance related to their specific circumstances.
                    </p>
                    <p className="mb-4">
                        Liability Limitation: EHCO assumes no liability for decisions made based on the information presented on our platform. While we strive for accuracy, users acknowledge that news evolves, and updates may occur over time.
                    </p>
                    <p className="mb-6">
                        No Endorsement: Any references to third parties, including sources, public figures, or advertisers, do not constitute an endorsement or affiliation unless explicitly stated.
                    </p>


                    <h2 className="text-xl font-bold text-key-color mt-8 mb-4">9. Policy Updates and Contact Information</h2>
                    <p className="mb-4">
                        EHCO reserves the right to update this policy periodically. The latest version will be posted on this page. Continued use of our platform constitutes acceptance of any modifications.
                    </p>
                    <p className="mb-6">
                        For inquiries, please contact us at: <br />
                        Email: <span className="underline">info@ehco.com</span>
                    </p>

                    <p className="text-center text-gray-500 mt-12">© EHCO 2025</p>
                </div>
            </div>
        </div>
    );
}
