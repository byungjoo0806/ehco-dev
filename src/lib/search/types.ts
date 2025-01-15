export interface Celebrity {
    id: string;
    name: string;
    koreanName: string;
    profilePic: string;
}

export interface Article {
    id: string;
    title: string;
    koreanTitle?: string;
    excerpt: string;
    celebrityId?: string;
}

export interface SearchResult {
    type: 'celebrity' | 'article';
    id: string;
    name: string;
    koreanName?: string;
    profilePic?: string;
    content?: string;
    celebrity?: string;
    thumbnail?: string;
    category?: string;
    date?: string;
    source?: string;
    url?: string;
}