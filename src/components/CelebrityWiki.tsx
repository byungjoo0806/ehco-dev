'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import _ from 'lodash';

interface KeyWork {
    description: string;
    year: string;
    source: string;
}

interface RegularContent {
    id: string;
    subcategory: string;
    subcategory_overview: string;
    source_articles: string[];
    chronological_developments: string;
}

interface CelebrityWikiProps {
    availableSections: string[];
    regularContent: RegularContent[];
    specialContent: {
        key_works: Record<string, KeyWork[]>;
        overall_overview: string;
    };
}

const CATEGORY_MAPPING = {
    'Overall Summary': 'Overview',
    'Key Works': 'Career',
    'Album Release': 'Music',
    'Collaboration': 'Music',
    'Performance': 'Music',
    'Tour/concert': 'Music',
    'Music Awards': 'Music',
    'Drama/Series': 'Acting',
    'Film': 'Acting',
    'OTT': 'Acting',
    'Film/TV/Drama Awards': 'Acting',
    'Variety show': 'Acting',
    'Fan meeting': 'Promotion',
    'Media appearance': 'Promotion',
    'Social media': 'Promotion',
    'Interviews': 'Promotion',
    'Brand activities': 'Promotion',
    'Donation': 'Social',
    'Health/diet': 'Social',
    'Daily fashion': 'Social',
    'Airport fashion': 'Social',
    'Family': 'Social',
    'Friends/companion': 'Social',
    'Marriage/relationship': 'Social',
    'Pets': 'Social',
    'Company/representation': 'Social',
    'Political stance': 'Social',
    'Social Recognition': 'Social',
    'Real estate': 'Social',
    'Plagiarism': 'Controversy',
    'Romance': 'Controversy',
    'Political Controversy': 'Controversy',
    'Social Controversy': 'Controversy'
} as const;

const CATEGORY_ORDER = [
    'Overview',
    'Career',
    'Music',
    'Acting',
    'Promotion',
    'Social',
    'Controversy'
] as const;

