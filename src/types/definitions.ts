// This file will be the single source of truth for our shared types.

// --- SHARED INTERFACES ---

// For v2 Curated Data (using the correct definition with sourceIds)
export interface TimelinePoint {
    date: string;
    description: string;
    sourceIds: string[]; // The required property
}

export interface CuratedEvent {
    event_title: string;
    event_summary: string;
    primary_date: string;
    timeline_points: TimelinePoint[]; // Uses the TimelinePoint interface
    status: string;
    sources: { id?: string }[];
}

export interface CuratedTimelineData {
    [mainCategory: string]: {
        [subCategory: string]: CuratedEvent[];
    };
}


// For v1 Legacy Data
export interface WikiContentItem {
    id: string;
    category: string;
    subcategory?: string;
    content: string;
    articleIds: string[];
}

export interface LegacyWikiData {
    categoryContent: WikiContentItem[];
}


// For the overall API Response
export interface MainOverview {
    id: string;
    content: string;
    articleIds: string[];
}

export interface V1TimelineContent {
    schema_version: 'v1_legacy';
    data: LegacyWikiData;
}

export interface V2TimelineContent {
    schema_version: 'v2_curated';
    data: CuratedTimelineData;
}

export type TimelineContent = V1TimelineContent | V2TimelineContent;

export interface ApiContentResponse {
    main_overview: MainOverview;
    timeline_content: TimelineContent;
}


// For Articles & Summaries
export interface Article {
    id: string;
    link: string;
    subTitle: string;
    title: string;
    body: string;
    source: string;
    sendDate: string;
    imageUrls: string[];
}

export interface ArticleSummary {
    id: string;
    event_contents?: Record<string, string>;
    subCategory?: string;
    category?: string;
    content?: string;
    title?: string;
}