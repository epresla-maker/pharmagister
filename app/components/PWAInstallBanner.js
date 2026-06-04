"use client";
import { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { X, Download, Smartphone } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { getClientMarket } from '@/lib/marketI18n';

export default function PWAInstallBanner() {
  const pathname = usePathname();
  const market = getClientMarket();
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Ha Capacitor natív app-ban fut, ne mutassuk a bannert
    const platform = Capacitor.getPlatform();
    const isNativeApp = platform === 'ios' || platform === 'android';
    
    if (isNativeApp) {
      console.log('🚀 Natív Capacitor app - PWA banner elrejtve');
      return;
    }

    // Karbantartás oldalon ne jelenjen meg
    if (pathname === '/maintenance') {
      return;
    }

    // Ellenőrizzük, hogy már standalone módban van-e (telepítve)
    const standalone = window.matchMedia('(display-mode: standalone)').matches 
      || window.navigator.standalone 
      || document.referrer.includes('android-app://');
    setIsStandalone(standalone);

    // iOS detektálás
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(iOS);

    // Ha már telepítve van, ne mutassuk
    if (standalone) {
      return;
    }

    // Ellenőrizzük, mikor utasította el utoljára a felhasználó
    const lastDismissed = localStorage.getItem('pwa-install-dismissed');
    if (lastDismissed) {
      const dismissedTime = parseInt(lastDismissed);
      const hoursSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60);
      // 24 óránként mutassuk újra
      if (hoursSinceDismissed < 24) {
        return;
      }
    }

    // beforeinstallprompt esemény (Android/Chrome)
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // iOS-en nincs beforeinstallprompt, de mutassuk a bannert (csak ha NEM natív app!)
    if (iOS && !isNativeApp) {
      // Kis késleltetéssel jelenjen meg
      const timer = setTimeout(() => {
        setShowBanner(true);
      }, 2000);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      };
    }

    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, [pathname]);

  const handleInstall = useCallback(async () => {
    if (deferredPrompt) {
      // Android/Chrome - natív prompt
      try {
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
          setShowBanner(false);
        }
        setDeferredPrompt(null);
      } catch (err) {
        console.error('Install error:', err);
      }
    }
  }, [deferredPrompt]);

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  // Ne mutassuk, ha nincs szükség rá
  if (!showBanner || isStandalone) {
    return null;
  }

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 animate-slide-up">
      <div className="bg-gradient-to-r from-green-600 to-cyan-600 rounded-2xl shadow-2xl p-4 mx-auto max-w-md">
        {/* Bezárás gomb */}
        <button 
          onClick={handleDismiss}
          className="absolute top-2 right-2 p-1 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
        >
          <X className="w-5 h-5 text-white" />
        </button>

        <div className="flex items-start gap-4">
          {/* Ikon */}
          <div className="flex-shrink-0 w-14 h-14 bg-white rounded-xl flex items-center justify-center shadow-lg">
            <Smartphone className="w-8 h-8 text-green-600" />
          </div>

          {/* Tartalom */}
          <div className="flex-1 pr-6">
            <h3 className="text-white font-bold text-lg mb-1">
              {market === 'de' ? 'Installiere die App!' : 'Telepítsd az alkalmazást!'}
            </h3>
            <p className="text-white/90 text-sm mb-3">
              {isIOS 
                ? (market === 'de' ? 'Schneller Zugriff vom Homescreen, Benachrichtigungen und Offline-Nutzung.' : 'Gyors hozzáférés a kezdőképernyőről, értesítések és offline működés.')
                : (market === 'de' ? 'Ein Klick und du erreichst sie direkt vom Homescreen!' : 'Egyetlen kattintás és eléred a kezdőképernyőről!')
              }
            </p>

            {isIOS ? (
              // iOS utasítások
              <div className="bg-white/20 rounded-lg p-3">
                <p className="text-white text-xs font-medium mb-2">{market === 'de' ? '📱 Installation in iOS Safari:' : '📱 Telepítés iOS Safari-ban:'}</p>
                <ol className="text-white/90 text-xs space-y-1">
                  <li>{market === 'de' ? '1. Tippe unten auf die' : '1. Koppints a'} <span className="font-bold">⋯ {market === 'de' ? 'drei Punkte' : 'három pontra'}</span> {market === 'de' ? '' : 'alul'}</li>
                  <li>{market === 'de' ? '2. Waehle' : '2. Válaszd a'} <span className="font-bold">{market === 'de' ? 'Teilen' : 'Megosztás'}</span> {market === 'de' ? '' : 'opciót'}</li>
                  <li>{market === 'de' ? '3. Scrolle und tippe auf' : '3. Görgess és koppints a'} <span className="font-bold">{market === 'de' ? 'Mehr' : 'Továbbiak'}</span> {market === 'de' ? '' : 'gombra'}</li>
                  <li>{market === 'de' ? '4. Waehle die Option' : '4. Válaszd a'} <span className="font-bold">{market === 'de' ? '"Zum Home-Bildschirm"' : '"Főképernyőhöz adás"'}</span></li>
                </ol>
              </div>
            ) : (
              // Android/Chrome telepítés gomb
              <button
                onClick={handleInstall}
                className="w-full bg-white text-green-600 font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 hover:bg-green-50 transition-colors shadow-lg"
              >
                <Download className="w-5 h-5" />
                {market === 'de' ? 'Jetzt installieren' : 'Telepítés most'}
              </button>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(100px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.4s ease-out;
        }
      `}</style>
    </div>
  );
}
