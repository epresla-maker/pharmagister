"use client";
import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import BottomNavigation from './BottomNavigation';

function GlobalBottomNav() {
  const [showBottomNav, setShowBottomNav] = useState(true);
  const lastScrollY = useRef(0);
  const pathname = usePathname();
  const { user, loading } = useAuth();

  // Chat oldalakon (lista és room) ne jelenjen meg - a chat lista saját navbart használ
  const isChatPage = pathname?.startsWith('/chat');

  // Memoized scroll handler - no state dependency to avoid re-creating
  const handleScroll = useCallback(() => {
    const currentScrollY = window.scrollY;
    
    if (currentScrollY < lastScrollY.current) {
      setShowBottomNav(true);
    } else if (currentScrollY > lastScrollY.current && currentScrollY > 100) {
      setShowBottomNav(false);
    }
    
    lastScrollY.current = currentScrollY;
  }, []);

  useEffect(() => {
    if (!user || loading) return;
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, [user, loading, handleScroll]);

  // Ne renderelj semmit ha nincs user vagy chat oldalon vagyunk
  if (!user || loading || isChatPage) {
    return null;
  }

  return <BottomNavigation isVisible={showBottomNav} />;
}

export default memo(GlobalBottomNav);
