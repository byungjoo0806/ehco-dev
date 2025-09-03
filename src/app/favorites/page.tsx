'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getUserFavorites, FavoriteItem, removeFromFavorites } from '@/lib/favorites-service';
import Link from 'next/link';
import Image from 'next/image';
import { Star, User, Trash2, Heart } from 'lucide-react';

export default function FavoritesPage() {
  const { user, loading: authLoading } = useAuth();
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    const loadFavorites = async () => {
      if (user) {
        try {
          const userFavorites = await getUserFavorites(user.uid);
          setFavorites(userFavorites);
        } catch (error) {
          console.error('Error loading favorites:', error);
        }
      }
      setLoading(false);
    };

    if (!authLoading) {
      loadFavorites();
    }
  }, [user, authLoading]);

  const handleRemoveFavorite = async (figureId: string) => {
    if (!user) return;
    
    setRemovingId(figureId);
    try {
      await removeFromFavorites(user.uid, figureId);
      setFavorites(prev => prev.filter(fav => fav.figureId !== figureId));
    } catch (error) {
      console.error('Error removing favorite:', error);
    } finally {
      setRemovingId(null);
    }
  };

  // Show loading spinner while auth is loading
  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your favorites...</p>
        </div>
      </div>
    );
  }

  // Show login prompt if user is not authenticated
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg p-8 max-w-md w-full text-center shadow-lg">
          <Heart className="mx-auto mb-4 text-red-400" size={64} />
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Your Favorites</h1>
          <p className="text-gray-600 mb-6">Sign in to see your saved favorite figures and access them anytime.</p>
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
          <div className="flex items-center gap-3 mb-2">
            <Star className="text-yellow-400 fill-yellow-400" size={32} />
            <h1 className="text-3xl font-bold text-gray-900">Your Favorites</h1>
          </div>
          <p className="text-gray-600">
            {favorites.length === 0 
              ? "You haven't saved any favorites yet. Start exploring and save your favorite figures!"
              : `You have ${favorites.length} favorite${favorites.length === 1 ? '' : 's'} saved.`
            }
          </p>
        </div>

        {/* Favorites Grid */}
        {favorites.length === 0 ? (
          <div className="bg-white rounded-lg p-12 text-center shadow-md">
            <Star className="mx-auto mb-4 text-gray-300" size={64} />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No favorites yet</h3>
            <p className="text-gray-500 mb-6">Start exploring profiles and click the star icon to save your favorites.</p>
            <Link 
              href="/all-figures"
              className="inline-block bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Explore Figures
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {favorites.map((favorite) => (
              <div key={favorite.figureId} className="bg-white rounded-lg p-6 shadow-md hover:shadow-lg transition-shadow">
                {/* Remove button */}
                <div className="flex justify-end mb-4">
                  <button
                    onClick={() => handleRemoveFavorite(favorite.figureId)}
                    disabled={removingId === favorite.figureId}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors disabled:opacity-50"
                    title="Remove from favorites"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>

                {/* Profile Image */}
                <div className="w-24 h-24 mx-auto mb-4 bg-gray-200 rounded-full overflow-hidden flex items-center justify-center">
                  {favorite.profilePic ? (
                    <Image
                      src={favorite.profilePic}
                      alt={favorite.figureName}
                      width={96}
                      height={96}
                      className="w-full h-full object-cover"
                      unoptimized
                    />
                  ) : (
                    <User size={32} className="text-gray-400" />
                  )}
                </div>

                {/* Figure Info */}
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">{favorite.figureName}</h3>
                  <p className="text-sm text-gray-600 mb-4">{favorite.figureNameKr}</p>
                  
                  {/* View Profile Link */}
                  <Link 
                    href={`/${favorite.figureId}`}
                    className="block w-full bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    View Profile
                  </Link>
                </div>

                {/* Added date */}
                <div className="text-xs text-gray-400 text-center mt-3">
                  Added {new Date(favorite.addedAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}