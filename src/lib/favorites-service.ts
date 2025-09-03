// src/lib/favorites-service.ts
import { 
  doc, 
  getDoc, 
  setDoc, 
  deleteDoc, 
  collection, 
  query, 
  where, 
  getDocs,
  arrayUnion,
  arrayRemove,
  updateDoc
} from 'firebase/firestore';
import { db } from './firebase';

export interface FavoriteItem {
  figureId: string;
  figureName: string;
  figureNameKr: string;
  profilePic?: string;
  addedAt: Date;
}

export interface UserFavorites {
  uid: string;
  favorites: FavoriteItem[];
  updatedAt: Date;
}

/**
 * Add a figure to user's favorites
 */
export async function addToFavorites(
  uid: string, 
  figureData: {
    figureId: string;
    figureName: string;
    figureNameKr: string;
    profilePic?: string;
  }
): Promise<void> {
  const favoritesRef = doc(db, 'user-favorites', uid);
  
  const favoriteItem: FavoriteItem = {
    ...figureData,
    addedAt: new Date()
  };

  try {
    // Check if favorites document exists
    const favoritesSnap = await getDoc(favoritesRef);
    
    if (favoritesSnap.exists()) {
      // Document exists, check if figure is already in favorites
      const existingFavorites = favoritesSnap.data() as UserFavorites;
      const isAlreadyFavorited = existingFavorites.favorites.some(
        fav => fav.figureId === figureData.figureId
      );
      
      if (!isAlreadyFavorited) {
        // Add to existing favorites
        await updateDoc(favoritesRef, {
          favorites: arrayUnion(favoriteItem),
          updatedAt: new Date()
        });
      }
    } else {
      // Create new favorites document
      const newFavorites: UserFavorites = {
        uid,
        favorites: [favoriteItem],
        updatedAt: new Date()
      };
      
      await setDoc(favoritesRef, newFavorites);
    }
  } catch (error) {
    console.error('Error adding to favorites:', error);
    throw error;
  }
}

/**
 * Remove a figure from user's favorites
 */
export async function removeFromFavorites(uid: string, figureId: string): Promise<void> {
  const favoritesRef = doc(db, 'user-favorites', uid);
  
  try {
    const favoritesSnap = await getDoc(favoritesRef);
    
    if (favoritesSnap.exists()) {
      const existingFavorites = favoritesSnap.data() as UserFavorites;
      const favoriteToRemove = existingFavorites.favorites.find(
        fav => fav.figureId === figureId
      );
      
      if (favoriteToRemove) {
        await updateDoc(favoritesRef, {
          favorites: arrayRemove(favoriteToRemove),
          updatedAt: new Date()
        });
      }
    }
  } catch (error) {
    console.error('Error removing from favorites:', error);
    throw error;
  }
}

/**
 * Check if a figure is in user's favorites
 */
export async function isInFavorites(uid: string, figureId: string): Promise<boolean> {
  try {
    const favoritesRef = doc(db, 'user-favorites', uid);
    const favoritesSnap = await getDoc(favoritesRef);
    
    if (favoritesSnap.exists()) {
      const favorites = favoritesSnap.data() as UserFavorites;
      return favorites.favorites.some(fav => fav.figureId === figureId);
    }
    
    return false;
  } catch (error) {
    console.error('Error checking favorites:', error);
    return false;
  }
}

/**
 * Get all of user's favorites
 */
export async function getUserFavorites(uid: string): Promise<FavoriteItem[]> {
  try {
    const favoritesRef = doc(db, 'user-favorites', uid);
    const favoritesSnap = await getDoc(favoritesRef);
    
    if (favoritesSnap.exists()) {
      const favorites = favoritesSnap.data() as UserFavorites;
      // Sort by most recently added
      return favorites.favorites.sort((a, b) => 
        new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()
      );
    }
    
    return [];
  } catch (error) {
    console.error('Error getting user favorites:', error);
    throw error;
  }
}

/**
 * Get the count of user's favorites
 */
export async function getFavoritesCount(uid: string): Promise<number> {
  try {
    const favorites = await getUserFavorites(uid);
    return favorites.length;
  } catch (error) {
    console.error('Error getting favorites count:', error);
    return 0;
  }
}

/**
 * Clear all favorites for a user (useful for account deletion)
 */
export async function clearAllFavorites(uid: string): Promise<void> {
  try {
    const favoritesRef = doc(db, 'user-favorites', uid);
    await deleteDoc(favoritesRef);
  } catch (error) {
    console.error('Error clearing favorites:', error);
    throw error;
  }
}