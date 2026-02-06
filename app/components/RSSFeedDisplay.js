'use client';

import { useRSSFeed } from '@/hooks/useRSSFeed';
import { ExternalLink, Calendar, User, RefreshCw, AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { hu } from 'date-fns/locale';

export default function RSSFeedDisplay() {
  const { rssPosts, loading, error, refetch } = useRSSFeed();

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 animate-pulse">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
              </div>
            </div>
            <div className="h-40 bg-gray-200 dark:bg-gray-700 rounded-lg mb-3"></div>
            <div className="space-y-2">
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded"></div>
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-red-800 dark:text-red-300 mb-1">
              RSS betöltési hiba
            </h3>
            <p className="text-sm text-red-700 dark:text-red-400 mb-3">
              {error}
            </p>
            <button
              onClick={refetch}
              className="text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Újrapróbálás
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!rssPosts || rssPosts.length === 0) {
    return (
      <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 text-center">
        <p className="text-gray-600 dark:text-gray-400">
          Nincsenek elérhető RSS hírek
        </p>
        <button
          onClick={refetch}
          className="mt-3 text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 flex items-center gap-2 mx-auto"
        >
          <RefreshCw className="w-4 h-4" />
          Újratöltés
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Frissítés gomb */}
      <div className="flex justify-between items-center mb-2">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {rssPosts.length} hír a Semmelweis Egyetemtől
        </p>
        <button
          onClick={refetch}
          className="text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Frissítés
        </button>
      </div>

      {/* RSS hírek */}
      {rssPosts.map((post) => (
        <div
          key={post.id}
          className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow"
        >
          {/* Header */}
          <div className="p-4 pb-3">
            <div className="flex items-start gap-3">
              {/* Semmelweis logo/avatar */}
              <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-lg">S</span>
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {post.creator}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 bg-purple-100 dark:bg-purple-900/30 px-2 py-0.5 rounded-full">
                    RSS Hír
                  </span>
                </div>
                
                {post.pubDate && (
                  <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    <Calendar className="w-3 h-3" />
                    {formatDistanceToNow(new Date(post.pubDate), { 
                      addSuffix: true,
                      locale: hu 
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Kép ha van */}
          {post.imageUrl && (
            <div className="relative w-full bg-gray-100 dark:bg-gray-800" style={{ paddingBottom: '56.25%' }}>
              <img
                src={post.imageUrl}
                alt={post.title}
                className="absolute inset-0 w-full h-full object-cover"
                loading="lazy"
                onError={(e) => {
                  // Ha a kép nem tölt be, elrejtjük
                  e.target.style.display = 'none';
                }}
              />
            </div>
          )}

          {/* Tartalom */}
          <div className="p-4">
            <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100 mb-2">
              {post.title}
            </h3>
            
            {post.description && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-3">
                {post.description}
              </p>
            )}

            {/* Kategóriák */}
            {post.categories && post.categories.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {post.categories.slice(0, 3).map((cat, idx) => (
                  <span 
                    key={idx}
                    className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-1 rounded"
                  >
                    {cat}
                  </span>
                ))}
              </div>
            )}

            {/* Tovább gomb */}
            <a
              href={post.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
            >
              <span>Teljes cikk elolvasása</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}
