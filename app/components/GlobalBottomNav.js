"use client";
import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import BottomNavigation from './BottomNavigation';

function GlobalBottomNav() {
  const [showBottomNav, setShowBottomNav] = useState(true);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);
  const pathname = usePathname();
  const { user, loading } = useAuth();

  useEffect(() => {
    const open = () => setCalendarOpen(true);
    const close = () => setCalendarOpen(false);
    window.addEventListener('calendar-overlay-open', open);
    window.addEventListener('calendar-overlay-close', close);
    return () => {
      window.removeEventListener('calendar-overlay-open', open);
      window.removeEventListener('calendar-overlay-close', close);
    };
  }, []);

  // Chat oldalakon és post detail oldalakon ne jelenjen meg
  const isChatPage = pathname?.startsWith('/chat');
  const isPostDetailPage = pathname?.startsWith('/post/');

  // Throttled scroll handler with RAF
  const handleScroll = useCallback(() => {
    if (!ticking.current) {
      window.requestAnimationFrame(() => {
        const currentScrollY = window.scrollY;
        
        if (currentScrollY < lastScrollY.current) {
          setShowBottomNav(true);
        } else if (currentScrollY > lastScrollY.current && currentScrollY > 100) {
          setShowBottomNav(false);
        }
        
        lastScrollY.current = currentScrollY;
        ticking.current = false;
      });
      
      ticking.current = true;
    }
  }, []);

  useEffect(() => {
    if (!user || loading) return;
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, [user, loading, handleScroll]);

  // Ne renderelj semmit ha nincs user, chat oldalon vagy post detail oldalon vagyunk
  if (!user || loading || isChatPage || isPostDetailPage || calendarOpen) {
    return null;
  }

  return <BottomNavigation isVisible={showBottomNav} />;
}

export default memo(GlobalBottomNav);
