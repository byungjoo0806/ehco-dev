// app/api/celebrities/search/route.ts
import { NextResponse } from 'next/server';
import { collection, getDocs, query, Timestamp, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');

    if (!q) {
        return NextResponse.json([], { status: 200 });
    }

    try {
        const celebritiesRef = collection(db, 'celebrities');
        // You might want to add more sophisticated search logic here
        const querySnapshot = await getDocs(celebritiesRef);

        const celebrities = querySnapshot.docs
            .map(doc => ({
                id: doc.id,
                ...doc.data(),
                birthDate: doc.data().birthDate instanceof Timestamp
                    ? doc.data().birthDate.toDate().toLocaleDateString('ko-KR', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit'
                    })
                    : doc.data().birthDate
            }))
            // .filter(celebrity =>
            //     // celebrity.name.toLowerCase().includes(q.toLowerCase()) ||
            //     // celebrity.koreanName.toLowerCase().includes(q.toLowerCase())
            // );

        return NextResponse.json(celebrities, { status: 200 });
    } catch (error) {
        console.error('Error searching celebrities:', error);
        return NextResponse.json(
            { error: 'Failed to search celebrities' },
            { status: 500 }
        );
    }
}