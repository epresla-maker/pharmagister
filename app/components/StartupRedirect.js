"use client";
import { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';

// Ez a komponens biztosítja, hogy az app mindig a főoldalon induljon
// amikor a felhasználó bezárja és újra megnyitja az alkalmazást
// CSAK PWA módban működik, böngészőben nem
export default function StartupRedirect() {
  const router = useRouter();
  const pathname = usePathname();
  const hasRedirected = useRef(false);

  useEffect(() => {
    // Csak egyszer fusson le az app indulásakor
    if (hasRedirected.current) return;
    hasRedirected.current = true;

    // Ellenőrizzük, hogy PWA módban vagyunk-e
    const isPWA = window.matchMedia('(display-mode: standalone)').matches || 
                  window.navigator.standalone === true;
    
    // Ha nem PWA mód, ne irányítsunk át
    if (!isPWA) {
      return;
    }

    // Ne irányítsuk át ha publikus oldalon van (még nem lépett be, vagy token link)
    const publicRoutes = ['/login', '/register', '/verify-email', '/privacy', '/forgot-password', '/set-password', '/account-action', '/maintenance', '/child-safety'];
    if (publicRoutes.some(route => pathname?.startsWith(route))) {
      return;
    }

    // Ha nem a főoldalon van, irányítsuk át
    if (pathname !== '/') {
      router.replace('/');
    }
  }, []);

  return null;
}
