// src/components/CustomTabs.tsx
'use client';

import { useEffect, useState } from 'react';

interface TabsProps {
    defaultTab?: string;
    isLoading?: boolean;
    tabs: {
        id: string;
        label: string;
        content: React.ReactNode;
    }[];
}

export default function CustomTabs({ tabs, defaultTab, isLoading }: TabsProps) {
    const [activeTab, setActiveTab] = useState(defaultTab || tabs[0].id);

    if (isLoading) {
        return (
            <div className="w-full">
                {/* Loading Tab Navigation */}
                <div className="w-full flex justify-center items-center">
                    <div className='w-[90%] md:w-[75%] lg:w-[60%]'>
                        <div className="flex">
                            <div className="w-[50%] h-10 bg-gray-100 dark:bg-gray-800 animate-pulse rounded" />
                            <div className="w-[50%] h-10 bg-gray-100 dark:bg-gray-800 animate-pulse rounded" />
                        </div>
                    </div>
                </div>

                {/* Loading Tab Content */}
                <div className="mt-4">
                    <div className="w-full h-64 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-lg" />
                </div>
            </div>
        );
    }

    return (
        <div className="w-full">
            {/* Tab Navigation */}
            <div className="w-full flex justify-center items-center">
                <div className='w-[90%] md:w-[75%] lg:w-[60%]'>
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`w-[50%] px-4 py-2 text-sm font-medium ${activeTab === tab.id
                                    ? 'border-b-2 border-blue-500 text-blue-600'
                                    : 'text-gray-500 hover:text-gray-700 border-b border-gray-200'
                                }`}
                            role="tab"
                            aria-selected={activeTab === tab.id}
                            aria-controls={`tabpanel-${tab.id}`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tab Content */}
            <div className="mt-4">
                {tabs.map((tab) => (
                    <div
                        key={tab.id}
                        role="tabpanel"
                        id={`tabpanel-${tab.id}`}
                        className={`${activeTab === tab.id ? 'block' : 'hidden'}`}
                    >
                        {tab.content}
                    </div>
                ))}
            </div>
        </div>
    );
}