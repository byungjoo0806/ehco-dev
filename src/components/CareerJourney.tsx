'use client';

import React from 'react';
import CuratedTimelineView from './CuratedTimelineView';

// --- INTERFACES ---
import {
    TimelineContent,
    Article,
} from '@/types/definitions';

// Define the props for the component with our new interfaces
interface CareerJourneyProps {
    apiResponse: TimelineContent;
    articles: Article[];
    figureId: string;
    figureName: string;
    figureNameKr: string;
}

// --- COMPONENT ---

const CareerJourney: React.FC<CareerJourneyProps> = ({ apiResponse, articles, figureId, figureName, figureNameKr }) => {

    if (apiResponse.schema_version === 'v2_curated') {
        return <CuratedTimelineView
            data={apiResponse.data}
            articles={articles}
            figureId={figureId}
            figureName={figureName}
            figureNameKr={figureNameKr}
        />;
    }

    return <div>Unable to render content. Unknown schema version.</div>;
};

export default CareerJourney;