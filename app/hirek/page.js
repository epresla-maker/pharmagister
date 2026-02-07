"use client";
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import RouteGuard from '@/app/components/RouteGuard';
import RSSFeedDisplay from '@/app/components/RSSFeedDisplay';
import { ArrowLeft, Home } from 'lucide-react';

export default function HirekPage() {
  const { user, userData } = useAuth();
  const router = useRouter();

  return (
    <RouteGuard>
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 pb-[40px]">
        {/* Sticky Header */}
        <div className="sticky top-0 bg-purple-600 dark:bg-purple-700 border-b border-purple-700 dark:border-purple-800 z-10 shadow-lg">
          <div className="max-w-xl mx-auto px-4 py-3">
            {/* Vissza gomb */}
            <button
              onClick={() => router.push('/')}
              className="text-white hover:text-purple-200 flex items-center gap-2 mb-3 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium">Vissza</span>
            </button>

            {/* Cím és vissza a hírfolyam gomb */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-white">
                  Hírek
                </h1>
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
                    {userData?.displayName?.[0] || 'P'}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Pharmagister hírfolyam gomb */}
        <div className="max-w-xl mx-auto px-4 pt-4 pb-2">
          <button
            onClick={() => router.push('/')}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors shadow-md"
          >
            <Home className="w-5 h-5" />
            <span>Pharmagister hírfolyam</span>
          </button>
        </div>

        {/* RSS Hírek */}
        <div className="max-w-xl mx-auto px-4 pt-4">
          <RSSFeedDisplay />
        </div>
      </div>
    </RouteGuard>
  );
}
