"use client";
import { memo, Suspense, lazy } from 'react';
import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { ToastProvider } from '@/context/ToastContext';

// Lazy load non-critical components to reduce initial bundle
const PWARegister = lazy(() => import('./PWARegister'));
const BadgeManager = lazy(() => import('./BadgeManager'));
const StartupRedirect = lazy(() => import('./StartupRedirect'));
const PushNotificationSetup = lazy(() => import('./PushNotificationSetup'));
const PushNotificationBanner = lazy(() => import('./PushNotificationBanner'));
const GlobalBottomNav = lazy(() => import('./GlobalBottomNav'));
const PWAInstallBanner = lazy(() => import('./PWAInstallBanner'));
const OfflineBanner = lazy(() => import('./OfflineBanner'));

// Empty fallback for lazy-loaded components
const EmptyFallback = () => null;

function ClientProviders({ children }) {
  return (
    <AuthProvider>
      {/* Non-critical PWA components - lazy loaded */}
      <Suspense fallback={<EmptyFallback />}>
        <PWARegister />
        <BadgeManager />
        <StartupRedirect />
      </Suspense>
      
      {/* Push notification components - lazy loaded after auth */}
      <Suspense fallback={<EmptyFallback />}>
        <PushNotificationSetup />
        <PushNotificationBanner />
      </Suspense>
      
      <ThemeProvider>
        <ToastProvider>
          <Suspense fallback={<EmptyFallback />}>
            <OfflineBanner />
          </Suspense>
          {children}
          {/* Bottom nav and install banner - lazy loaded */}
          <Suspense fallback={<EmptyFallback />}>
            <GlobalBottomNav />
            <PWAInstallBanner />
          </Suspense>
        </ToastProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default memo(ClientProviders);
