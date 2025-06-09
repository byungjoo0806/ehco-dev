import { db } from "@/lib/firebase";
import { collection, getDocs, query, limit, startAfter, orderBy, getCountFromServer, where } from "firebase/firestore";
import { NextResponse } from "next/server";

// Optimized interface with only necessary fields
interface PublicFigureBase {
    id: string;
    name: string;
    name_kr: string;
    nationality: string;
    occupation: string[];
    profilePic?: string;
    gender: string;
    company?: string;
    debutDate?: string;
    lastUpdated?: string;
}

interface IndividualPerson extends PublicFigureBase {
    is_group: false;
    birthDate?: string;
    group?: string;
}

interface GroupProfile extends PublicFigureBase {
    is_group: true;
    members?: IndividualPerson[];
}

type PublicFigure = IndividualPerson | GroupProfile;

// Helper function to determine group gender based on members
function determineGroupGender(members?: IndividualPerson[]): 'Male' | 'Female' | 'Mixed' {
    if (!members || members.length === 0) return 'Mixed';

    const genders = new Set(members.map(member => member.gender).filter(Boolean));

    if (genders.size === 1) {
        const gender = Array.from(genders)[0];
        return gender === 'Male' || gender === 'Female' ? gender : 'Mixed';
    }

    return 'Mixed';
}

// Helper function to check if figure matches category filters
function matchesCategoryFilters(figure: PublicFigure, filters: CategoryFilters): boolean {
    // Check gender filters - ALL selected genders must match
    if (filters.gender && filters.gender.length > 0) {
        const hasGroup = filters.gender.includes('Group');
        const hasMale = filters.gender.includes('Male');
        const hasFemale = filters.gender.includes('Female');

        // Handle specific combinations
        if (hasGroup && hasMale && !hasFemale) {
            // Group + Male: must be a male group (all members male)
            if (!figure.is_group) return false;
            const groupGender = determineGroupGender(figure.members);
            if (groupGender !== 'Male') return false;
        }
        else if (hasGroup && hasFemale && !hasMale) {
            // Group + Female: must be a female group (all members female)
            if (!figure.is_group) return false;
            const groupGender = determineGroupGender(figure.members);
            if (groupGender !== 'Female') return false;
        }
        else if (hasGroup && hasMale && hasFemale) {
            // Group + Male + Female: impossible combination, return false
            return false;
        }
        else if (hasGroup && !hasMale && !hasFemale) {
            // Only Group: must be a group (any gender)
            if (!figure.is_group) return false;
        }
        else if ((hasMale || hasFemale) && !hasGroup) {
            // Only Male or Female (no Group): check individuals and groups
            if (figure.is_group) {
                const groupGender = determineGroupGender(figure.members);
                if (hasMale && hasFemale) {
                    // Both Male and Female selected but no Group: impossible for one figure
                    return false;
                } else if (hasMale && groupGender !== 'Male') {
                    return false;
                } else if (hasFemale && groupGender !== 'Female') {
                    return false;
                }
            } else {
                // Individual figure
                if (hasMale && hasFemale) {
                    // Both Male and Female selected: impossible for one individual
                    return false;
                } else if (hasMale && figure.gender !== 'Male') {
                    return false;
                } else if (hasFemale && figure.gender !== 'Female') {
                    return false;
                }
            }
        }
        else if (hasMale && hasFemale && !hasGroup) {
            // Male + Female without Group: impossible combination
            return false;
        }
    }

    // Check occupation filters - figure must have ALL selected occupations
    if (filters.occupation && filters.occupation.length > 0) {
        const hasAllOccupations = filters.occupation.every(filterOccupation =>
            figure.occupation?.some(figureOccupation =>
                figureOccupation.toLowerCase().includes(filterOccupation.toLowerCase())
            )
        );
        if (!hasAllOccupations) {
            return false;
        }
    }

    // Check nationality filters - figure must match ALL selected nationalities
    if (filters.nationality && filters.nationality.length > 0) {
        const hasAllNationalities = filters.nationality.every(filterNationality =>
            figure.nationality === filterNationality
        );
        if (!hasAllNationalities) {
            return false;
        }
    }

    return true;
}

interface CategoryFilters {
    gender?: string[];
    occupation?: string[];
    nationality?: string[];
}

function parseCategoryFilters(url: URL): CategoryFilters {
    const filters: CategoryFilters = {};

    // Parse gender filters
    const genderParams = url.searchParams.getAll('gender');
    if (genderParams.length > 0) {
        filters.gender = genderParams;
    }

    // Parse occupation filters
    const occupationParams = url.searchParams.getAll('occupation');
    if (occupationParams.length > 0) {
        filters.occupation = occupationParams;
    }

    // Parse nationality filters
    const nationalityParams = url.searchParams.getAll('nationality');
    if (nationalityParams.length > 0) {
        filters.nationality = nationalityParams;
    }

    return filters;
}

