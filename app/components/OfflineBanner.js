"use client";
import { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';
import { getClientMarket } from '@/lib/marketI18n';

export default function OfflineBanner() {
  const market = getClientMarket();
  const [isOnline, setIsOnline] = useState(true);
  const [showBanner, setShowBanner] = useState(false);
  const [justCameBack, setJustCameBack] = useState(false);

  useEffect(() => {
    // Kezdeti állapot
    setIsOnline(navigator.onLine);
    if (!navigator.onLine) setShowBanner(true);

    const handleOffline = () => {
      setIsOnline(false);
      setShowBanner(true);
      setJustCameBack(false);
    };

    const handleOnline = () => {
      setIsOnline(true);
      setJustCameBack(true);
      // 2.5 másodperc után eltűnik az "újra online" üzenet
      setTimeout(() => {
        setShowBanner(false);
        setJustCameBack(false);
      }, 2500);
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  if (!showBanner) return null;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-2 py-3 px-4 text-white text-sm font-medium transition-all duration-300 ${
        justCameBack
          ? 'bg-green-600'
          : 'bg-gray-900'
      }`}
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}
    >
      {justCameBack ? (
        <>
          <span>✓</span>
          <span>{market === 'de' ? 'Wieder online' : 'Újra online'}</span>
        </>
      ) : (
        <>
          <WifiOff size={16} />
          <span>{market === 'de' ? 'Keine Internetverbindung' : 'Nincs internetkapcsolat'}</span>
        </>
      )}
    </div>
  );
}
