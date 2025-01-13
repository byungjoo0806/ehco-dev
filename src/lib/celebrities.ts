// Types
export interface Celebrity {
  id: string;          // Document ID in Firestore
  name: string;        // Display name
  koreanName: string;  // Korean name
  birthDate: string;   // Birth date
  nationality: string; // Nationality
  company: string;     // Entertainment company
}

// Initial celebrity data
export const celebrities: Celebrity[] = [
  {
    id: 'hansohee',
    name: 'Han So-hee',
    koreanName: '한소희',
    birthDate: '1993-11-18',
    nationality: 'Republic of Korea',
    company: '9아토엔터테인먼트'
  },
  {
    id: 'iu',
    name: 'IU',
    koreanName: '이지은',
    birthDate: '1993-05-16',
    nationality: 'Republic of Korea',
    company: 'EDAM Entertainment'
  },
  {
    id: 'kimsoohyun',
    name: 'Kim Soo-hyun',
    koreanName: '김수현',
    birthDate: '1988-02-16',
    nationality: 'Republic of Korea',
    company: 'Gold Medalist'
  }
];

// News categories
export type NewsCategory = 'Music' | 'Acting' | 'Promotion';

export interface NewsArticle {
  id: string;
  title: string;
  content: string;
  source: string;
  date: Date;
  category: NewsCategory;
  celebrity: string;
  thumbnail?: string;
  relatedArticles?: string[];
}

// Helper functions
export function getCelebrity(id: string): Celebrity | undefined {
  return celebrities.find(celebrity => celebrity.id === id.toLowerCase());
}

export function validateCategory(category: string): category is NewsCategory {
  return ['Music', 'Acting', 'Promotion'].includes(category);
}