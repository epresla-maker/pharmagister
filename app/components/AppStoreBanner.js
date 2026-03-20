"use client";
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { X } from 'lucide-react';
import { Capacitor } from '@capacitor/core';

// --- IDE ÍRD BE A VALÓS LINKEKET ---
const APP_STORE_URL = 'https://apps.apple.com/hu/app/pharmagister/id6759405794?l=hu';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.pharmagister.app';

// Ha a Google Play jóváhagyás megvan, állítsd true-ra
const PLAY_STORE_LIVE = false;

const AppleLogo = ({ className }) => (
  <svg className={className} viewBox="0 0 384 512" fill="currentColor">
    <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5c0 26.2 4.8 53.3 14.4 81.2 12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/>
  </svg>
);

const PlayStoreLogo = ({ className }) => (
  <svg className={className} viewBox="0 0 512 512" fill="none">
    <path d="M325.3 234.3L104.6 13l280.8 161.2-60.1 60.1zM47 0C34 6.8 25.3 19.2 25.3 35.3v441.3c0 16.1 8.7 28.5 21.7 35.3l256.6-256L47 0zm425.2 225.6l-58.9-34.1-65.7 64.5 65.7 64.5 60.1-34.1c18-14.3 18-46.5-1.2-60.8zM104.6 499l280.8-161.2-60.1-60.1L104.6 499z" fill="url(#playGrad)"/>
    <defs>
      <linearGradient id="playGrad" x1="25.3" y1="0" x2="512" y2="512">
        <stop offset="0%" stopColor="#00C3FF"/>
        <stop offset="25%" stopColor="#00E176"/>
        <stop offset="50%" stopColor="#FFDD00"/>
        <stop offset="100%" stopColor="#FF3A44"/>
      </linearGradient>
    </defs>
  </svg>
);

export default function AppStoreBanner() {
  const pathname = usePathname();
  const [showBanner, setShowBanner] = useState(false);
  const [platform, setPlatform] = useState(null);

  useEffect(() => {
    const capPlatform = Capacitor.getPlatform();
    if (capPlatform === 'ios' || capPlatform === 'android') return;

    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone;
    if (standalone) return;

    if (pathname === '/maintenance') return;

    const lastDismissed = localStorage.getItem('app-store-banner-dismissed');
    if (lastDismissed) {
      const hoursSince = (Date.now() - parseInt(lastDismissed)) / (1000 * 60 * 60);
      if (hoursSince < 72) return;
    }

    const ua = navigator.userAgent;
    if (/iPad|iPhone|iPod/.test(ua) && !window.MSStream) {
      setPlatform('ios');
    } else if (/Android/.test(ua)) {
      setPlatform('android');
    } else {
      setPlatform('desktop');
    }

    const timer = setTimeout(() => setShowBanner(true), 1500);
    return () => clearTimeout(timer);
  }, [pathname]);

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem('app-store-banner-dismissed', Date.now().toString());
  };

  if (!showBanner) return null;

  // Mobil: egy gomb a megfelelő store-hoz
  if (platform === 'ios' || platform === 'android') {
    const isIOS = platform === 'ios';
    const storeUrl = isIOS ? APP_STORE_URL : PLAY_STORE_URL;
    const isDisabled = !isIOS && !PLAY_STORE_LIVE;

    return (
      <div className="fixed top-0 left-0 right-0 z-[60] animate-slide-down">
        <div className="bg-gradient-to-r from-purple-700 to-indigo-600 shadow-lg px-4 py-3">
          <div className="flex items-center gap-3 max-w-md mx-auto">
            <div className="flex-shrink-0 w-10 h-10 bg-white rounded-xl flex items-center justify-center">
              {isIOS
                ? <AppleLogo className="w-6 h-6 text-gray-900" />
                : <PlayStoreLogo className="w-6 h-6" />
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm">Pharmagister app</p>
              <p className="text-white/80 text-xs">
                {isDisabled
                  ? 'Hamarosan elérhető a Google Play-en!'
                  : `Töltsd le ${isIOS ? 'az App Store' : 'a Google Play'}-ból!`
                }
              </p>
            </div>
            {isDisabled ? (
              <span className="flex-shrink-0 bg-gray-400 text-white font-bold text-sm py-2 px-4 rounded-lg cursor-not-allowed opacity-70">
                Hamarosan
              </span>
            ) : (
              <a
                href={storeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 bg-white text-purple-700 font-bold text-sm py-2 px-4 rounded-lg hover:bg-purple-50 transition-colors"
              >
                Letöltés
              </a>
            )}
            <button
              onClick={handleDismiss}
              className="flex-shrink-0 p-1 rounded-full hover:bg-white/20 transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        <style jsx>{`
          @keyframes slide-down {
            from { opacity: 0; transform: translateY(-100%); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-slide-down { animation: slide-down 0.3s ease-out; }
        `}</style>
      </div>
    );
  }

  // Desktop: mindkét store gomb
  return (
    <div className="fixed top-0 left-0 right-0 z-[60] animate-slide-down">
      <div className="bg-gradient-to-r from-purple-700 to-indigo-600 shadow-lg px-4 py-3">
        <div className="flex items-center justify-center gap-4 max-w-2xl mx-auto flex-wrap">
          <p className="text-white font-medium text-sm">
            📱 A Pharmagister elérhető mobilalkalmazásként!
          </p>
          <div className="flex items-center gap-2">
            {/* App Store gomb – élő */}
            <a
              href={APP_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-black text-white font-semibold text-xs py-2 px-4 rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-2"
            >
              <AppleLogo className="w-4 h-4" />
              <span className="flex flex-col leading-tight">
                <span className="text-[9px] font-normal opacity-80">Elérhető</span>
                <span className="text-xs font-semibold -mt-0.5">App Store</span>
              </span>
            </a>
            {/* Google Play gomb – szürke / hamarosan */}
            {PLAY_STORE_LIVE ? (
              <a
                href={PLAY_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-black text-white font-semibold text-xs py-2 px-4 rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-2"
              >
                <PlayStoreLogo className="w-4 h-4" />
                <span className="flex flex-col leading-tight">
                  <span className="text-[9px] font-normal opacity-80">Elérhető</span>
                  <span className="text-xs font-semibold -mt-0.5">Google Play</span>
                </span>
              </a>
            ) : (
              <span className="bg-gray-500 text-white/80 font-semibold text-xs py-2 px-4 rounded-lg cursor-not-allowed flex items-center gap-2 opacity-70">
                <PlayStoreLogo className="w-4 h-4 opacity-50" />
                <span className="flex flex-col leading-tight">
                  <span className="text-[9px] font-normal opacity-80">Hamarosan</span>
                  <span className="text-xs font-semibold -mt-0.5">Google Play</span>
                </span>
              </span>
            )}
          </div>
          <button
            onClick={handleDismiss}
            className="p-1 rounded-full hover:bg-white/20 transition-colors"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes slide-down {
          from { opacity: 0; transform: translateY(-100%); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-down { animation: slide-down 0.3s ease-out; }
      `}</style>
    </div>
  );
}
