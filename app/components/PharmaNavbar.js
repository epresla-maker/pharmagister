"use client";
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useTheme } from '@/context/ThemeContext';
import { Calendar, BarChart3, HelpCircle } from 'lucide-react';

export default function PharmaNavbar({ isVisible = true }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { darkMode } = useTheme();
  
  // Az aktív tab a ?tab= query paraméterből jön
  const activeTab = searchParams.get('tab') || 'calendar';

  const navItems = [
    {
      icon: Calendar,
      label: 'Naptár',
      tab: 'calendar'
    },
    {
      icon: BarChart3,
      label: 'Vezérlőpult',
      tab: 'dashboard'
    },
    {
      icon: HelpCircle,
      label: 'Súgó',
      tab: 'help',
      isLink: true
    }
  ];

  const handleTabChange = (item) => {
    if (item.isLink) {
      router.push('/help');
    } else {
      router.push(`/pharmagister?tab=${item.tab}`);
    }
  };

  return (
    <div 
      className={`fixed left-0 right-0 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-[#E5E7EB]'} border-t transition-all duration-300 z-40`}
      style={{ 
        bottom: 'calc(73px + env(safe-area-inset-bottom, 0px))',
        transform: isVisible ? 'translateY(0)' : 'translateY(calc(100% + 73px))',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)'
      }}
    >
      <div className="grid grid-cols-3 gap-1 px-2 py-2">
        {navItems.map((item) => {
          const isActive = !item.isLink && activeTab === item.tab;
          const Icon = item.icon;

          return (
            <button
              key={item.tab}
              onClick={() => handleTabChange(item)}
              className={`relative flex flex-col items-center justify-center py-2 px-1 rounded-lg transition-colors touch-manipulation ${
                isActive
                  ? 'bg-[#6B46C1] text-white'
                  : darkMode 
                    ? 'text-gray-400 active:bg-gray-700' 
                    : 'text-[#6B7280] active:bg-[#F3F4F6]'
              }`}
            >
              <Icon className="w-6 h-6" />
              <span className="mt-1 text-xs font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
