import React, { useState } from 'react';

interface MainCategorySummaryProps {
    content: string;
}

const MainCategorySummary: React.FC<MainCategorySummaryProps> = ({ content }) => {
    const [isOpen, setIsOpen] = useState(false);

    // If there's no content, don't render anything
    if (!content) {
        return null;
    }

    const polishedContent = content.replaceAll("*", "'");

    return (
        <div className="my-4 border border-gray-200 shadow-sm rounded-md ">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full p-4 text-left text-black rounded-md bg-gray-50 hover:bg-gray-100 focus:outline-none flex justify-between items-center"
                aria-expanded={isOpen}
            >
                <h2 className="text-lg font-medium text-gray-800">About this section</h2>
                <svg
                    className={`w-6 h-6 transform transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>
            <div
                className={`overflow-hidden transition-max-height duration-500 ease-in-out ${isOpen ? 'max-h-screen' : 'max-h-0'}`}
            >
                <div className="p-4 bg-white">
                    <p className="text-gray-600 text-sm">
                        {polishedContent}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default MainCategorySummary;