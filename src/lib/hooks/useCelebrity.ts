// src/lib/hooks/useCelebrity.ts
import { useState, useEffect } from 'react';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';

interface Celebrity {
  name: string;
  koreanName: string;
  birthDate: string | Timestamp;
  nationality: string;
  company: string;
  profilePic: string;
  youtubeUrl: string;
  instagramUrl: string;
  spotifyUrl: string;
  school: string;
  debutDate: string;
  occupation: string;
  group: string;
  zodiacSign: string;
  chineseZodiac: string;
}

interface ProcessedCelebrity {
  name: string;
  koreanName: string;
  birthDate: string;
  nationality: string;
  company: string;
  profilePic: string;
  youtubeUrl: string;
  instagramUrl: string;
  spotifyUrl: string;
  school: string;
  debutDate: string;
  occupation: string;
  group: string;
  zodiacSign: string;
  chineseZodiac: string;
}

export function useCelebrity(celebrityId: string) {
  const [celebrity, setCelebrity] = useState<ProcessedCelebrity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCelebrity() {
      try {
        setLoading(true);
        const docRef = doc(db, 'celebrities', celebrityId.toLowerCase());
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data() as Celebrity;
          // Process the timestamp if it exists
          const processedData = {
            ...data,
            birthDate: data.birthDate instanceof Timestamp 
              ? data.birthDate.toDate().toLocaleDateString('ko-KR', {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit'
                })
              : data.birthDate
          };
          setCelebrity(processedData);
        } else {
          setError('Celebrity not found');
        }
      } catch (err) {
        console.error('Error fetching celebrity:', err);
        setError('Failed to fetch celebrity data');
      } finally {
        setLoading(false);
      }
    }

    if (celebrityId) {
      fetchCelebrity();
    }
  }, [celebrityId]);

  return { celebrity, loading, error };
}