"use client";
import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useRouter, useSearchParams } from 'next/navigation';
import RouteGuard from '@/app/components/RouteGuard';
import PharmaNavbar from '@/app/components/PharmaNavbar';
import { useBadges } from '@/context/BadgesContext';
import { canAccessScheduleManager } from '../../lib/pharmagisterFeatures';
import { getEffectivePharmagisterRole, hasPharmagisterProfileData, normalizePharmagisterRole } from '../../lib/pharmagisterProfile';
import { getClientMarket, t } from '../../lib/marketI18n';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

function PharmagisterContent() {
  const { user, userData } = useAuth();
  const { darkMode } = useTheme();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isStandalone, setIsStandalone] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallButton, setShowInstallButton] = useState(false);
  const [showScheduleDisclaimer, setShowScheduleDisclaimer] = useState(false);
  const [acceptingScheduleDisclaimer, setAcceptingScheduleDisclaimer] = useState(false);
  const [scheduleDisclaimerAcceptedLocal, setScheduleDisclaimerAcceptedLocal] = useState(false);
  const market = getClientMarket();
  
  // ✅ Használjuk a közös badges hook-ot a duplikált listener helyett
  const { badges } = useBadges();
  const unreadCount = badges.notifications;
  
  // Az aktív tab a query paraméterből jön (alapértelmezett: 'dashboard')
  const activeTab = searchParams.get('tab') || 'dashboard';
  const showScheduleManager = canAccessScheduleManager(user, userData);
  const hasAcceptedScheduleDisclaimer = Boolean(
    userData?.scheduleManagerDisclaimerAcceptedAt || scheduleDisclaimerAcceptedLocal
  );
  
  // Pharmagister szerepkör: 'pharmacy' (Gyógyszertár), 'pharmacist' (Gyógyszerész), 'assistant' (Szakasszisztens)
  const pharmaRole = getEffectivePharmagisterRole(userData);
  const partnerAccountTypes = new Set(['partner_advertiser', 'partner_marketplace', 'partner_professional']);
  const normalizedAccountType = String(userData?.accountType || '').trim().toLowerCase();
  const isPartnerAccount = Boolean(
    userData?.partnerAdvertiser === true ||
    userData?.partnerProfessional === true ||
    partnerAccountTypes.has(normalizedAccountType)
  );
  const showPharmaNavbar = pharmaRole && activeTab !== 'schedule-manager';
  const profileComplete = Boolean(userData?.pharmaProfileComplete || hasPharmagisterProfileData(userData));

  useEffect(() => {
    if (!user || !userData) return;
    if (isPartnerAccount) {
      router.replace('/partner');
    }
  }, [user, userData, isPartnerAccount, router]);

  useEffect(() => {
    if (!user?.uid || !userData || !pharmaRole) return;
    if (normalizePharmagisterRole(userData.pharmagisterRole) === pharmaRole && userData.pharmaProfileComplete) return;

    const recoveryPayload = {
      pharmagisterRole: pharmaRole,
      pharmaProfileComplete: profileComplete,
      pharmagisterRoleRecoveredAt: serverTimestamp(),
    };

    updateDoc(doc(db, 'users', user.uid), recoveryPayload).catch((error) => {
      console.error('Error recovering Pharmagister role:', error);
    });
  }, [user?.uid, userData, pharmaRole, profileComplete]);

  if (isPartnerAccount) {
    return null;
  }

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
      alert(
        market === 'de'
          ? '📱 Installation:\n\niOS: Tippe auf Teilen → "Zum Home-Bildschirm"\n\nAndroid: Tippe auf das ⋮-Menue → "Zum Startbildschirm hinzufuegen"'
          : '📱 Telepítés:\n\niOS: Nyomd meg a Megosztás gombot → "Hozzáadás a kezdőképernyőhöz"\n\nAndroid: Nyomd meg a ⋮ menüt → "Hozzáadás a kezdőképernyőhöz"'
      );
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

  useEffect(() => {
    if (activeTab === 'schedule-manager' && !showScheduleManager) {
      router.replace('/pharmagister?tab=dashboard');
    }
  }, [activeTab, showScheduleManager, router]);

  useEffect(() => {
    const mustAccept = activeTab === 'schedule-manager' && showScheduleManager && !hasAcceptedScheduleDisclaimer;
    setShowScheduleDisclaimer(mustAccept);
  }, [activeTab, showScheduleManager, hasAcceptedScheduleDisclaimer]);

  const handleAcceptScheduleDisclaimer = useCallback(async () => {
    if (!user?.uid) return;
    setAcceptingScheduleDisclaimer(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        scheduleManagerDisclaimerAcceptedAt: serverTimestamp(),
        scheduleManagerDisclaimerVersion: '2026-05-07-v1',
      });
      setScheduleDisclaimerAcceptedLocal(true);
      setShowScheduleDisclaimer(false);
    } catch (error) {
      console.error('Error accepting schedule disclaimer:', error);
      alert(market === 'de' ? 'Speichern der Bestaetigung fehlgeschlagen. Bitte versuche es erneut.' : 'Nem sikerült menteni az elfogadást. Kérlek próbáld újra.');
    } finally {
      setAcceptingScheduleDisclaimer(false);
    }
  }, [market, user?.uid]);

  const handleDeclineScheduleDisclaimer = useCallback(() => {
    setShowScheduleDisclaimer(false);
    router.replace('/pharmagister?tab=dashboard');
  }, [router]);

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
      <div className={`min-h-screen ${darkMode ? 'bg-gray-900 text-white' : 'bg-[#F9FAFB] text-[#111827]'} ${showPharmaNavbar ? 'pb-[146px]' : 'pb-24'}`}>
        <div className="max-w-[420px] sm:max-w-2xl lg:max-w-5xl xl:max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pt-safe">
          
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4 min-h-[48px] relative">
              <button
                onClick={() => router.push('/')}
                className="text-[#6B46C1] font-medium flex items-center gap-1 text-base z-10"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                {t('homeLowercase', market)}
              </button>
              <h1 className="absolute left-1/2 -translate-x-1/2 text-lg sm:text-xl font-bold flex items-center gap-1 flex-shrink-0">
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
                <h2 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-[#111827]'} mb-2`}>{t('chooseRole', market)}</h2>
                <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-[#6B7280]'}`}>
                  {t('connectRoles', market)}
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
                      <h3 className={`font-semibold ${darkMode ? 'text-yellow-300' : 'text-yellow-800'}`}>{t('profileIncomplete', market)}</h3>
                      <p className={`text-sm ${darkMode ? 'text-yellow-400' : 'text-yellow-700'} mt-1`}>
                        {t('profileIncompleteDesc', market)}
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
              {activeTab === 'ratings' && (
                <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-[#E5E7EB]'} border rounded-xl p-6`}>
                  <RatingsTab />
                </div>
              )}
              {activeTab === 'schedule-manager' && showScheduleManager && hasAcceptedScheduleDisclaimer && (
                <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-[#E5E7EB]'} border rounded-xl p-6`}>
                  <ScheduleManagerTab pharmaRole={pharmaRole} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showScheduleDisclaimer && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 p-3 sm:p-6 pb-[calc(96px+env(safe-area-inset-bottom,0px))] sm:pb-6">
          <div className={`w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden ${darkMode ? 'bg-gray-900 border-gray-700 text-gray-100' : 'bg-white border-gray-200 text-gray-900'} max-h-[78vh] sm:max-h-[85vh] flex flex-col`}>
            <div className="p-4 sm:p-6 pb-3 sm:pb-4 border-b border-black/10">
              <h2 className="text-lg sm:text-xl font-bold">Beosztáskezelő használati nyilatkozat</h2>
            </div>
            <div className={`px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm space-y-2 overflow-y-auto ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              <p>
                A Beosztáskezelő funkció tervezést támogató informatikai eszköz. A megjelenített javaslatok és számítások
                nem minősülnek jogi, munkaügyi, adózási vagy szakhatósági tanácsadásnak.
              </p>
              <p>
                A felhasználó (gyógyszertár/foglalkoztató) teljes felelőssége a rögzített adatok pontossága, valamint az,
                hogy a végleges beosztás megfeleljen a hatályos jogszabályoknak és szakmai előírásoknak.
              </p>
              <p>
                A Pharmagister a jogszabályok által megengedett keretek között kizárja felelősségét a funkció használatából
                eredő közvetlen vagy közvetett károkért, különösen a hibás adatrögzítésből, téves publikálásból vagy
                belső szervezési döntésekből származó következményekért. A Pharmagister továbbá nem vállal felelősséget
                az oldal vagy szolgáltatás átmeneti vagy tartós elérhetetlenségéből, üzemzavarából, adatkommunikációs
                hibáiból, illetve egyéb technikai hibáiból eredő károkért sem.
              </p>
              <p>
                A továbblépéssel kijelented, hogy a nyilatkozatot megismerted, megértetted, és elfogadod.
              </p>
            </div>

            <div className="p-4 sm:p-6 pt-3 sm:pt-4 border-t border-black/10 flex flex-col sm:flex-row gap-2 sm:justify-end bg-inherit">
              <button
                type="button"
                onClick={handleDeclineScheduleDisclaimer}
                disabled={acceptingScheduleDisclaimer}
                className={`px-4 py-2 rounded-lg border text-sm ${darkMode ? 'border-gray-600 text-gray-300 hover:bg-gray-800' : 'border-gray-300 text-gray-700 hover:bg-gray-50'} disabled:opacity-60`}
              >
                {t('decline', market)}
              </button>
              <button
                type="button"
                onClick={handleAcceptScheduleDisclaimer}
                disabled={acceptingScheduleDisclaimer}
                className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-60"
              >
                {acceptingScheduleDisclaimer ? t('loadingSave', market) : t('acceptAndContinue', market)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pharma Navbar - csak ha van szerepkör */}
      {showPharmaNavbar && <PharmaNavbar isVisible={showNavbar} />}
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

// Ratings Tab Component (csak gyógyszertáraknak)
function RatingsTab() {
  const RatingsTabComponent = require('@/app/components/RatingsTab').default;
  return <RatingsTabComponent />;
}

// Schedule Manager Tab Component
function ScheduleManagerTab({ pharmaRole }) {
  const ScheduleManagerTabComponent = require('@/app/components/ScheduleManagerTab').default;
  return <ScheduleManagerTabComponent pharmaRole={pharmaRole} />;
}

// Wrapper with Suspense boundary
export default function PharmagisterPage() {
  const market = getClientMarket();
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#F9FAFB] dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#6B46C1] mx-auto mb-4"></div>
          <p className="text-[#6B7280] dark:text-gray-400">{t('loading', market)}</p>
        </div>
      </div>
    }>
      <PharmagisterContent />
    </Suspense>
  );
}
