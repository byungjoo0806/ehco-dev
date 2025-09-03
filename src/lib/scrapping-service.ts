// src/lib/scrapping-service.ts
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc,
  arrayUnion,
  arrayRemove,
  Timestamp
} from 'firebase/firestore';
import { db } from './firebase';

interface TimelinePoint {
  date: string;
  description: string;
  sourceIds?: string[];
  sources?: { id?: string }[];
}

interface EventGroupData {
  title?: string;
  name?: string;
  event?: string;
  date?: string;
  year?: string | number;
  period?: string;
  event_title?: string;
  event_summary?: string;
  event_years?: number[];
  timeline_points?: TimelinePoint[];
}

export interface ScrappedEventItem {
  id: string;                    // Unique ID for this scrapped event
  figureId: string;              // e.g., "bts"
  figureName: string;            // e.g., "BTS"
  figureNameKr: string;          // e.g., "방탄소년단"
  mainCategory: string;          // e.g., "Creative Works"
  subcategory: string,           // e.g., "Music"
  eventGroupIndex: number;       // Index in the array (0, 1, 2...)
  eventGroup: EventGroupData;               // Complete event group object
  scrappedAt: Date;
  tags?: string[];               // Optional user tags
  userNotes?: string;            // Optional user notes
}

interface ScrappedEventItemFromDB extends Omit<ScrappedEventItem, 'scrappedAt'> {
  scrappedAt: Timestamp; // The raw data has a Timestamp
}

export interface UserScrappedEvents {
  uid: string;
  scrappedEvents: ScrappedEventItemFromDB[];
  updatedAt: Date;
}

interface UserScrappedEventsFromDB {
  uid: string;
  scrappedEvents: ScrappedEventItemFromDB[];
  updatedAt: Timestamp;
}

/**
 * Generate a unique ID for a scrapped event
 */
function generateScrappedEventId(
  figureId: string, 
  mainCategory: string, 
  subcategory: string, 
  eventGroupIndex: number
): string {
  return `${figureId}_${mainCategory}_${subcategory}_${eventGroupIndex}`.replace(/\s+/g, '_').toLowerCase();
}

/**
 * Add an event group to user's scrapped events
 */
export async function addToScrappedEvents(
  uid: string,
  scrappedEventData: {
    figureId: string;
    figureName: string;
    figureNameKr: string;
    mainCategory: string;
    subcategory: string;
    eventGroupIndex: number;
    eventGroup: EventGroupData;
    tags?: string[];
    userNotes?: string;
  }
): Promise<void> {
  const scrappedEventsRef = doc(db, 'user-scrapped-events', uid);
  
  const itemToWrite = {
    id: generateScrappedEventId(
      scrappedEventData.figureId,
      scrappedEventData.mainCategory,
      scrappedEventData.subcategory,
      scrappedEventData.eventGroupIndex
    ),
    ...scrappedEventData,
    scrappedAt: new Date()
  };

  try {
    // Check if scrapped events document exists
    const scrappedEventsSnap = await getDoc(scrappedEventsRef);
    
    if (scrappedEventsSnap.exists()) {
      // Document exists, check if event is already scrapped
      const existingData = scrappedEventsSnap.data() as UserScrappedEventsFromDB;
      const isAlreadyScrapped = existingData.scrappedEvents.some(
        item => item.id === itemToWrite.id
      );
      
      if (!isAlreadyScrapped) {
        // Add to existing scrapped events using arrayUnion
        await updateDoc(scrappedEventsRef, {
          scrappedEvents: arrayUnion(itemToWrite), // Use the plain object here
          updatedAt: new Date()
        });
      }
    } else {
      // Create new scrapped events document
      const newScrappedEventsDoc = {
        uid,
        scrappedEvents: [itemToWrite], // Use the same plain object
        updatedAt: new Date()
      };
      
      await setDoc(scrappedEventsRef, newScrappedEventsDoc);
    }
  } catch (error) {
    console.error('Error adding to scrapped events:', error);
    throw error;
  }
}

/**
 * Remove an event group from user's scrapped events
 */
export async function removeFromScrappedEvents(uid: string, scrappedEventId: string): Promise<void> {
  const scrappedEventsRef = doc(db, 'user-scrapped-events', uid);
  
  try {
    const scrappedEventsSnap = await getDoc(scrappedEventsRef);
    
    if (scrappedEventsSnap.exists()) {
      const existingScrappedEvents = scrappedEventsSnap.data() as UserScrappedEvents;
      const eventToRemove = existingScrappedEvents.scrappedEvents.find(
        item => item.id === scrappedEventId
      );
      
      if (eventToRemove) {
        await updateDoc(scrappedEventsRef, {
          scrappedEvents: arrayRemove(eventToRemove),
          updatedAt: new Date()
        });
      }
    }
  } catch (error) {
    console.error('Error removing from scrapped events:', error);
    throw error;
  }
}

/**
 * Check if an event group is scrapped
 */
