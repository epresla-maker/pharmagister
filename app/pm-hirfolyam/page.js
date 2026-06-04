"use client";
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import RouteGuard from '../components/RouteGuard';
import ModernServiceFeed from '../components/ModernServiceFeed';
import { ArrowLeft } from 'lucide-react';
import { getClientMarket } from '@/lib/marketI18n';

export default function PmHirfolyamPage() {
  const { user, userData } = useAuth();
  const market = getClientMarket();
  const router = useRouter();

  return (
    <RouteGuard>
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 pb-[40px]">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 z-10 shadow-sm pt-safe-small">
          <div className="max-w-xl mx-auto px-4 py-3 flex items-center min-h-[56px]">
            <button
              onClick={() => router.back()}
              className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-200" />
            </button>
            <h1 className="ml-2 text-lg font-bold text-green-600">
              {market === 'de' ? 'PM Newsfeed' : 'PM hírfolyam'}
            </h1>
          </div>
        </div>

        {/* Feed */}
        <div className="max-w-xl mx-auto">
          <ModernServiceFeed />
        </div>
      </div>
    </RouteGuard>
  );
}
