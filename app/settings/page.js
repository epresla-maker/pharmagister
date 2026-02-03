"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { 
  ArrowLeft, 
  User, 
  Bell, 
  Shield, 
  HelpCircle, 
  LogOut, 
  ChevronRight,
  Lock,
  Settings as SettingsIcon
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';

// Admin és Adminka szerepkörök
const ADMIN_EMAILS = ['epresla@icloud.com'];
const ADMINKA_EMAILS = ['etinatina22@gmail.com'];

export default function SettingsPage() {
  const router = useRouter();
  const { user, userData, loading } = useAuth();
  const { darkMode } = useTheme();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const settingsSections = [
    {
      title: 'Fiók',
      items: [
        {
          icon: User,
          label: 'Profil szerkesztése',
          onClick: () => router.push('/pharmagister/setup?edit=true'),
          color: 'text-purple-600',
          bgColor: darkMode ? 'bg-purple-900/30' : 'bg-purple-100'
        },
        {
          icon: Lock,
          label: 'Jelszó módosítása',
          onClick: () => router.push('/settings/password'),
          color: 'text-blue-600',
          bgColor: darkMode ? 'bg-blue-900/30' : 'bg-blue-100'
        }
      ]
    },
    {
      title: 'Alkalmazás',
      items: [
        {
          icon: Bell,
          label: 'Értesítések',
          onClick: () => router.push('/settings/notifications'),
          color: 'text-orange-600',
          bgColor: 'bg-orange-100'
        }
      ]
    },
    {
      title: 'Támogatás',
      items: [
        {
          icon: HelpCircle,
          label: 'Súgó',
          onClick: () => router.push('/help'),
          color: 'text-teal-600',
          bgColor: darkMode ? 'bg-teal-900/30' : 'bg-teal-100'
        },
        {
          icon: Shield,
          label: 'Adatvédelem',
          onClick: () => router.push('/privacy'),
          color: 'text-gray-600',
          bgColor: darkMode ? 'bg-gray-700' : 'bg-gray-100'
        }
      ]
    }
  ];

  // Admin menüpont hozzáadása ha admin user
  if (user && ADMIN_EMAILS.includes(user.email)) {
    settingsSections.push({
      title: 'Adminisztráció',
      items: [
        {
          icon: SettingsIcon,
          label: 'Admin Panel',
          onClick: () => router.push('/admin'),
          color: 'text-red-600',
          bgColor: darkMode ? 'bg-red-900/30' : 'bg-red-100'
        }
      ]
    });
  }

  // Adminka menüpont hozzáadása ha adminka user
  if (user && ADMINKA_EMAILS.includes(user.email)) {
    settingsSections.push({
      title: 'Adminisztráció',
      items: [
        {
          icon: SettingsIcon,
          label: 'Adminka Panel',
          onClick: () => router.push('/adminka'),
          color: 'text-pink-600',
          bgColor: darkMode ? 'bg-pink-900/30' : 'bg-pink-100'
        }
      ]
    });
  }

  return (
    <div className={`min-h-screen pb-24 ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Header */}
      <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b sticky top-0 z-10`}>
        <div className="flex items-center px-4 py-3">
          <button
            onClick={() => router.back()}
            className={`p-2 -ml-2 ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'} rounded-full transition-colors`}
          >
            <ArrowLeft className={`w-5 h-5 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`} />
          </button>
          <h1 className={`text-lg font-semibold ml-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Beállítások</h1>
        </div>
      </div>

      {/* User Info */}
      <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} mx-4 mt-4 rounded-xl p-4 shadow-sm`}>
        <div className="flex items-center gap-4">
          {userData?.photoURL ? (
            <img 
              src={userData.photoURL} 
              alt={userData.displayName || 'Profil'}
              className="w-16 h-16 rounded-full object-cover"
            />
          ) : (
            <div className={`w-16 h-16 rounded-full ${darkMode ? 'bg-emerald-900/30' : 'bg-emerald-100'} flex items-center justify-center`}>
              <User className="w-8 h-8 text-emerald-600" />
            </div>
          )}
          <div className="flex-1">
            <h2 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              {userData?.displayName || 'Felhasználó'}
            </h2>
            <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{user.email}</p>
            {userData?.role && (
              <span className={`inline-block mt-1 px-2 py-0.5 ${darkMode ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-100 text-emerald-700'} text-xs rounded-full`}>
                {userData.role === 'pharmacist' ? 'Gyógyszerész' : userData.role}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Settings Sections */}
      <div className="mt-4 space-y-4 px-4">
        {settingsSections.map((section) => (
          <div key={section.title} className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-sm overflow-hidden`}>
            <div className={`px-4 py-2 ${darkMode ? 'bg-gray-700/50 border-gray-700' : 'bg-gray-50 border-gray-100'} border-b`}>
              <h3 className={`text-xs font-semibold ${darkMode ? 'text-gray-400' : 'text-gray-500'} uppercase tracking-wider`}>
                {section.title}
              </h3>
            </div>
            <div className={`divide-y ${darkMode ? 'divide-gray-700' : 'divide-gray-100'}`}>
              {section.items.map((item) => (
                <button
                  key={item.label}
                  onClick={item.onClick}
                  className={`w-full flex items-center gap-3 px-4 py-3 ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'} transition-colors`}
                >
                  <div className={`p-2 rounded-lg ${item.bgColor}`}>
                    <item.icon className={`w-5 h-5 ${item.color}`} />
                  </div>
                  <span className={`flex-1 text-left ${darkMode ? 'text-white' : 'text-gray-900'}`}>{item.label}</span>
                  {item.isToggle ? (
                    <div className={`relative w-11 h-6 rounded-full transition-colors ${darkMode ? 'bg-emerald-600' : 'bg-gray-300'}`}>
                      <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${darkMode ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </div>
                  ) : item.value ? (
                    <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{item.value}</span>
                  ) : (
                    <ChevronRight className={`w-5 h-5 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}

        {/* Add Account Button */}
        <button
          onClick={() => router.push('/register')}
          className={`w-full ${darkMode ? 'bg-gray-800 hover:bg-gray-700' : 'bg-white hover:bg-gray-50'} rounded-xl shadow-sm px-4 py-3 flex items-center gap-3 transition-colors mb-4`}
        >
          <div className={`p-2 rounded-lg ${darkMode ? 'bg-blue-900/30' : 'bg-blue-100'}`}>
            <User className="w-5 h-5 text-blue-600" />
          </div>
          <span className={`flex-1 text-left font-medium ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>Fiók hozzáadása</span>
          <ChevronRight className={`w-5 h-5 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
        </button>

        {/* Logout Button */}
        <button
          onClick={() => setShowLogoutConfirm(true)}
          className={`w-full ${darkMode ? 'bg-gray-800 hover:bg-red-900/30' : 'bg-white hover:bg-red-50'} rounded-xl shadow-sm px-4 py-3 flex items-center gap-3 transition-colors`}
        >
          <div className={`p-2 rounded-lg ${darkMode ? 'bg-red-900/30' : 'bg-red-100'}`}>
            <LogOut className="w-5 h-5 text-red-600" />
          </div>
          <span className="flex-1 text-left text-red-600 font-medium">Kijelentkezés</span>
        </button>
      </div>

      {/* App Version */}
      <div className="mt-8 text-center">
        <p className={`text-xs ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>Pharmagister v1.0.0</p>
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl p-6 max-w-sm w-full`}>
            <h3 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-900'} mb-2`}>Kijelentkezés</h3>
            <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'} mb-6`}>Biztosan ki szeretnél jelentkezni?</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className={`flex-1 px-4 py-2 border ${darkMode ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'} rounded-lg transition-colors`}
              >
                Mégse
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Kijelentkezés
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
