'use client';

// src/components/Header.tsx
import { Menu, Search } from 'lucide-react';
import Link from 'next/link';
import SlidingMenu from './SlidingMenu';
import { useState } from 'react';

export default function Header() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <header className="border-b">
        <div className="container mx-auto px-4 h-16 flex items-center justify-center">
          <div className='w-1/3 flex justify-start items-center pl-10'>
            <Menu onClick={() => setIsOpen(!isOpen)} className='cursor-pointer' />
          </div>

          <div className='w-1/3 flex justify-center items-center'>
            <Link href="/" className="text-2xl font-bold text-key-color">
              EHCO
            </Link>
          </div>

          <div className="w-1/3 flex justify-end">
            <div className='w-[70%] relative flex flex-row items-center'>
              <Search className="absolute left-3 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search Echo"
                className="pl-10 pr-4 py-2 border rounded-lg w-full"
              />
            </div>
          </div>
        </div>
      </header>

      <SlidingMenu 
        isOpen={isOpen} 
        onClose={() => setIsOpen(false)} 
      />
    </>
  );
}