// src/components/CelebrityWikiLoading.tsx
import React from 'react';

const CelebrityWikiLoading = () => {
    return (
        <div className="w-full max-w-[100vw] min-h-screen">
            <div className="w-full max-w-7xl mx-auto px-4 mt-5 flex justify-center">
                <div className="w-[90%] md:w-[80%] relative flex flex-col lg:flex-row gap-8 min-h-screen">
                    {/* Loading Controller - Left Side */}
                    <div className="hidden lg:block w-64 sticky top-16 h-screen">
                        <div className="bg-white rounded-lg shadow-lg p-6 flex flex-col h-3/4">
                            <div className="h-6 bg-gray-200 rounded w-1/2 mb-6 animate-pulse" />
                            <div className="space-y-4">
                                {[...Array(6)].map((_, i) => (
                                    <div key={i} className="space-y-2">
                                        <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse" />
                                        <div className="ml-4 space-y-2">
                                            {[...Array(3)].map((_, j) => (
                                                <div key={j} className="h-3 bg-gray-200 rounded w-2/3 animate-pulse" />
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Loading Content - Right Side */}
                    <div className="flex-1 min-w-0 mt-5 space-y-16">
                        {[...Array(4)].map((_, sectionIndex) => (
                            <div key={sectionIndex} className="mb-16">
                                <div className="h-8 bg-gray-200 rounded w-1/3 mb-8 animate-pulse" />
                                {sectionIndex === 0 ? (
                                    // Overview section loading
                                    <div className="space-y-4">
                                        {[...Array(3)].map((_, i) => (
                                            <div key={i} className="h-4 bg-gray-200 rounded w-full animate-pulse" />
                                        ))}
                                    </div>
                                ) : (
                                    // Other sections loading
                                    <div className="space-y-12">
                                        {[...Array(3)].map((_, subIndex) => (
                                            <div key={subIndex} className="mb-8">
                                                <div className="h-6 bg-gray-200 rounded w-1/4 mb-6 animate-pulse" />
                                                <div className="space-y-4">
                                                    {[...Array(4)].map((_, i) => (
                                                        <div key={i} className="h-4 bg-gray-200 rounded w-full animate-pulse" />
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CelebrityWikiLoading;