import React from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';

interface BannerArticle {
    id: string;
    title: string;
    content: string;
    thumbnail?: string;
    url: string;
}

interface BannerProps {
    articles: BannerArticle[];
}

const Banner = ({ articles }: BannerProps) => {
    const recentArticles = articles.slice(0, 5); // Get 5 most recent articles

    const handleArticleClick = (url: string) => {
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    return (
        <div className="w-full h-64 mb-8 rounded-lg">
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
                {recentArticles.map((article) => (
                    <SwiperSlide key={article.id}>
                        <div
                            className="relative w-full h-full cursor-pointer transition-transform hover:scale-[1.01]"
                            onClick={() => handleArticleClick(article.url)}
                        >
                            {/* Background Image */}
                            <div
                                className="absolute inset-0 bg-cover bg-center"
                                style={{
                                    backgroundImage: `url(${article.thumbnail || '/api/placeholder/1200/400'})`,
                                }}
                            >
                                {/* Gradient Overlay */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent opacity-60" />
                            </div>

                            {/* Content */}
                            <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                                <h2 className="text-xl font-bold mb-2 line-clamp-1">
                                    {article.title}
                                </h2>
                                <p className="text-sm line-clamp-2">
                                    {article.content}
                                </p>
                            </div>
                        </div>
                    </SwiperSlide>
                ))}
            </Swiper>
        </div>
    );
};

export default Banner;