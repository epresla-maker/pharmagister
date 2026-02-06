"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import RouteGuard from '@/app/components/RouteGuard';
import RSSFeedDisplay from '@/app/components/RSSFeedDisplay';
import { ArrowLeft, TestTube } from 'lucide-react';

// Admin e-mail címek
const ADMIN_EMAILS = ['epresla@icloud.com'];
const ADMINKA_EMAILS = ['etinatina22@gmail.com'];

export default function RSSTestPage() {
  const { user, userData, loading } = useAuth();
  const router = useRouter();

  // Hozzáférés ellenőrzés - csak admin/adminka
  useEffect(() => {
    if (!loading && user) {
      const isAdmin = ADMIN_EMAILS.includes(user.email);
      const isAdminka = ADMINKA_EMAILS.includes(user.email);
      
      if (!isAdmin && !isAdminka) {
        router.replace('/');
      }
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  // Ha nem admin/adminka, ne mutassunk semmit (redirect fog történni)
  if (!ADMIN_EMAILS.includes(user?.email) && !ADMINKA_EMAILS.includes(user?.email)) {
    return null;
  }

  return (
    <RouteGuard>
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 pb-20">
        {/* Header */}
        <div className="sticky top-0 bg-purple-600 dark:bg-purple-700 border-b border-purple-700 dark:border-purple-800 z-10 shadow-lg">
          <div className="max-w-xl mx-auto px-4 py-3">
            {/* Vissza gomb */}
            <button
              onClick={() => router.back()}
              className="text-white hover:text-purple-200 flex items-center gap-2 mb-3 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium">Vissza</span>
            </button>

            {/* Cím */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-white flex items-center gap-2">
                  <TestTube className="w-6 h-6" />
                  RSS Feed Teszt
                </h1>
                <p className="text-purple-200 text-sm mt-1">
                  Tesztelési környezet - csak adminok látják
                </p>
              </div>
              
              {/* Profile pic */}
              <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white">
                {userData?.photoURL ? (
                  <img 
                    src={userData.photoURL} 
                    alt="Profile" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-purple-400 flex items-center justify-center text-white font-bold">
                    {userData?.displayName?.[0] || 'A'}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Figyelmeztető banner */}
        <div className="max-w-xl mx-auto px-4 py-4">
          <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">🧪</span>
              <div>
                <h3 className="font-semibold text-yellow-800 dark:text-yellow-300">
                  Tesztelési oldal
                </h3>
                <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">
                  Itt láthatod az RSS feed-ből érkező híreket a Semmelweis Egyetemről.
                  Jelenleg csak gyógyszerészet és egészségügy témájú hírek.
                </p>
                <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-2">
                  ✓ Csak admin és adminka látja<br />
                  ✓ Automatikus frissítés 5 percenként<br />
                  ✓ Biztonságos tesztelési környezet
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* RSS Feed */}
        <div className="max-w-xl mx-auto px-4">
          <RSSFeedDisplay />
        </div>
      </div>
    </RouteGuard>
  );
}
