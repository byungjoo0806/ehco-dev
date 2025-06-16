'use client';

import React, { useState, useEffect } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
import { useRouter, useSearchParams } from 'next/navigation';
import Timeline from './Timeline';

interface WikiContentItem {
    id: string;
    category: string;
    subcategory?: string;
    content: string;
    articleIds: string[];
}

interface ArticleData {
    id: string;
    subTitle: string;
    body: string;
    source: string;
    link: string;
    imageUrls: string[];
    sendDate: string;
}

interface ArticleSummaryData {
    id: string;
    event_contents?: Record<string, string>;
    subCategory?: string;
    category?: string;
    content?: string;
    title?: string;
}

interface PublicFigureWikiProps {
    availableSections: string[];
    categories: string[]; // Add this
    subcategories: string[]; // Add this
    categoryContent: WikiContentItem[];
    mainOverview: {
        id: string;
        content: string;
        articleIds: string[];
    };
    articles?: ArticleData[];
    articleSummaries?: ArticleSummaryData[];
}



const LegacyWikiView: React.FC<PublicFigureWikiProps> = ({
    categories,
    categoryContent = [],
    mainOverview,
    articles = [],
    articleSummaries = []
}) => {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [activeCategory, setActiveCategory] = useState<string>('');
    const [activeSubcategories, setActiveSubcategories] = useState<string[]>([]);


    // Initialize from URL on component mount
    useEffect(() => {
        const category = searchParams.get('category') || '';
        const subcategoriesString = searchParams.get('subcategories') || '';

        setActiveCategory(category);
        if (subcategoriesString) {
            setActiveSubcategories(subcategoriesString.split(','));
        } else {
            setActiveSubcategories([]);
        }
    }, [searchParams]);

    // Update URL when category/subcategory changes
    useEffect(() => {
        const params = new URLSearchParams();

        if (activeCategory) {
            params.set('category', activeCategory);
        }

        if (activeSubcategories.length > 0) {
            params.set('subcategories', activeSubcategories.join(','));
        }

        router.replace(`?${params.toString()}`, { scroll: false });
    }, [activeCategory, activeSubcategories, router]);

    // Ordered categories - just the main categories without 'Overview'
    const orderedCategories = categories;

    // Get subcategories for active category
    const availableSubcategories = activeCategory
        ? Array.from(
            new Set(
                categoryContent
                    .filter(item =>
                        item?.category === activeCategory &&
                        item?.subcategory &&
                        !orderedCategories.includes(item.subcategory))
                    .map(item => item.subcategory as string)
                    .filter(Boolean)
            )
        )
        : [];

    // Handle category change
    const handleCategoryChange = (category: string) => {
        setActiveCategory(category);
        setActiveSubcategories([]); // Reset subcategories when changing main category
    };

    // Handle subcategory change with multiple selection
    const handleSubcategoryChange = (subcategory: string) => {
        setActiveSubcategories(prev => {
            const index = prev.indexOf(subcategory);
            if (index > -1) {
                // Remove if already selected
                return prev.filter(item => item !== subcategory);
            } else {
                // Add if not selected
                return [...prev, subcategory];
            }
        });
    };

    // Check if all subcategories are selected
    const areAllSubcategoriesSelected = availableSubcategories.length > 0 &&
        availableSubcategories.every(sub => activeSubcategories.includes(sub));

    // Handle select/deselect all subcategories
    const handleToggleAllSubcategories = () => {
        if (areAllSubcategoriesSelected) {
            setActiveSubcategories([]);
        } else {
            setActiveSubcategories(availableSubcategories);
        }
    };

    // Get the content to display - either main category content or selected subcategory contents
    const getCurrentCategoryContent = () => {
        if (activeSubcategories.length > 0) {
            return categoryContent.filter(content =>
                content.category === activeCategory &&
                content.subcategory &&
                activeSubcategories.includes(content.subcategory)
            );
        } else {
            // Show main category content when no subcategories selected
            const mainContent = categoryContent.find(content =>
                content.category === activeCategory && !content.subcategory
            );
            return mainContent ? [mainContent] : [];
        }
    };

    const currentContents = getCurrentCategoryContent();

    // Get relevant articles for current content
    const getCurrentArticles = () => {
        const currentArticleIds = new Set<string>();

        currentContents.forEach(content => {
            content.articleIds?.forEach(id => currentArticleIds.add(id));
        });

        return articles.filter(article => currentArticleIds.has(article.id));
    };

    const currentArticles = getCurrentArticles();

    return (
        <div className="w-full max-w-[100vw] flex flex-row justify-center">
            <div className='w-[90%] sm:w-[70%] px-2'>
                {/* Main Category Tabs */}
                <div className="w-full mt-3 mb-6">
                    <div className="flex flex-col sm:flex-row overflow-x-auto sm:space-x-2 pb-2 hide-scrollbar">
                        {orderedCategories.map(category => (
                            <button
                                key={category}
                                onClick={() => handleCategoryChange(category)}
                                className={`px-4 py-2 whitespace-nowrap font-medium text-sm transition-colors 
                  ${activeCategory === category
                                        ? 'text-red-500 border-b-2 border-red-500'
                                        : 'text-gray-500 hover:text-gray-800'
                                    }`}
                            >
                                {category}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content Display */}
                <div className="pb-12">
                    {currentContents.length > 0 && (
                        <>
                            {/* Show main category content if no subcategories selected */}
                            {activeSubcategories.length === 0 && (
                                <>
                                    <p className="text-gray-600 break-words mb-4">
                                        {currentContents[0].content.replaceAll("*", "'")}
                                    </p>
                                </>
                            )}

                            {/* Show selected subcategory contents with labels */}
                            {activeSubcategories.length > 0 && currentContents
                                .filter((content): content is WikiContentItem & { subcategory: string } =>
                                    'subcategory' in content && content.subcategory !== undefined)
                                .map((content, index) => (
                                    <div key={content.id} className={index > 0 ? 'mt-8' : 'mb-6'}>
                                        <h2 className="text-lg font-semibold mb-3 text-gray-800">
                                            {content.subcategory}
                                        </h2>
                                        <p className="text-gray-600 break-words mb-4">
                                            {content.content.replaceAll("*", "'")}
                                        </p>
                                    </div>
                                ))}

                            {/* Subcategory Tabs */}
                            {availableSubcategories.length > 0 && (
                                <div className="mb-6">
                                    <div className="flex flex-wrap gap-3 pb-2">
                                        {/* Select/Deselect All button */}
                                        <button
                                            onClick={handleToggleAllSubcategories}
                                            className={`px-3 py-1 text-sm rounded-md shadow-lg whitespace-nowrap transition-colors
                                            ${areAllSubcategoriesSelected
                                                    ? 'bg-red-500 text-white hover:bg-red-300'
                                                    : 'bg-white text-red-500 border border-gray-200 rounded-md hover:bg-red-100'
                                                }`}
                                        >
                                            {areAllSubcategoriesSelected ? 'All' : 'All'}
                                        </button>
                                        {availableSubcategories.map(subcategory => (
                                            <button
                                                key={subcategory}
                                                onClick={() => handleSubcategoryChange(subcategory)}
                                                className={`px-3 py-1 text-sm rounded-md shadow-lg whitespace-nowrap transition-colors
                                                ${activeSubcategories.includes(subcategory)
                                                        ? 'bg-red-500 text-white hover:bg-red-300'
                                                        : 'bg-white text-red-500 border border-gray-200 rounded-md hover:bg-red-100'
                                                    }`}
                                            >
                                                {subcategory}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Commented out Sources
                            <SourcesSwiper articles={currentArticles} />
                            */}
                        </>
                    )}

                    {/* Timeline placed below subcategory tabs (will show for categories with subcategory tabs) */}
                    {activeCategory && availableSubcategories.length > 0 && (
                        <Timeline
                            articleSummaries={articleSummaries}
                            categoryContent={categoryContent}
                            selectedCategory={activeCategory}
                            selectedSubcategories={activeSubcategories}
                            articles={articles}
                        />
                    )}
                </div>
            </div>

            {/* Right sidebar placeholder (unchanged) */}
            <div className='w-[10%] border border-b mt-10 rounded-md hidden sm:block'></div>
        </div>
    );
};

export default LegacyWikiView;