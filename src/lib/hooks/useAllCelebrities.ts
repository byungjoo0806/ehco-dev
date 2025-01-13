import { useState, useEffect } from 'react';
import { collection, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';

interface Celebrity {
    name: string;
    koreanName: string;
    birthDate: string | Timestamp;
    nationality: string;
    company: string;
}

interface ProcessedCelebrity {
    id:string;
    name: string;
    koreanName: string;
    birthDate: string;
    nationality: string;
    company: string;
}

export function useAllCelebrities() {
    const [celebrities, setCelebrities] = useState<ProcessedCelebrity[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchAllCelebrities() {
            try {
                setLoading(true);
                const celebritiesRef = collection(db, 'celebrities');
                const querySnapshot = await getDocs(celebritiesRef);

                const celebritiesData = querySnapshot.docs.map(doc => {
                    const data = doc.data() as Celebrity;
                    // Process the timestamp if it exists
                    return {
                        id: doc.id, // Include the document ID
                        ...data,
                        birthDate: data.birthDate instanceof Timestamp
                            ? data.birthDate.toDate().toLocaleDateString('ko-KR', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit'
                            })
                            : data.birthDate
                    };
                });

                setCelebrities(celebritiesData);
            } catch (err) {
                console.error('Error fetching celebrities:', err);
                setError('Failed to fetch celebrities data');
            } finally {
                setLoading(false);
            }
        }

        fetchAllCelebrities();
    }, []); // Empty dependency array since we're not watching any specific ID

    return { celebrities, loading, error };
}