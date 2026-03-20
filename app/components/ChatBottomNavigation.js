"use client";
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { Bell, Menu, Home } from 'lucide-react';
import { useBadges } from '@/context/BadgesContext';

export default function ChatBottomNavigation({ isVisible = true, onMenuOpen }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, userData } = useAuth();
  const { badges } = useBadges();
  const { darkMode } = useTheme();

  const navItems = [
    {
      icon: Home,
      label: 'Főoldal',
      path: '/',
      onClick: () => router.push('/')
    },
    {
      icon: Bell,
      label: 'Értesítések',
      path: '/notifications',
      badge: badges.notifications,
      onClick: () => router.push('/notifications')
    }
  ];

  return (
    <div 
      className={`fixed bottom-0 left-0 right-0 transition-transform duration-300 z-50 ${
        darkMode ? 'bg-black border-t border-gray-800' : 'bg-white border-t border-[#E5E7EB]'
      } ${
        isVisible ? 'translate-y-0' : 'translate-y-full'
      }`}
      style={{
        paddingBottom: 'env(safe-area-inset-bottom, 0px)'
      }}
    >
      <div className="grid grid-cols-2 gap-1 px-2 py-2">
        {navItems.map((item, index) => {
          // Pontos egyezés - /chat csak /chat-ra aktív, nem /chat/settings-re
          const isActive = item.path && pathname === item.path;
          const Icon = item.icon;

          return (
            <button
              key={item.path || `menu-${index}`}
              onClick={item.onClick}
              className={`relative flex flex-col items-center justify-center py-2 px-1 rounded-lg transition-colors touch-manipulation ${
                isActive
                  ? darkMode 
                    ? 'bg-gray-800 text-white' 
                    : 'bg-[#F3F4F6] text-[#111827]'
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
              
              <Icon className={item.isLarge ? "w-8 h-8" : "w-6 h-6"} />
              
              <span className={`mt-1 font-medium ${item.isLarge ? 'text-sm' : 'text-xs'}`}>{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
