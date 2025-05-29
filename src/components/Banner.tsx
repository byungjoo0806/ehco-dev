'use client';

import React, { useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Pagination } from 'swiper/modules';
import { useRouter } from 'next/navigation';
import 'swiper/css';
import 'swiper/css/pagination';
import { Loader2, User } from 'lucide-react';

interface PublicFigure {
    id: string;
    name: string;
    gender: string;
    nationality: string;
    occupation: string[];
}

interface BannerProps {
    publicFigures: PublicFigure[];
}

const LoadingOverlay = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg flex items-center space-x-3">
            <Loader2 className="animate-spin text-slate-600 dark:text-white" size={24} />
            <span className="text-slate-600 dark:text-white font-medium">Loading...</span>
        </div>
    </div>
);

const Banner = ({ publicFigures }: BannerProps) => {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const featuredFigures = publicFigures.slice(0, 5); // Get first 5 public figures

    const handleFigureClick = (figureId: string) => {
        setIsLoading(true);
        router.push(`/${figureId}`);
    };

    return (
        <>
            {isLoading && <LoadingOverlay />}
            <div className="w-full h-64 mb-8 rounded-lg overflow-hidden">
                <Swiper
                    modules={[Autoplay, Pagination]}
                    autoplay={{
                        delay: 5000,
                        disableOnInteraction: false,
                    }}
                    pagination={{
                        clickable: true,
                    }}
                    loop={true}
                    className="w-full h-full rounded-lg"
                >
                    {featuredFigures.map((figure) => (
                        <SwiperSlide key={figure.id}>
                            <div
                                className="relative w-full h-full cursor-pointer transition-transform hover:scale-[1.01]"
                                onClick={() => handleFigureClick(figure.id)}
                            >
                                {/* Background */}
                                <div
                                    className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 blur-sm scale-110"
                                />

                                {/* Darkening Overlay */}
                                <div className="absolute inset-0 bg-black/20" />

                                {/* Main Content Container */}
                                <div className="relative h-full flex items-center justify-center px-4">
                                    {/* Profile Icon */}
                                    <div className="flex gap-8 items-center">
                                        <div className="w-40 h-40 flex items-center justify-center bg-white/20 rounded-lg shadow-lg">
                                            <User size={64} className="text-white" />
                                        </div>

                                        {/* Text Content */}
                                        <div className="text-white">
                                            <h2 className="text-3xl font-bold mb-2">
                                                {figure.name}
                                            </h2>
                                            <div className="flex flex-col gap-1">
                                                <p className="text-xl">
                                                    {figure.nationality}
                                                </p>
                                                <p className="text-sm opacity-90">
                                                    {figure.occupation.join(', ')}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </SwiperSlide>
                    ))}
                </Swiper>
            </div>
        </>
    );
};

export default Banner;