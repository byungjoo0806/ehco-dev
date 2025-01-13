'use client';

import { useState } from 'react';

interface CategoryFilterProps {
  onCategoryChange: (category: string | null) => void;
}

export default function CategoryFilter({ onCategoryChange }: CategoryFilterProps) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  
  const categories = ['All', 'Music', 'Acting', 'Promotion', 'Social', 'Controversy'];

  const handleCategoryClick = (category: string) => {
    const newCategory = activeCategory === category ? null : category;
    setActiveCategory(newCategory);
    // If "All" is selected or no category is selected (null), pass null to show everything
    onCategoryChange(newCategory === 'All' ? null : newCategory);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 mb-6">
      {categories.map((category) => (
        <button
          key={category}
          onClick={() => handleCategoryClick(category)}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            activeCategory === category
              ? 'bg-black text-white'
              : 'bg-gray-100 hover:bg-gray-200'
          }`}
        >
          {category}
        </button>
      ))}
      <button 
        className="ml-auto px-4 py-2 rounded-full bg-gray-100 hover:bg-gray-200 text-sm font-medium"
      >
        Filter
      </button>
    </div>
  );
}