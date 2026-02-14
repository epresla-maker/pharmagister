"use client";
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import RouteGuard from './components/RouteGuard';
import ModernServiceFeed from './components/ModernServiceFeed';
import { LayoutGrid, Pencil } from 'lucide-react';

export default function HomePage() {
  const { user, userData, loading } = useAuth();
  const router = useRouter();
  const [showMiClyps, setShowMiClyps] = useState(true);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const ticking = useRef(false);

  useEffect(() => {
    const handleScroll = () => {
      if (!ticking.current) {
        window.requestAnimationFrame(() => {
          if (window.scrollY < 50) {
            setShowMiClyps(true);
          } else {
            setShowMiClyps(false);
          }
          ticking.current = false;
        });
        ticking.current = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <RouteGuard>
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 pb-[40px]">
        {/* Sticky Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 z-10 shadow-sm pt-safe-small">
          <div className="max-w-xl mx-auto px-4 py-3 flex items-center justify-between min-h-[56px] relative">
            {/* Logo - központosítva */}
            <h1 className="absolute left-1/2 -translate-x-1/2 text-lg sm:text-xl font-bold flex items-center gap-1 flex-shrink-0">
              <span className="text-green-600 text-lg sm:text-xl">Pharmagister</span>
            </h1>

            {/* Profile Button - navigál a saját profilra */}
            <div className="relative ml-auto z-10">
              <button
                onClick={() => user && router.push(`/profil/${user.uid}`)}
                className="w-10 h-10 rounded-full overflow-hidden border-2 border-green-500 hover:border-green-600 transition-colors"
              >
                {userData?.photoURL ? (
                  <img 
                    src={userData.photoURL} 
                    alt="Profile" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-green-500 flex items-center justify-center text-white font-bold">
                    {userData?.displayName?.[0] || 'P'}
                  </div>
                )}
              </button>
            </div>
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
