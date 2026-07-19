"use client";
import { memo, useMemo, useCallback, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useBadges } from '@/context/BadgesContext';
import { getClientMarket, t } from '@/lib/marketI18n';

function HomeGlyph({ className = 'w-6 h-6' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M4.8 10.3L12 4.5L19.2 10.3V19.1C19.2 19.78 18.65 20.3 18.02 20.3H5.98C5.35 20.3 4.8 19.78 4.8 19.1V10.3Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/>
      <path d="M9.1 20.3V14.7C9.1 14.11 9.58 13.63 10.17 13.63H13.83C14.42 13.63 14.9 14.11 14.9 14.7V20.3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M7.2 11.8H16.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.65"/>
    </svg>
  );
}

function ChatGlyph({ className = 'w-6 h-6' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M6.2 5.6H17.8C18.89 5.6 19.8 6.51 19.8 7.6V14C19.8 15.09 18.89 16 17.8 16H11.4L7.3 19.2V16H6.2C5.11 16 4.2 15.09 4.2 14V7.6C4.2 6.51 5.11 5.6 6.2 5.6Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/>
      <path d="M7.5 9.4H16.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      <path d="M7.5 12.1H13.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  );
}

function BellPulseGlyph({ className = 'w-6 h-6' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M12 4.8C9.1 4.8 6.8 7.1 6.8 10V13.2L5.2 15.2C4.9 15.55 5.15 16.1 5.62 16.1H18.38C18.85 16.1 19.1 15.55 18.8 15.2L17.2 13.2V10C17.2 7.1 14.9 4.8 12 4.8Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/>
      <path d="M10.4 16.1C10.64 17.26 11.33 18.1 12 18.1C12.67 18.1 13.36 17.26 13.6 16.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      <path d="M14.7 7.2C15.9 7.85 16.7 9.12 16.7 10.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.65"/>
      <path d="M19 6.1V8.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M20 7.1H22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function GridGlyph({ className = 'w-6 h-6' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M5.5 6.2C5.5 5.65 5.95 5.2 6.5 5.2H10.2C10.75 5.2 11.2 5.65 11.2 6.2V9.9C11.2 10.45 10.75 10.9 10.2 10.9H6.5C5.95 10.9 5.5 10.45 5.5 9.9V6.2Z" stroke="currentColor" strokeWidth="1.7"/>
      <path d="M12.8 6.2C12.8 5.65 13.25 5.2 13.8 5.2H17.5C18.05 5.2 18.5 5.65 18.5 6.2V9.9C18.5 10.45 18.05 10.9 17.5 10.9H13.8C13.25 10.9 12.8 10.45 12.8 9.9V6.2Z" stroke="currentColor" strokeWidth="1.7"/>
      <path d="M5.5 13.5C5.5 12.95 5.95 12.5 6.5 12.5H10.2C10.75 12.5 11.2 12.95 11.2 13.5V17.2C11.2 17.75 10.75 18.2 10.2 18.2H6.5C5.95 18.2 5.5 17.75 5.5 17.2V13.5Z" stroke="currentColor" strokeWidth="1.7"/>
      <path d="M12.8 13.5C12.8 12.95 13.25 12.5 13.8 12.5H17.5C18.05 12.5 18.5 12.95 18.5 13.5V17.2C18.5 17.75 18.05 18.2 17.5 18.2H13.8C13.25 18.2 12.8 17.75 12.8 17.2V13.5Z" stroke="currentColor" strokeWidth="1.7"/>
    </svg>
  );
}

function GearGlyph({ className = 'w-6 h-6' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M10.9 4.7H13.1L13.7 6.6C14.1 6.7 14.5 6.9 14.9 7.1L16.7 6.3L18.2 7.8L17.4 9.6C17.6 10 17.8 10.4 17.9 10.8L19.8 11.4V13.6L17.9 14.2C17.8 14.6 17.6 15 17.4 15.4L18.2 17.2L16.7 18.7L14.9 17.9C14.5 18.1 14.1 18.3 13.7 18.4L13.1 20.3H10.9L10.3 18.4C9.9 18.3 9.5 18.1 9.1 17.9L7.3 18.7L5.8 17.2L6.6 15.4C6.4 15 6.2 14.6 6.1 14.2L4.2 13.6V11.4L6.1 10.8C6.2 10.4 6.4 10 6.6 9.6L5.8 7.8L7.3 6.3L9.1 7.1C9.5 6.9 9.9 6.7 10.3 6.6L10.9 4.7Z" stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round"/>
      <circle cx="12" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.6"/>
    </svg>
  );
}