export async function isScrapped(
  uid: string, 
  figureId: string, 
  mainCategory: string, 
  subcategory: string, 
  eventGroupIndex: number
): Promise<boolean> {
  try {
    const scrappedEventId = generateScrappedEventId(figureId, mainCategory, subcategory, eventGroupIndex);
    const scrappedEventsRef = doc(db, 'user-scrapped-events', uid);
    const scrappedEventsSnap = await getDoc(scrappedEventsRef);
    
    if (scrappedEventsSnap.exists()) {
      const scrappedEvents = scrappedEventsSnap.data() as UserScrappedEvents;
      return scrappedEvents.scrappedEvents.some(item => item.id === scrappedEventId);
    }
    
    return false;
  } catch (error) {
    console.error('Error checking scrapped status:', error);
    return false;
  }
}

/**
 * Get all of user's scrapped events
 */
export async function getUserScrappedEvents(uid: string): Promise<ScrappedEventItem[]> {
  try {
    const scrappedEventsRef = doc(db, 'user-scrapped-events', uid);
    const scrappedEventsSnap = await getDoc(scrappedEventsRef);
    
    if (scrappedEventsSnap.exists()) {
      const dataFromDB = scrappedEventsSnap.data() as UserScrappedEventsFromDB;
      // Sort by most recently scrapped
      const scrappedEventsWithDates: ScrappedEventItem[] = dataFromDB.scrappedEvents.map(event => ({
        ...event,
        scrappedAt: event.scrappedAt.toDate(), // Convert here!
      }));
      
      // Now the sorting logic works correctly because `scrappedAt` is a valid Date object
      return scrappedEventsWithDates.sort((a, b) => 
        b.scrappedAt.getTime() - a.scrappedAt.getTime()
      );
    }
    
    return [];
  } catch (error) {
    console.error('Error getting user scrapped events:', error);
    throw error;
  }
}

/**
 * Get scrapped events filtered by figure
 */
export async function getScrappedEventsByFigure(uid: string, figureId: string): Promise<ScrappedEventItem[]> {
  try {
    const allScrappedEvents = await getUserScrappedEvents(uid);
    return allScrappedEvents.filter(item => item.figureId === figureId);
  } catch (error) {
    console.error('Error getting scrapped events by figure:', error);
    throw error;
  }
}

/**
 * Get scrapped events filtered by category
 */
export async function getScrappedEventsByCategory(uid: string, mainCategory: string): Promise<ScrappedEventItem[]> {
  try {
    const allScrappedEvents = await getUserScrappedEvents(uid);
    return allScrappedEvents.filter(item => item.mainCategory === mainCategory);
  } catch (error) {
    console.error('Error getting scrapped events by category:', error);
    throw error;
  }
}

/**
 * Update user notes for a scrapped event
 */
export async function updateScrappedEventNotes(
  uid: string, 
  scrappedEventId: string, 
  userNotes: string
): Promise<void> {
  try {
    const scrappedEventsRef = doc(db, 'user-scrapped-events', uid);
    const scrappedEventsSnap = await getDoc(scrappedEventsRef);
    
    if (scrappedEventsSnap.exists()) {
      const existingScrappedEvents = scrappedEventsSnap.data() as UserScrappedEvents;
      const updatedEvents = existingScrappedEvents.scrappedEvents.map(item => 
        item.id === scrappedEventId ? { ...item, userNotes } : item
      );
      
      await updateDoc(scrappedEventsRef, {
        scrappedEvents: updatedEvents,
        updatedAt: new Date()
      });
    }
  } catch (error) {
    console.error('Error updating scrapped event notes:', error);
    throw error;
  }
}

/**
 * Add tags to a scrapped event
 */
export async function updateScrappedEventTags(
  uid: string, 
  scrappedEventId: string, 
  tags: string[]
): Promise<void> {
  try {
    const scrappedEventsRef = doc(db, 'user-scrapped-events', uid);
    const scrappedEventsSnap = await getDoc(scrappedEventsRef);
    
    if (scrappedEventsSnap.exists()) {
      const existingScrappedEvents = scrappedEventsSnap.data() as UserScrappedEvents;
      const updatedEvents = existingScrappedEvents.scrappedEvents.map(item => 
        item.id === scrappedEventId ? { ...item, tags } : item
      );
      
      await updateDoc(scrappedEventsRef, {
        scrappedEvents: updatedEvents,
        updatedAt: new Date()
      });
    }
  } catch (error) {
    console.error('Error updating scrapped event tags:', error);
    throw error;
  }
}

/**
 * Get count of scrapped events
 */
export async function getScrappedEventsCount(uid: string): Promise<number> {
  try {
    const scrappedEvents = await getUserScrappedEvents(uid);
    return scrappedEvents.length;
  } catch (error) {
    console.error('Error getting scrapped events count:', error);
    return 0;
  }
}

/**
 * Clear all scrapped events for a user (useful for account deletion)
 */
export async function clearAllScrappedEvents(uid: string): Promise<void> {
  try {
    const scrappedEventsRef = doc(db, 'user-scrapped-events', uid);
    await updateDoc(scrappedEventsRef, {
      scrappedEvents: [],
      updatedAt: new Date()
    });
  } catch (error) {
    console.error('Error clearing scrapped events:', error);
    throw error;
  }
}