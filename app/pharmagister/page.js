"use client";
import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useRouter, useSearchParams } from 'next/navigation';
import RouteGuard from '@/app/components/RouteGuard';
import PharmaNavbar from '@/app/components/PharmaNavbar';
import { useDashboardBadges } from '@/hooks/useDashboardBadges';
import { db } from '@/lib/firebase';

function PharmagisterContent() {
  const { user, userData } = useAuth();
  const { darkMode } = useTheme();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isStandalone, setIsStandalone] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallButton, setShowInstallButton] = useState(false);
  
  // ✅ Használjuk a közös badges hook-ot a duplikált listener helyett
  const { notifications: unreadCount } = useDashboardBadges(user, userData);
  
  // Az aktív tab a query paraméterből jön (alapértelmezett: 'calendar')
  const activeTab = searchParams.get('tab') || 'calendar';
  
  // Pharmagister szerepkör: 'pharmacy' (Gyógyszertár), 'pharmacist' (Gyógyszerész), 'assistant' (Szakasszisztens)
  const pharmaRole = userData?.pharmagisterRole || null;
  const profileComplete = userData?.pharmaProfileComplete || false;

  // Detect standalone mode once on mount
  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches 
      || window.navigator.standalone 
      || document.referrer.includes('android-app://');
    setIsStandalone(standalone);
  }, []);

  // Capture beforeinstallprompt event
  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallButton(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = useCallback(async () => {
    if (!deferredPrompt) {
      // iOS vagy már telepített
      alert('📱 Telepítés:\n\niOS: Nyomd meg a Megosztás gombot → "Hozzáadás a kezdőképernyőhöz"\n\nAndroid: Nyomd meg a ⋮ menüt → "Hozzáadás a kezdőképernyőhöz"');
      return;
    }

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        console.log('Pharmagister telepítve!');
        setShowInstallButton(false);
      }
      
      setDeferredPrompt(null);
    } catch (err) {
      console.error('Install error:', err);
    }
  }, [deferredPrompt]);

  // Auto-trigger when coming from dashboard with ?install=true
  useEffect(() => {
    if (searchParams.get('install') === 'true' && !isStandalone) {
      if (deferredPrompt) {
        handleInstallClick();
      } else {
        setShowInstallButton(true);
      }
    }
  }, [searchParams, isStandalone, deferredPrompt, handleInstallClick]);

  // ✅ TÖRÖLVE: Duplikált notification listener - most már useDashboardBadges-ből jön

  // --- SCROLL FIGYELÉS A NAVBAR ELREJTÉSÉHEZ ---
  const [showNavbar, setShowNavbar] = useState(true);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    const handleScroll = () => {
      if (!ticking.current) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;
          
          if (currentScrollY < lastScrollY.current) {
            setShowNavbar(true);
          } else if (currentScrollY > lastScrollY.current && currentScrollY > 100) {
            setShowNavbar(false);
          }
          
          lastScrollY.current = currentScrollY;
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
      <div className={`min-h-screen ${darkMode ? 'bg-gray-900 text-white' : 'bg-[#F9FAFB] text-[#111827]'} ${pharmaRole ? 'pb-[146px]' : 'pb-40'}`}>
        <div className="max-w-[420px] sm:max-w-2xl lg:max-w-5xl xl:max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pt-safe">
          
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4 min-h-[48px]">
              <button
                onClick={() => router.push('/')}
                className="text-[#6B46C1] font-medium flex items-center gap-1 text-base"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                főoldal
              </button>
              <h1 className="text-lg sm:text-xl font-bold flex items-center gap-1 flex-shrink-0">
                <span className="text-green-600 text-lg sm:text-xl">Pharmagister</span>
              </h1>
              <div className="w-10"></div>
            </div>
          </div>

          {/* Validálás szükséges figyelmeztetés */}
          {userData?.status === 'pending_validation' && !pharmaRole && (
            <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <svg className="w-6 h-6 text-yellow-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <h3 className="font-semibold text-yellow-800">Validálás szükséges</h3>
                  <p className="text-sm text-yellow-700 mt-1">
                    A Pharmagister modulba való regisztrációhoz 2 ismerős validálása szükséges.
                    Jelenleg {userData?.validatedBy?.length || 0}/2 validálásod van.
                  </p>
                  <button
                    onClick={() => router.push('/find-users')}
                    className="mt-3 text-sm font-medium text-yellow-800 hover:text-yellow-900 underline"
                  >
                    Ismerősök keresése →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Szerepkör beállítás - ha még nincs és validálva van */}
          {!pharmaRole && userData?.status !== 'pending_validation' && (
            <div className="space-y-4">
              <div className="mb-6">
                <h2 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-[#111827]'} mb-2`}>Válaszd ki a szerepköröd:</h2>
                <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-[#6B7280]'}`}>
                  Kösd össze a gyógyszertárakat a helyettesítőkkel
                </p>
              </div>

              <button
                onClick={() => router.push('/pharmagister/setup?role=pharmacy')}
                className={`w-full ${darkMode ? 'bg-gray-800 hover:bg-gray-700 border-gray-700' : 'bg-white hover:bg-[#F3F4F6] border-[#E5E7EB]'} border rounded-xl p-4 transition-colors shadow-sm`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7">
                    <svg className={`w-7 h-7 ${darkMode ? 'text-white' : 'text-[#111827]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className={`font-semibold ${darkMode ? 'text-white' : 'text-[#111827]'}`}>Gyógyszertár</h3>
                    <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-[#6B7280]'}`}>Helyettesítőt keresek</p>
                  </div>
                  <svg className={`w-5 h-5 ${darkMode ? 'text-gray-400' : 'text-[#6B7280]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>

              <button
                onClick={() => router.push('/pharmagister/setup?role=pharmacist')}
                className={`w-full ${darkMode ? 'bg-gray-800 hover:bg-gray-700 border-gray-700' : 'bg-white hover:bg-[#F3F4F6] border-[#E5E7EB]'} border rounded-xl p-4 transition-colors shadow-sm`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7">
                    <svg className={`w-7 h-7 ${darkMode ? 'text-white' : 'text-[#111827]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className={`font-semibold ${darkMode ? 'text-white' : 'text-[#111827]'}`}>Gyógyszerész</h3>
                    <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-[#6B7280]'}`}>Helyettesítést vállalok</p>
                  </div>
                  <svg className={`w-5 h-5 ${darkMode ? 'text-gray-400' : 'text-[#6B7280]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>

              <button
                onClick={() => router.push('/pharmagister/setup?role=assistant')}
                className={`w-full ${darkMode ? 'bg-gray-800 hover:bg-gray-700 border-gray-700' : 'bg-white hover:bg-[#F3F4F6] border-[#E5E7EB]'} border rounded-xl p-4 transition-colors shadow-sm`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7">
                    <svg className={`w-7 h-7 ${darkMode ? 'text-white' : 'text-[#111827]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className={`font-semibold ${darkMode ? 'text-white' : 'text-[#111827]'}`}>Szakasszisztens</h3>
                    <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-[#6B7280]'}`}>Helyettesítést vállalok</p>
                  </div>
                  <svg className={`w-5 h-5 ${darkMode ? 'text-gray-400' : 'text-[#6B7280]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            </div>
          )}

          {/* Fő tartalom - ha már van szerepkör */}
          {pharmaRole && (
            <div className="space-y-4">
              {/* Profil nem kész figyelmeztetés */}
              {userData?.pharmaPendingApproval && !userData?.pharmaProfileComplete && (
                <div className={`${darkMode ? 'bg-yellow-900/30 border-yellow-600' : 'bg-yellow-50 border-yellow-300'} border rounded-xl p-4`}>
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">⏳</span>
                    <div>
                      <h3 className={`font-semibold ${darkMode ? 'text-yellow-300' : 'text-yellow-800'}`}>Profil hiányos</h3>
                      <p className={`text-sm ${darkMode ? 'text-yellow-400' : 'text-yellow-700'} mt-1`}>
                        Kérlek töltsd ki a profilodat a beállításokban, hogy használhasd a Pharmagister funkcióit.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'calendar' && (
                <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-[#E5E7EB]'} border rounded-xl p-6`}>
                  <CalendarTab pharmaRole={pharmaRole} />
                </div>
              )}
              {activeTab === 'dashboard' && (
                <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-[#E5E7EB]'} border rounded-xl p-6`}>
                  <DashboardTab pharmaRole={pharmaRole} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Pharma Navbar - csak ha van szerepkör */}
      {pharmaRole && <PharmaNavbar isVisible={showNavbar} />}
    </RouteGuard>
  );
}

// Calendar Tab Component
function CalendarTab({ pharmaRole }) {
  const PharmaCalendar = require('@/app/components/PharmaCalendar').default;
  return <PharmaCalendar pharmaRole={pharmaRole} />;
}

// Dashboard Tab Component
function DashboardTab({ pharmaRole }) {
  const searchParams = useSearchParams();
  const expandDemandId = searchParams.get('expand');
  const PharmaDashboard = require('@/app/components/PharmaDashboard').default;
  return <PharmaDashboard pharmaRole={pharmaRole} expandDemandId={expandDemandId} />;
}

// Wrapper with Suspense boundary
export default function PharmagisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#F9FAFB] dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#6B46C1] mx-auto mb-4"></div>
          <p className="text-[#6B7280] dark:text-gray-400">Betöltés...</p>
        </div>
      </div>
    }>
      <PharmagisterContent />
    </Suspense>
  );
}