function readMarketCookie() {
  return getClientMarket();
}

// Memoized NavItem to prevent re-renders when other badges change
const NavItem = memo(function NavItem({ item, isActive, darkMode, onClick }) {
  const Icon = item.icon;
  const iconColorClass = isActive ? item.activeIconColor : item.iconColor;
  
  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-center justify-center py-2 px-1 rounded-lg transition-colors touch-manipulation ${
        isActive
          ? 'text-emerald-600'
          : darkMode 
            ? 'text-gray-400 active:bg-gray-800' 
            : 'text-[#6B7280] active:bg-[#F3F4F6]'
      }`}
    >
      {item.badge > 0 && (
        <div className="absolute top-1 right-1/4 bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none">
          {item.badge}
        </div>
      )}
      
      <Icon 
        className={`w-6 h-6 ${iconColorClass}`}
        strokeWidth={2}
      />
      
      <span className="mt-1 font-medium text-[0.55rem] leading-tight truncate w-full text-center">{item.label}</span>
    </button>
  );
});

function BottomNavigation({ isVisible = true }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, userData, loading } = useAuth();
  const { darkMode } = useTheme();
  const { badges } = useBadges();
  const [market, setMarket] = useState('hu');

  useEffect(() => {
    setMarket(readMarketCookie());
  }, [pathname]);

  // Memoize nav items to prevent recreation on every render
  const navItems = useMemo(() => [
    {
      icon: HomeGlyph,
      label: t('navHome', market),
      path: '/kozosseg',
      iconColor: darkMode ? 'text-emerald-300' : 'text-emerald-500',
      activeIconColor: 'text-emerald-600',
      badge: 0
    },
    {
      icon: ChatGlyph,
      label: t('navMessages', market),
      path: '/chat',
      iconColor: darkMode ? 'text-sky-300' : 'text-sky-500',
      activeIconColor: 'text-sky-600',
      badge: badges.messages
    },
    {
      icon: BellPulseGlyph,
      label: t('navNotifications', market),
      path: '/notifications',
      iconColor: darkMode ? 'text-amber-300' : 'text-amber-500',
      activeIconColor: 'text-amber-600',
      badge: badges.notifications
    },
    {
      icon: GridGlyph,
      label: 'Pharmagister',
      path: '/pharmagister',
      iconColor: darkMode ? 'text-violet-300' : 'text-violet-500',
      activeIconColor: 'text-violet-600',
      isLarge: true,
      badge: 0
    },
    {
      icon: GearGlyph,
      label: t('navSettings', market),
      path: '/settings',
      iconColor: darkMode ? 'text-rose-300' : 'text-rose-500',
      activeIconColor: 'text-rose-600',
      badge: 0
    }
  ], [badges.messages, badges.notifications, darkMode, market]);

  // Memoize navigation handler
  const handleNavigation = useCallback((path) => {
    router.push(path);
  }, [router]);

  // Ne jelenjen meg, ha nincs bejelentkezve a felhasználó vagy még tölt
  if (!user || loading) {
    return null;
  }

  return (
    <div 
      className={`fixed bottom-0 left-0 right-0 border-t transition-transform duration-300 z-50 ${
        darkMode ? 'bg-gray-900 border-gray-700' : 'bg-white border-[#E5E7EB]'
      } ${isVisible ? 'translate-y-0' : 'translate-y-full'}`}
      style={{
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        willChange: 'transform',
        transform: 'translateZ(0)'
      }}
    >
      <div className="grid grid-cols-5 gap-1 px-2 py-2">
        {navItems.map((item) => (
          <NavItem
            key={item.path}
            item={item}
            isActive={pathname === item.path}
            darkMode={darkMode}
            onClick={() => handleNavigation(item.path)}
          />
        ))}
      </div>
    </div>
  );
}

export default memo(BottomNavigation);
