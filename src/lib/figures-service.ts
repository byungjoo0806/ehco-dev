// src/lib/figures-service.ts
export interface PublicFigure {
  id: string;
  name: string;
  name_kr?: string;
  profilePic?: string;
}

export async function getTopFigures(limit: number = 10): Promise<PublicFigure[]> {
  try {
    const response = await fetch('/api/public-figures/top');
    if (!response.ok) {
      throw new Error('Failed to fetch figures');
    }
    const data = await response.json();
    return data.slice(0, limit);
  } catch (error) {
    console.error('Error fetching top figures:', error);
    return [];
  }
}

export async function getAllFigures(): Promise<PublicFigure[]> {
  try {
    const response = await fetch('/api/public-figures');
    if (!response.ok) {
      throw new Error('Failed to fetch figures');
    }
    const data = await response.json();
    
    // The API returns { publicFigures: [...], totalCount, ... }
    // Extract the publicFigures array
    if (data.publicFigures && Array.isArray(data.publicFigures)) {
      return data.publicFigures;
    } else {
      console.error('API did not return publicFigures array:', data);
      return [];
    }
  } catch (error) {
    console.error('Error fetching all figures:', error);
    return [];
  }
}

export async function getFiguresByIds(figureIds: string[]): Promise<PublicFigure[]> {
  try {
    // console.log('getFiguresByIds called with IDs:', figureIds);
    
    if (figureIds.length === 0) {
      return [];
    }

    // Try the efficient POST endpoint first
    try {
      const response = await fetch('/api/figures', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ figureIds }),
      });
      
      if (response.ok) {
        const figures = await response.json();
        // console.log('Figures found by ID:', figures);
        
        if (figures.length > 0) {
          return figures;
        }
      }
    } catch (postError) {
      console.log('POST method failed, trying fallback:', postError);
    }

    // If POST failed or returned no results, try name-based search
    // console.log('Trying name-based search fallback...');
    const searchResults = [];
    
    for (const figureId of figureIds) {
      try {
        const response = await fetch(`/api/figures?name=${encodeURIComponent(figureId)}`);
        if (response.ok) {
          const results = await response.json();
          searchResults.push(...results);
        }
      } catch (searchError) {
        console.log(`Name search failed for ${figureId}:`, searchError);
      }
    }
    
    // Remove duplicates
    const uniqueResults = searchResults.filter((figure, index, self) => 
      index === self.findIndex(f => f.id === figure.id)
    );
    
    // console.log('Figures found by name search:', uniqueResults);
    return uniqueResults;
    
  } catch (error) {
    console.error('Error in getFiguresByIds:', error);
    return [];
  }
}