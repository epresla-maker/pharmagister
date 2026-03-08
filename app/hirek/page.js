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
        <div className="sticky top-0 bg-purple-400 dark:bg-purple-500 border-b border-purple-500 dark:border-purple-600 z-10 shadow-lg pt-safe-small">
          <div className="max-w-xl mx-auto px-4 py-3">
            {/* Vissza gomb */}
            <button
              onClick={() => router.push('/')}
              className="text-white hover:text-purple-100 flex items-center gap-2 mb-3 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium">Vissza</span>
            </button>

            {/* Cím */}
            <div>
              <h1 className="text-xl font-bold text-white">
                Hírek
              </h1>
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
