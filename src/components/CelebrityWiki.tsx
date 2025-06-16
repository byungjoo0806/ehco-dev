'use client';

import React from 'react';
import LegacyWikiView from './LegacyWikiView';
import CuratedTimelineView from './CuratedTimelineView';

// --- INTERFACES ---
import {
    TimelineContent,
    Article,
    ArticleSummary,
    LegacyWikiData,
    MainOverview,
    WikiContentItem
} from '@/types/definitions';

// --- CONSTANTS ---

const KNOWN_CATEGORIES = [
    'Creative Works',
    'Live & Broadcast',
    'Public Relations',
    'Personal Milestones',
    'Incidents & Controversies'
];

// --- HELPER FUNCTIONS ---

// This helper function now uses the LegacyWikiData type
function processLegacyData(data: LegacyWikiData) {
    const { categoryContent } = data;
    const categoriesSet = new Set<string>();
    const subcategoriesSet = new Set<string>();
    if (categoryContent) {
        // The 'item' is now correctly typed as WikiContentItem
        categoryContent.forEach((item: WikiContentItem) => {
            if (KNOWN_CATEGORIES.includes(item.category)) {
                categoriesSet.add(item.category);
                if (item.subcategory) {
                    subcategoriesSet.add(item.subcategory);
                }
            }
        });
    }
    const orderedCategories = KNOWN_CATEGORIES.filter(category => categoriesSet.has(category));
    return {
        sections: [...orderedCategories, ...Array.from(subcategoriesSet)],
        categories: orderedCategories,
        subcategories: Array.from(subcategoriesSet)
    };
}

// Define the props for the component with our new interfaces
interface CelebrityWikiProps {
    apiResponse: TimelineContent;
    articles: Article[];
    articleSummaries: ArticleSummary[];
    mainOverview: MainOverview;
}

// --- COMPONENT ---

const CelebrityWiki: React.FC<CelebrityWikiProps> = ({ apiResponse, articles, articleSummaries, mainOverview }) => {

    if (apiResponse.schema_version === 'v2_curated') {
        return <CuratedTimelineView
            data={apiResponse.data}
            articles={articles}
        />;
    }

    if (apiResponse.schema_version === 'v1_legacy') {
        const { sections, categories, subcategories } = processLegacyData(apiResponse.data);

        return <LegacyWikiView
            availableSections={sections}
            categories={categories}
            subcategories={subcategories}
            categoryContent={apiResponse.data.categoryContent}
            mainOverview={mainOverview}
            articles={articles}
            articleSummaries={articleSummaries}
        />;
    }

    return <div>Unable to render content. Unknown schema version.</div>;
};

export default CelebrityWiki;