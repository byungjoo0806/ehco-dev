'use client';

import React, { useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Pagination } from 'swiper/modules';
import { useRouter } from 'next/navigation';
import 'swiper/css';
import 'swiper/css/pagination';
import { Loader2 } from 'lucide-react';

interface Celebrity {
    id: string;
    name: string;
    profilePic: string;
    nationality: string;
    koreanName: string;
    birthDate: string;
    company: string;
}

interface BannerProps {
    celebrities: Celebrity[];
}

const LoadingOverlay = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg flex items-center space-x-3">
            <Loader2 className="animate-spin text-slate-600 dark:text-white" size={24} />
            <span className="text-slate-600 dark:text-white font-medium">Loading...</span>
        </div>
    </div>
);

const Banner = ({ celebrities }: BannerProps) => {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const featuredCelebrities = celebrities.slice(0, 5); // Get first 5 celebrities

    const handleCelebrityClick = (celebrityId: string) => {
        setIsLoading(true);
        router.push(`/${celebrityId}?category=All&sort=newest&page=1`);
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
                    {featuredCelebrities.map((celebrity) => (
                        <SwiperSlide key={celebrity.id}>
                            <div
                                className="relative w-full h-full cursor-pointer transition-transform hover:scale-[1.01]"
                                onClick={() => handleCelebrityClick(celebrity.id)}
                            >
                                {/* Blurred Background */}
                                <div
                                    className="absolute inset-0 bg-cover bg-center blur-xl scale-110"
                                    style={{
                                        backgroundImage: `url(${celebrity.profilePic || '/api/placeholder/1200/400'})`,
                                    }}
                                />

                                {/* Darkening Overlay */}
                                <div className="absolute inset-0 bg-black/30" />

                                {/* Main Content Container */}
                                <div className="relative h-full flex items-center justify-center px-4">
                                    {/* Main Sharp Image */}
                                    <div className="flex gap-8 items-center">
                                        <img
                                            src={celebrity.profilePic || '/api/placeholder/400/400'}
                                            alt={celebrity.name}
                                            className="w-40 h-40 object-cover rounded-lg shadow-lg"
                                        />

                                        {/* Text Content */}
                                        <div className="text-white">
                                            <h2 className="text-3xl font-bold mb-2">
                                                {celebrity.name}
                                            </h2>
                                            <div className="flex flex-col gap-1">
                                                <p className="text-xl">
                                                    {celebrity.koreanName}
                                                </p>
                                                <p className="text-sm opacity-90">
                                                    {celebrity.company}
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