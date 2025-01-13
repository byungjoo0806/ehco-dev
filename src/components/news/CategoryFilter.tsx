'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface CategoryFilterProps {
  onCategoryChange: (category: string | null) => void;
}

export default function CategoryFilter({ onCategoryChange }: CategoryFilterProps) {
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const categories = ['All', 'Music', 'Acting', 'Promotion', 'Social', 'Controversy'];

  const handleCategoryClick = (category: string) => {
    setActiveCategory(category);
    setIsDropdownOpen(false);
    // If "All" is selected, pass null to show everything
    onCategoryChange(category === 'All' ? null : category);
  };

  return (
    <div className="mb-6">
      {/* Desktop View - Buttons */}
      <div className="hidden md:flex flex-wrap items-center gap-2">
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => handleCategoryClick(category)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${activeCategory === category
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

      {/* Mobile View - Dropdown and Filter button */}
      <div className="md:hidden flex justify-between gap-2 items-center">
        <div className="relative flex-1 max-w-[200px]">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="w-full px-4 py-2 bg-gray-100 rounded-lg flex items-center justify-between text-sm font-medium"
          >
            <span>{activeCategory}</span>
            <ChevronDown
              className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {isDropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-100 z-50">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => handleCategoryClick(category)}
                  className={`w-full px-4 py-2 text-left text-sm transition-colors ${activeCategory === category
                      ? 'bg-gray-100 font-medium'
                      : 'hover:bg-gray-50'
                    } ${category !== categories[categories.length - 1] ? 'border-b border-gray-100' : ''}`}
                >
                  {category}
                </button>
              ))}
            </div>
          )}

          {/* Overlay to close dropdown when clicking outside */}
          {isDropdownOpen && (
            <div
              className="fixed inset-0 z-40 bg-transparent"
              onClick={() => setIsDropdownOpen(false)}
            />
          )}
        </div>
        <button
          className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm font-medium whitespace-nowrap"
        >
          Filter
        </button>
      </div>
    </div>
  );
}