const LoadingState = () => {
    return (
        <div className="w-full max-w-[100vw] min-h-screen">
            <div className="w-full max-w-7xl mx-auto px-4 mt-5 flex justify-center">
                <div className="w-[90%] md:w-[80%] relative flex flex-col lg:flex-row gap-8 min-h-screen">
                    {/* Loading Controller - Left Side */}
                    <div className="hidden lg:block w-64 sticky top-16 h-screen">
                        <div className="bg-white rounded-lg shadow-lg p-6 flex flex-col h-3/4">
                            <div className="h-6 bg-gray-200 rounded w-1/2 mb-6 animate-pulse" />
                            <div className="space-y-4">
                                {[...Array(6)].map((_, i) => (
                                    <div key={i} className="space-y-2">
                                        <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse" />
                                        <div className="ml-4 space-y-2">
                                            {[...Array(3)].map((_, j) => (
                                                <div key={j} className="h-3 bg-gray-200 rounded w-2/3 animate-pulse" />
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Loading Content - Right Side */}
                    <div className="flex-1 min-w-0 mt-5 space-y-16">
                        {[...Array(4)].map((_, sectionIndex) => (
                            <div key={sectionIndex} className="mb-16">
                                <div className="h-8 bg-gray-200 rounded w-1/3 mb-8 animate-pulse" />
                                {sectionIndex === 0 ? (
                                    // Overview section loading
                                    <div className="space-y-4">
                                        {[...Array(3)].map((_, i) => (
                                            <div key={i} className="h-4 bg-gray-200 rounded w-full animate-pulse" />
                                        ))}
                                    </div>
                                ) : (
                                    // Other sections loading
                                    <div className="space-y-12">
                                        {[...Array(3)].map((_, subIndex) => (
                                            <div key={subIndex} className="mb-8">
                                                <div className="h-6 bg-gray-200 rounded w-1/4 mb-6 animate-pulse" />
                                                <div className="space-y-4">
                                                    {[...Array(4)].map((_, i) => (
                                                        <div key={i} className="h-4 bg-gray-200 rounded w-full animate-pulse" />
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

const CelebrityWiki: React.FC<CelebrityWikiProps> = ({
    availableSections = [],
    regularContent = [],
    specialContent
}) => {
    const [activeSection, setActiveSection] = useState<string>('');
    const [activeSubcategory, setActiveSubcategory] = useState<string>('');
    const controllerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);

    const formatCategoryName = (category: string) => {
        return category
            .split('_')
            .map(word => word.toLowerCase() === 'ott' ? 'OTT' : word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    };

    const groupedSections = availableSections.reduce((acc, section) => {
        const mainCategory = CATEGORY_MAPPING[section as keyof typeof CATEGORY_MAPPING];
        if (!mainCategory) return acc;
        if (!acc[mainCategory]) {
            acc[mainCategory] = [];
        }
        if (mainCategory !== 'Overview' && mainCategory !== 'Career') {
            acc[mainCategory].push(section);
        }
        return acc;
    }, {} as Record<string, string[]>);

    const orderedSections = Object.entries(groupedSections)
        .sort(([a], [b]) => {
            const aIndex = CATEGORY_ORDER.indexOf(a as typeof CATEGORY_ORDER[number]);
            const bIndex = CATEGORY_ORDER.indexOf(b as typeof CATEGORY_ORDER[number]);
            return aIndex - bIndex;
        });

    const handleScroll = useCallback(() => {
        if (!contentRef.current) return;

        const contentRect = contentRef.current.getBoundingClientRect();
        const scrollPosition = -contentRect.top;
        const headerOffset = 100;

        // Get all section and subcategory elements within the content area
        const sectionElements = contentRef.current.querySelectorAll<HTMLElement>('[data-section]');
        const subcategoryElements = contentRef.current.querySelectorAll<HTMLElement>('[data-subcategory]');

        let currentSection = '';
        let currentSubcategory = '';

        // Check sections
        sectionElements.forEach((section) => {
            const sectionRect = section.getBoundingClientRect();
            const sectionTop = sectionRect.top - contentRect.top;

            if (scrollPosition + headerOffset >= sectionTop &&
                scrollPosition + headerOffset <= sectionTop + sectionRect.height) {
                currentSection = section.getAttribute('data-section') || '';
            }
        });

        // Check subcategories
        subcategoryElements.forEach((subcategory) => {
            const subcategoryRect = subcategory.getBoundingClientRect();
            const subcategoryTop = subcategoryRect.top - contentRect.top;

            if (scrollPosition + headerOffset >= subcategoryTop &&
                scrollPosition + headerOffset <= subcategoryTop + subcategoryRect.height) {
                currentSubcategory = subcategory.getAttribute('data-subcategory') || '';
            }
        });

        if (currentSection !== activeSection) {
            setActiveSection(currentSection);
        }
        if (currentSubcategory !== activeSubcategory) {
            setActiveSubcategory(currentSubcategory);
        }
    }, [activeSection, activeSubcategory]);

    useEffect(() => {
        const debouncedHandleScroll = _.debounce(handleScroll, 100);
        window.addEventListener('scroll', debouncedHandleScroll, { passive: true });
        handleScroll();
        return () => {
            window.removeEventListener('scroll', debouncedHandleScroll);
        };
    }, [handleScroll]);

    const scrollToSection = (sectionId: string, subcategoryId?: string) => {
        console.log(sectionId, subcategoryId);
        const selector = subcategoryId
            ? `[data-subcategory="${subcategoryId}"]`
            : `[data-section="${sectionId}"]`;

        const element = contentRef.current?.querySelector(selector);
        if (element) {
            const headerOffset = 100;
            const elementPosition = element.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
        }
    };

    const normalizeSection = (section: string) => {
        return section
            .toLowerCase()
            .replace(/\s*,\s*/g, '')
            .replace(/\//g, '')
            .replace(/\s+/g, '')
            .trim();
    };

    const getContentForSection = (sectionName: string) => {
        if (sectionName === 'Overall Summary') {
            return specialContent.overall_overview;
        }
        if (sectionName === 'Key Works') {
            return specialContent.key_works;
        }
        return regularContent.find(
            item => normalizeSection(item.subcategory) === normalizeSection(sectionName)
        );
    };

    const sortWorksByYear = (works: KeyWork[]) => {
        return [...works].sort((a, b) => {
            const yearA = a.year.match(/\d{4}/)?.[0] || "0";
            const yearB = b.year.match(/\d{4}/)?.[0] || "0";
            if (yearA === yearB) {
                const monthA = new Date(a.year).getMonth();
                const monthB = new Date(b.year).getMonth();
                return isNaN(monthA) || isNaN(monthB) ? 0 : monthB - monthA;
            }
            return parseInt(yearB) - parseInt(yearA);
        });
    };

    return (
        <div className="w-full max-w-[100vw] min-h-screen">
            <div className="w-full max-w-7xl mx-auto px-4 mt-5 flex justify-center">
                <div className="w-[90%] md:w-[80%] relative flex flex-col lg:flex-row gap-8 min-h-screen">
                    {/* Controller - Left Side */}
                    <div
                        ref={controllerRef}
                        className="hidden lg:block w-64 sticky top-16 h-screen"
                    >
                        <div className="bg-white rounded-lg shadow-lg p-6 flex flex-col h-3/4">
                            <h3 className="text-lg font-semibold mb-4">Contents</h3>
                            <nav className="space-y-2 overflow-y-auto flex-1">
                                {orderedSections.map(([mainCategory, subcategories]) => (
                                    <div key={mainCategory} className="space-y-1">
                                        <button
                                            onClick={() => scrollToSection(mainCategory)}
                                            className={`w-full text-left px-2 py-1 rounded transition-colors duration-200 hover:bg-gray-100 
                                                ${activeSection === mainCategory ? 'bg-gray-100 font-medium' : ''}`}
                                        >
                                            {mainCategory}
                                        </button>
                                        {mainCategory === 'Career' ? (
                                            // Show Key Works categories for Career
                                            <div className="ml-4 space-y-1 border-l-2 border-gray-200">
                                                {Object.entries(specialContent.key_works).map(([category]) => (
                                                    <button
                                                        key={category}
                                                        onClick={() => scrollToSection(mainCategory, formatCategoryName(category))}
                                                        className={`w-full text-left px-2 py-1 text-sm transition-colors duration-200 hover:bg-gray-100 rounded
                                                        ${activeSubcategory === formatCategoryName(category) ? 'bg-gray-100 font-medium' : ''}`}
                                                    >
                                                        {formatCategoryName(category)}
                                                    </button>
                                                ))}
                                            </div>
                                        ) : subcategories.length > 0 && mainCategory !== 'Overview' ? (
                                            <div className="ml-4 space-y-1 border-l-2 border-gray-200">
                                                {subcategories.map((subcategory) => (
                                                    <button
                                                        key={subcategory}
                                                        onClick={() => scrollToSection(mainCategory, subcategory)}
                                                        className={`w-full text-left px-2 py-1 text-sm transition-colors duration-200 hover:bg-gray-100 rounded
                                                                ${activeSubcategory === subcategory ? 'bg-gray-100 font-medium' : ''}`}
                                                    >
                                                        {subcategory}
                                                    </button>
                                                ))}
                                            </div>
                                        ) : null}
                                    </div>
                                ))}
                            </nav>
                        </div>
                    </div>

                    {/* Main Content */}
                    <div ref={contentRef} className="flex-1 min-w-0 mt-5">
                        {orderedSections.map(([mainCategory, subcategories]) => (
                            <div key={mainCategory} data-section={mainCategory} className="mb-16">
                                <h2 className="text-2xl lg:text-3xl font-bold mb-6 break-words">{mainCategory}</h2>
                                {mainCategory === 'Overview' ? (
                                    <p className="text-gray-600 break-words">{specialContent.overall_overview}</p>
                                ) : mainCategory === 'Career' ? (
                                    <div className="space-y-4">
                                        {Object.entries(specialContent.key_works).map(([category, works]) => (
                                            <div key={category} data-subcategory={formatCategoryName(category)} className="mb-6">
                                                <h3 className="text-lg lg:text-xl font-semibold mb-3 break-words">
                                                    {formatCategoryName(category)}
                                                </h3>
                                                <ul className="list-none space-y-4">
                                                    {sortWorksByYear(works).map((work, index) => (
                                                        <li key={index} className="text-gray-600">
                                                            <div className="mb-1 break-words">
                                                                <span className="font-medium">{work.year}</span> - {work.description}
                                                            </div>
                                                            <div className="text-sm text-gray-500 break-all">
                                                                source: <a href={work.source} className="hover:underline text-blue-500" target="_blank" rel="noopener noreferrer">{work.source}</a>
                                                            </div>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="space-y-8">
                                        {subcategories.map((subcategory) => {
                                            const content = getContentForSection(subcategory) as RegularContent;
                                            return (
                                                <div key={subcategory} data-subcategory={subcategory} className="mb-8">
                                                    <h3 className="text-lg lg:text-xl font-semibold mb-4 break-words">{subcategory}</h3>
                                                    {content && (
                                                        <div className="space-y-4">
                                                            <p className="text-gray-600 break-words">{content.subcategory_overview}</p>
                                                            <div className="mt-4">
                                                                <h4 className="font-medium mb-2">Chronological Developments</h4>
                                                                <p className="text-gray-600 break-words">{content.chronological_developments}</p>
                                                            </div>
                                                            {content.source_articles.length > 0 && (
                                                                <div className="mt-4">
                                                                    <h4 className="font-medium mb-2">Sources</h4>
                                                                    <ul className="list-disc pl-6">
                                                                        {content.source_articles.map((source, index) => (
                                                                            <li key={index} className="break-all">
                                                                                <a href={source} className="text-blue-500">{source}</a>
                                                                            </li>
                                                                        ))}
                                                                    </ul>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CelebrityWiki;