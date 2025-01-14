'use client';

import { memo, useMemo, useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface CategoryFilterProps {
  onCategoryChange: (category: string | null) => void;
  onSortChange: (sort: 'newest' | 'oldest') => void;
  selectedCategory: string | null;
  currentSort: 'newest' | 'oldest';
}

const CategoryFilter = memo(function CategoryFilter({
  onCategoryChange,
  selectedCategory,
  onSortChange,
  currentSort
}: CategoryFilterProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);

  const categories = useMemo(() =>
    ['All', 'Music', 'Acting', 'Promotion', 'Social', 'Controversy'],
    []
  );

  const filters = useMemo(() =>
    ['Newest First', 'Oldest First'],
    []
  );

  // Initialize from URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const categoryParam = params.get('category');
      const sortParam = params.get('sort') as 'newest' | 'oldest';

      // Set initial category if it exists in URL
      if (categoryParam && categoryParam !== 'All') {
        onCategoryChange(categoryParam);
      }

      // Set initial sort if it exists in URL
      if (sortParam) {
        onSortChange(sortParam);
      }

      // Set initial URL if parameters don't exist
      if (!params.has('category') || !params.has('sort')) {
        params.set('category', selectedCategory || 'All');
        params.set('sort', currentSort);
        window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
      }
    }
  }, []);

  const handleCategoryClick = (category: string) => {
    const newCategory = category === "All" ? null : category;
    onCategoryChange(newCategory);

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams();
      params.set('category', category);

      const currentParams = new URLSearchParams(window.location.search);
      ['sort', 'page'].forEach(param => {
        if (currentParams.has(param)) {
          params.append(param, currentParams.get(param)!);
        }
      });

      window.history.pushState({}, '', `${window.location.pathname}?${params.toString()}`);
    }

    setIsDropdownOpen(false);
  };

  const handleSortClick = (filter: string) => {
    const newSort = filter === 'Newest First' ? 'newest' : 'oldest';
    onSortChange(newSort);

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams();
      const currentParams = new URLSearchParams(window.location.search);

      // Preserve category first if it exists
      if (currentParams.has('category')) {
        params.set('category', currentParams.get('category')!);
      }

      // Set sort
      params.set('sort', newSort);

      // Add page last if it exists
      if (currentParams.has('page')) {
        params.set('page', currentParams.get('page')!);
      }

      window.history.pushState({}, '', `${window.location.pathname}?${params.toString()}`);
    }
    setIsSortDropdownOpen(false);
  };

  // Memoize the derived values
  const displayCategory = useMemo(() =>
    selectedCategory || "All",
    [selectedCategory]
  );

  const displaySort = useMemo(() =>
    currentSort === 'newest' ? 'Newest First' : 'Oldest First',
    [currentSort]
  );

  const categoryButtons = useMemo(() =>
    categories.map((category) => (
      <button
        key={category}
        onClick={() => handleCategoryClick(category)}
        className={`px-4 py-2 rounded-full text-sm font-medium transition-colors 
          ${(category === 'All' && !selectedCategory) || category === selectedCategory
            ? 'bg-black text-white'
            : 'bg-gray-100 hover:bg-gray-200'}`}
      >
        {category}
      </button>
    )),
    [categories, selectedCategory]
  );

  const filterButtons = useMemo(() =>
    filters.map((filter) => (
      <button
        key={filter}
        onClick={() => handleSortClick(filter)}
        className={`px-4 py-2 rounded-full text-sm font-medium transition-colors 
          ${(filter === 'Newest First' && currentSort === 'newest') ||
            (filter === 'Oldest First' && currentSort === 'oldest')
            ? 'bg-black text-white'
            : 'bg-gray-100 hover:bg-gray-200'}`}
      >
        {filter}
      </button>
    )),
    [filters, currentSort]
  );

  return (
    <div className="mb-6">
      {/* Desktop View - Buttons */}
      <div className="hidden lg:flex flex-wrap items-center gap-2">
        <div>
          {/* Categories Section */}
          <div>
            <p className="text-sm font-medium mb-2">Category</p>
            <div className="flex flex-wrap items-center gap-2">
              {categoryButtons}
            </div>
          </div>
          {/* Filters Section */}
          <div>
            <p className="text-sm font-medium my-2">Filter</p>
            <div className="flex flex-wrap items-center gap-2">
              {filterButtons}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile View - Dropdown and Filter button */}
      <div className="lg:hidden flex justify-between gap-2 items-center">
        <div className="relative flex-1 max-w-[200px]">
          <p className='text-sm pl-1'>Category</p>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="w-full pl-4 pr-2 py-2 bg-gray-100 rounded-lg flex items-center justify-between text-sm font-medium"
          >
            <span className='truncate'>{displayCategory}</span>
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
                  className={`w-full px-4 py-2 text-left text-sm transition-colors 
                    ${(category === 'All' && !selectedCategory) || category === selectedCategory
                      ? 'bg-gray-100 font-medium'
                      : 'hover:bg-gray-50'
                    } ${category !== categories[categories.length - 1] ? 'border-b border-gray-100' : ''}`}
                >
                  {category}
                </button>
              ))}
            </div>
          )}

          {isDropdownOpen && (
            <div
              className="fixed inset-0 z-40 bg-transparent"
              onClick={() => setIsDropdownOpen(false)}
            />
          )}
        </div>
        <div className="relative flex-1 max-w-[200px]">
          <p className='text-sm pl-1'>Filter</p>
          <button
            onClick={() => setIsSortDropdownOpen(!isSortDropdownOpen)}
            className="w-full pl-4 pr-2 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm font-medium whitespace-nowrap flex items-center justify-between gap-2"
          >
            {displaySort}
            <ChevronDown className={`w-4 h-4 transition-transform ${isSortDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {isSortDropdownOpen && (
            <>
              <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-100 z-50 w-[200px]">
                {filters.map((filter) => (
                  <button
                    key={filter}
                    onClick={() => handleSortClick(filter)}
                    className={`w-full px-4 py-2 text-left text-sm transition-colors 
                      ${(filter === 'Newest First' && currentSort === 'newest') ||
                        (filter === 'Oldest First' && currentSort === 'oldest')
                        ? 'bg-gray-100 font-medium'
                        : 'hover:bg-gray-50'} 
                      ${filter !== filters[filters.length - 1] ? 'border-b border-gray-100' : ''}`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
              <div
                className="fixed inset-0 z-40 bg-transparent"
                onClick={() => setIsSortDropdownOpen(false)}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
});

export default CategoryFilter;