export async function GET(request: Request) {
    try {
        const url = new URL(request.url);
        const pageParam = url.searchParams.get('page');
        const pageSizeParam = url.searchParams.get('pageSize');
        const sortParam = url.searchParams.get('sort') || 'az';

        const page = pageParam ? parseInt(pageParam) : 1;
        const pageSize = pageSizeParam ? parseInt(pageSizeParam) : 18;

        // Parse category filters
        const categoryFilters = parseCategoryFilters(url);

        console.log('Category filters:', categoryFilters);

        // Get total count of documents (we'll filter these in memory for now)
        const collectionRef = collection(db, 'selected-figures');

        // For now, we'll fetch all documents and filter in memory
        // This is not optimal for large datasets, but works for category filtering
        const allDocsQuery = query(collection(db, 'selected-figures'), orderBy('name'));
        const allDocsSnapshot = await getDocs(allDocsQuery);

        // Transform all documents to our interface
        const allFigures: PublicFigure[] = allDocsSnapshot.docs.map(docRef => {
            const data = docRef.data();

            // Parse occupation array - split combined occupations
            let occupations: string[] = [];
            if (data.occupation && Array.isArray(data.occupation)) {
                data.occupation.forEach((occ: string) => {
                    // Split by " / " and trim each part
                    const splitOccs = occ.split(' / ').map((part: string) => part.trim());
                    occupations.push(...splitOccs);
                });
            }

            // For groups, determine nationality from members
            let nationality = data.nationality || '';
            if (data.is_group && data.members && Array.isArray(data.members)) {
                // Get nationalities from all members
                const memberNationalities = data.members
                    .map((member: any) => member.nationality)
                    .filter((nat: string) => nat);

                // If all members have the same nationality, use that
                if (memberNationalities.length > 0) {
                    const uniqueNationalities = [...new Set(memberNationalities)];
                    if (uniqueNationalities.length === 1) {
                        nationality = uniqueNationalities[0];
                    } else {
                        nationality = 'Mixed'; // Multiple nationalities in group
                    }
                }
            }

            const publicFigureBase: PublicFigureBase = {
                id: docRef.id,
                name: data.name || '',
                name_kr: data.name_kr || '',
                gender: data.gender || '',
                nationality: nationality,
                occupation: occupations,
                profilePic: data.profilePic || '',
                company: data.company || '',
                debutDate: data.debutDate || '',
                lastUpdated: data.lastUpdated || '',
            };

            if (data.is_group) {
                return {
                    ...publicFigureBase,
                    is_group: true,
                    members: data.members || []
                } as GroupProfile;
            } else {
                return {
                    ...publicFigureBase,
                    is_group: false,
                    birthDate: data.birthDate || '',
                    group: data.group || ''
                } as IndividualPerson;
            }
        });

        // Debug: Log some examples of parsed occupations
        const sampleFigures = allFigures.slice(0, 3);
        console.log('Sample parsed figures:', sampleFigures.map(f => ({
            name: f.name,
            originalOccupation: allDocsSnapshot.docs.find(d => d.id === f.id)?.data().occupation,
            parsedOccupation: f.occupation,
            gender: f.gender,
            nationality: f.nationality
        })));

        // Apply category filters
        const filteredFigures = allFigures.filter(figure =>
            matchesCategoryFilters(figure, categoryFilters)
        );

        console.log(`Filtered ${allFigures.length} figures down to ${filteredFigures.length} after applying AND logic`);
        if (filteredFigures.length > 0 && filteredFigures.length < 6) {
            console.log('Sample filtered figures:', filteredFigures.map(f => ({
                name: f.name,
                gender: f.gender,
                is_group: f.is_group,
                occupation: f.occupation,
                nationality: f.nationality
            })));
        }

        // Apply sorting
        const sortedFigures = [...filteredFigures].sort((a, b) => {
            switch (sortParam) {
                case 'za':
                    return b.name.localeCompare(a.name);
                case 'recent':
                    return (b.lastUpdated || '').localeCompare(a.lastUpdated || '');
                case 'popular':
                    // Implement your popularity logic here
                    return 0;
                default: // 'az'
                    return a.name.localeCompare(b.name);
            }
        });

        // Apply pagination
        const totalCount = sortedFigures.length;
        const totalPages = Math.ceil(totalCount / pageSize);
        const startIndex = (page - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const paginatedFigures = sortedFigures.slice(startIndex, endIndex);

        const response = {
            publicFigures: paginatedFigures,
            totalCount,
            totalPages,
            currentPage: page,
            pageSize,
            appliedFilters: categoryFilters
        };

        console.log('Sending response:', {
            figuresCount: paginatedFigures.length,
            totalCount,
            totalPages,
            currentPage: page,
            appliedFilters: categoryFilters
        });

        return NextResponse.json(response);
    } catch (error) {
        console.error('Error in API route:', error);

        if (error instanceof Error) {
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
            return NextResponse.json(
                { error: 'Failed to fetch public figures', details: error.message },
                { status: 500 }
            );
        } else {
            console.error('Unknown error type');
            return NextResponse.json(
                { error: 'Failed to fetch public figures', details: 'Unknown error' },
                { status: 500 }
            );
        }
    }
}