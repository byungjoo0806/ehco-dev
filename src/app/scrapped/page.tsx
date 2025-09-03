'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getUserScrappedEvents, removeFromScrappedEvents, ScrappedEventItem } from '@/lib/scrapping-service';
import Link from 'next/link';
import { Bookmark, Trash2, Calendar, Tag, ExternalLink, BookmarkX } from 'lucide-react';

// 1. Define a specific type for the eventGroup object
interface TimelinePoint {
  date: string;
  description: string;
  sourceIds?: string[];
  sources?: { id?: string }[];
}

interface EventGroup {
  title?: string;
  name?: string;
  event?: string;
  date?: string;
  year?: string | number;
  period?: string;
  event_title?: string;
  event_summary?: string;
  event_years?: number[];
  timeline_points?: TimelinePoint[];
}

export default function ScrappedEventsPage() {
  const { user, loading: authLoading } = useAuth();
  const [scrappedEvents, setScrappedEvents] = useState<ScrappedEventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [filterBy, setFilterBy] = useState<'all' | 'figure' | 'category'>('all');
  const [selectedFilter, setSelectedFilter] = useState<string>('');

  useEffect(() => {
    const loadScrappedEvents = async () => {
      if (user) {
        try {
          const userScrappedEvents = await getUserScrappedEvents(user.uid);
          setScrappedEvents(userScrappedEvents);
        } catch (error) {
          console.error('Error loading scrapped events:', error);
        }
      }
      setLoading(false);
    };

    if (!authLoading) {
      loadScrappedEvents();
    }
  }, [user, authLoading]);

  const handleRemoveScrappedEvent = async (scrappedEventId: string) => {
    if (!user) return;

    setRemovingId(scrappedEventId);
    try {
      await removeFromScrappedEvents(user.uid, scrappedEventId);
      setScrappedEvents(prev => prev.filter(event => event.id !== scrappedEventId));
    } catch (error) {
      console.error('Error removing scrapped event:', error);
    } finally {
      setRemovingId(null);
    }
  };

  // Get unique figures and categories for filtering
  const uniqueFigures = Array.from(new Set(scrappedEvents.map(event => event.figureId)))
    .map(figureId => {
      const event = scrappedEvents.find(e => e.figureId === figureId);
      return { id: figureId, name: event?.figureName || figureId };
    });

  const uniqueCategories = Array.from(new Set(scrappedEvents.map(event => event.mainCategory)));

  // Filter events based on selected filter
  const filteredEvents = scrappedEvents.filter(event => {
    if (filterBy === 'figure' && selectedFilter) {
      return event.figureId === selectedFilter;
    }
    if (filterBy === 'category' && selectedFilter) {
      return event.mainCategory === selectedFilter;
    }
    return true;
  });

  // Format event group for display
  // 2. Replaced 'any' with the 'EventGroup' type
  const formatEventGroup = (eventGroup: EventGroup) => {
    if (eventGroup.title) return eventGroup.title;
    if (eventGroup.name) return eventGroup.name;
    if (eventGroup.event) return eventGroup.event;
    return 'Event Group';
  };

  // 3. Replaced 'any' with the 'EventGroup' type
  const formatEventDate = (eventGroup: EventGroup) => {
    if (eventGroup.date) return eventGroup.date;
    if (eventGroup.year) return eventGroup.year;
    if (eventGroup.period) return eventGroup.period;
    return null;
  };

  // Show loading spinner while auth is loading
  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your scrapped events...</p>
        </div>
      </div>
    );
  }

  // Show login prompt if user is not authenticated
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg p-8 max-w-md w-full text-center shadow-lg">
          <BookmarkX className="mx-auto mb-4 text-blue-400" size={64} />
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Your Scrapped Events</h1>
          <p className="text-gray-600 mb-6">Sign in to see your saved event groups and access them anytime.</p>
          <div className="space-y-3">
            <Link
              href="/login"
              className="block w-full bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="block w-full bg-gray-100 text-gray-800 font-semibold py-3 px-4 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Create Account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-4 lg:p-6">
        {/* Header */}
        <div className="bg-white rounded-lg p-6 mb-6 shadow-md">
          <div className="flex items-center gap-3 mb-4">
            <Bookmark className="text-blue-500 fill-blue-500" size={32} />
            <h1 className="text-3xl font-bold text-gray-900">Your Scrapped Events</h1>
          </div>
          <p className="text-gray-600 mb-4">
            {scrappedEvents.length === 0
              ? "You haven't scrapped any event groups yet. Start exploring timelines and save interesting events!"
              : `You have ${scrappedEvents.length} event group${scrappedEvents.length === 1 ? '' : 's'} scrapped.`
            }
          </p>

          {/* Filters */}
          {scrappedEvents.length > 0 && (
            <div className="flex flex-wrap gap-4 items-center">
              <select
                value={filterBy}
                onChange={(e) => {
                  setFilterBy(e.target.value as 'all' | 'figure' | 'category');
                  setSelectedFilter('');
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="all">All Events</option>
                <option value="figure">Filter by Figure</option>
                <option value="category">Filter by Category</option>
              </select>

              {filterBy === 'figure' && (
                <select
                  value={selectedFilter}
                  onChange={(e) => setSelectedFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">Select Figure</option>
                  {uniqueFigures.map(figure => (
                    <option key={figure.id} value={figure.id}>{figure.name}</option>
                  ))}
                </select>
              )}

              {filterBy === 'category' && (
                <select
                  value={selectedFilter}
                  onChange={(e) => setSelectedFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">Select Category</option>
                  {uniqueCategories.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              )}
            </div>
          )}
        </div>

        {/* Scrapped Events Grid */}
        {filteredEvents.length === 0 ? (
          <div className="bg-white rounded-lg p-12 text-center shadow-md">
            <Bookmark className="mx-auto mb-4 text-gray-300" size={64} />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              {scrappedEvents.length === 0 ? "No scrapped events yet" : "No events match your filter"}
            </h3>
            <p className="text-gray-500 mb-6">
              {scrappedEvents.length === 0
                ? "Start exploring figure timelines and click the bookmark icon to save interesting event groups."
                : "Try adjusting your filters or clear them to see all events."
              }
            </p>
            <Link
              href="/all-figures"
              className="inline-block bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Explore Figures
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEvents.map((scrappedEvent) => (
              <div key={scrappedEvent.id} className="bg-white rounded-lg p-6 shadow-md hover:shadow-lg transition-shadow">
                {/* Header with remove button */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Tag className="text-blue-500" size={16} />
                    <span className="text-xs text-blue-600 font-medium bg-blue-50 px-2 py-1 rounded">
                      {scrappedEvent.subcategory}
                    </span>
                  </div>
                  <button
                    onClick={() => handleRemoveScrappedEvent(scrappedEvent.id)}
                    disabled={removingId === scrappedEvent.id}
                    className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                    title="Remove from scrapped events"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {/* Figure Info */}
                <div className="mb-4">
                  <h3 className="font-semibold text-gray-900 text-sm">{scrappedEvent.figureName}</h3>
                  <p className="text-xs text-gray-500">{scrappedEvent.figureNameKr}</p>
                </div>

                {/* Event Group Info */}
                <div className="mb-4">
                  <h4 className="font-medium text-gray-800 mb-2">
                    {formatEventGroup(scrappedEvent.eventGroup)}
                  </h4>

                  {/* Event Date */}
                  {formatEventDate(scrappedEvent.eventGroup) && (
                    <div className="flex items-center gap-1 mb-2">
                      <Calendar size={14} className="text-gray-400" />
                      <span className="text-xs text-gray-600">
                        {formatEventDate(scrappedEvent.eventGroup)}
                      </span>
                    </div>
                  )}

                  {/* Category Path */}
                  <div className="text-xs text-gray-500 mb-3">
                    {scrappedEvent.mainCategory} → {scrappedEvent.subcategory}
                  </div>

                  {/* User Notes */}
                  {scrappedEvent.userNotes && (
                    <div className="bg-gray-50 p-2 rounded text-xs text-gray-600 mb-3">
                      <strong>Notes:</strong> {scrappedEvent.userNotes}
                    </div>
                  )}

                  {/* Tags */}
                  {scrappedEvent.tags && scrappedEvent.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {scrappedEvent.tags.map((tag, index) => (
                        <span key={index} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="space-y-2">
                  {/* View Full Profile Link */}
                  <Link
                    href={`/${scrappedEvent.figureId}`}
                    className="flex items-center justify-center gap-2 w-full bg-blue-600 text-white font-medium py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors text-sm"
                  >
                    <ExternalLink size={16} />
                    View Full Timeline
                  </Link>
                </div>

                {/* Scrapped date */}
                <div className="text-xs text-gray-400 text-center mt-3">
                  Scrapped {new Date(scrappedEvent.scrappedAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}