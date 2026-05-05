"use client";
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { canAccessScheduleManager } from '@/lib/pharmagisterFeatures';
import { Calendar, BarChart3, Star, HelpCircle } from 'lucide-react';

function ScheduleGridIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="3" width="20" height="18" rx="2.5" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="2" y="3" width="20" height="5.5" rx="2.5" fill="currentColor" fillOpacity="0.15"/>
      <line x1="2" y1="8.5" x2="22" y2="8.5" stroke="currentColor" strokeWidth="1"/>
      <line x1="8.5" y1="8.5" x2="8.5" y2="21" stroke="currentColor" strokeWidth="0.75" strokeOpacity="0.4"/>
      <line x1="15.5" y1="8.5" x2="15.5" y2="21" stroke="currentColor" strokeWidth="0.75" strokeOpacity="0.4"/>
      <line x1="2" y1="14" x2="22" y2="14" stroke="currentColor" strokeWidth="0.75" strokeOpacity="0.4"/>
      <rect x="3" y="9.5" width="4.5" height="3.5" rx="1" fill="#8B5CF6"/>
      <rect x="9.5" y="9.5" width="5" height="3.5" rx="1" fill="#10B981"/>
      <rect x="16.5" y="9.5" width="4.5" height="3.5" rx="1" fill="#F59E0B"/>
      <rect x="3" y="15" width="4.5" height="3.5" rx="1" fill="#10B981"/>
      <rect x="9.5" y="15" width="5" height="3.5" rx="1" fill="#8B5CF6"/>
      <rect x="16.5" y="15" width="4.5" height="3.5" rx="1" fill="#6EE7B7" fillOpacity="0.7"/>
    </svg>
  );
}

export default function PharmaNavbar({ isVisible = true }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { darkMode } = useTheme();
  const { user, userData } = useAuth();
  
  const pharmaRole = userData?.pharmagisterRole || null;
  const showScheduleManager = canAccessScheduleManager(user, userData);
  
  // Az aktív tab a ?tab= query paraméterből jön
  const activeTab = searchParams.get('tab') || 'calendar';

  const allNavItems = [
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
      icon: Star,
      label: 'Értékelés',
      tab: 'ratings',
      pharmacyOnly: true
    },
    {
      icon: HelpCircle,
      label: 'Súgó',
      tab: 'help',
      isLink: true
    },
    {
      icon: ScheduleGridIcon,
      label: 'Beosztások kezelése',
      tab: 'schedule-manager',
      adminOnly: true
    }
  ];

  // Szűrjük ki a pharmacyOnly elemeket, ha nem gyógyszertár
  const navItems = allNavItems.filter(item => {
    if (item.adminOnly) {
      return showScheduleManager;
    }
    if (item.pharmacyOnly) {
      return pharmaRole === 'pharmacy';
    }
    return true;
  });

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
      <div className={`grid ${navItems.length === 4 ? 'grid-cols-4' : 'grid-cols-3'} gap-1 px-2 py-2`}>
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
              <div className="relative">
                <Icon className="w-6 h-6" />
                {item.tab === 'schedule-manager' && (
                  <span className="absolute -top-1.5 -right-2 text-[8px] font-black tracking-wider leading-none px-0.5 py-px rounded bg-violet-500 text-white" style={{fontSize:'7px'}}>PRO</span>
                )}
              </div>
              <span className="mt-1 text-xs font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
