"use client";
import { memo, useMemo, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { MessageCircle, Bell, Settings, LayoutGrid, Home } from 'lucide-react';
import { useDashboardBadges } from '@/hooks/useDashboardBadges';

// Memoized NavItem to prevent re-renders when other badges change
const NavItem = memo(function NavItem({ item, isActive, darkMode, onClick }) {
  const Icon = item.icon;
  
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
        className="w-6 h-6"
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
  const { badges } = useDashboardBadges(user, userData);

  // Memoize nav items to prevent recreation on every render
  const navItems = useMemo(() => [
    {
      icon: Home,
      label: 'Főoldal',
      path: '/kozosseg',
      badge: 0
    },
    {
      icon: MessageCircle,
      label: 'Üzenetek',
      path: '/chat',
      badge: badges.messages
    },
    {
      icon: Bell,
      label: 'Értesítések',
      path: '/notifications',
      badge: badges.notifications
    },
    {
      icon: LayoutGrid,
      label: 'Pharmagister',
      path: '/pharmagister',
      isLarge: true,
      badge: 0
    },
    {
      icon: Settings,
      label: 'Beállítások',
      path: '/settings',
      badge: 0
    }
  ], [badges.messages, badges.notifications]);

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
