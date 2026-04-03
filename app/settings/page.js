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
  ShieldCheck,
  HelpCircle, 
  LogOut, 
  ChevronRight,
  Lock,
  Trash2,
  Settings as SettingsIcon,
  Newspaper
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';

// Admin és Adminka szerepkörök
const ADMIN_EMAILS = ['epresla@icloud.com', 'etinatina22@gmail.com'];
const ADMINKA_EMAILS = ['etinatina22@gmail.com'];

export default function SettingsPage() {
  const router = useRouter();
  const { user, userData, loading } = useAuth();
  const { darkMode } = useTheme();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteStep, setDeleteStep] = useState(0); // 0: initial, 1: confirming, 2: deleting, 3: done
  const [deleteError, setDeleteError] = useState('');

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

  const handleDeleteAccount = async () => {
    setDeleteStep(2);
    setDeleteError('');
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/delete-my-account', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Törlési hiba');
      }
      setDeleteStep(3);
      // Sign out locally after deletion
      setTimeout(async () => {
        try { await signOut(auth); } catch (e) {}
        router.push('/login');
      }, 2000);
    } catch (error) {
      console.error('Delete account error:', error);
      setDeleteError(error.message || 'Hiba történt a fiók törlésekor');
      setDeleteStep(1);
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
        },
        {
          icon: Trash2,
          label: 'Fiók törlése',
          onClick: () => { setShowDeleteConfirm(true); setDeleteStep(0); setDeleteError(''); },
          color: 'text-red-600',
          bgColor: darkMode ? 'bg-red-900/30' : 'bg-red-100'
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
        },
        {
          icon: Newspaper,
          label: 'Hírfolyam beállítások',
          onClick: () => router.push('/settings/feed'),
          color: 'text-purple-600',
          bgColor: darkMode ? 'bg-purple-900/30' : 'bg-purple-100'
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
          icon: HelpCircle,
          label: 'Támogatás / Support',
          onClick: () => router.push('/support'),
          color: 'text-indigo-600',
          bgColor: darkMode ? 'bg-indigo-900/30' : 'bg-indigo-100'
        },
        {
          icon: Shield,
          label: 'Adatvédelmi beállítások',
          onClick: () => router.push('/privacy'),
          color: 'text-gray-600',
          bgColor: darkMode ? 'bg-gray-700' : 'bg-gray-100'
        },
        {
          icon: Shield,
          label: 'Adatvédelmi irányelvek / Privacy Policy',
          onClick: () => router.push('/privacy-policy'),
          color: 'text-blue-600',
          bgColor: darkMode ? 'bg-blue-900/30' : 'bg-blue-100'
        },
        {
          icon: ShieldCheck,
          label: 'Child Safety Policy',
          onClick: () => router.push('/child-safety'),
          color: 'text-green-600',
          bgColor: darkMode ? 'bg-green-900/30' : 'bg-green-100'
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
      <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b sticky top-0 z-10 pt-safe-small`}>
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

        {/* Delete Account Button */}
        <button
          onClick={() => { setShowDeleteConfirm(true); setDeleteStep(0); setDeleteError(''); }}
          className={`w-full ${darkMode ? 'bg-gray-800 hover:bg-red-900/30' : 'bg-white hover:bg-red-50'} rounded-xl shadow-sm px-4 py-3 flex items-center gap-3 transition-colors mb-4`}
        >
          <div className={`p-2 rounded-lg ${darkMode ? 'bg-red-900/30' : 'bg-red-100'}`}>
            <Trash2 className="w-5 h-5 text-red-600" />
          </div>
          <span className="flex-1 text-left text-red-600 font-medium">Fiók törlése</span>
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

      {/* Delete Account Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl p-6 max-w-sm w-full`}>
            {deleteStep === 3 ? (
              <>
                <div className="text-center">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Trash2 className="w-6 h-6 text-green-600" />
                  </div>
                  <h3 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-900'} mb-2`}>Fiók törölve</h3>
                  <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>A fiókod és minden adatod véglegesen törölve lett. Átirányítás...</p>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                    <Trash2 className="w-5 h-5 text-red-600" />
                  </div>
                  <h3 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Fiók törlése</h3>
                </div>
                
                {deleteStep === 0 && (
                  <>
                    <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'} mb-4`}>
                      Ezzel <strong>véglegesen és visszavonhatatlanul</strong> törlöd a fiókodat és az összes adatodat:
                    </p>
                    <ul className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'} list-disc pl-5 mb-4 space-y-1`}>
                      <li>Profil és beállítások</li>
                      <li>Helyettesítési igények és jelentkezések</li>
                      <li>Chat üzenetek</li>
                      <li>Értesítések</li>
                    </ul>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setShowDeleteConfirm(false)}
                        className={`flex-1 px-4 py-2 border ${darkMode ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'} rounded-lg transition-colors`}
                      >
                        Mégse
                      </button>
                      <button
                        onClick={() => setDeleteStep(1)}
                        className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                      >
                        Tovább
                      </button>
                    </div>
                  </>
                )}

                {deleteStep === 1 && (
                  <>
                    <p className={`${darkMode ? 'text-gray-300' : 'text-gray-700'} mb-4 font-medium`}>
                      Biztosan törölni szeretnéd a fiókodat? Ez a művelet NEM vonható vissza!
                    </p>
                    {deleteError && (
                      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-800 dark:text-red-200 mb-4">
                        {deleteError}
                      </div>
                    )}
                    <div className="flex gap-3">
                      <button
                        onClick={() => { setShowDeleteConfirm(false); setDeleteStep(0); }}
                        className={`flex-1 px-4 py-2 border ${darkMode ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'} rounded-lg transition-colors`}
                      >
                        Mégse
                      </button>
                      <button
                        onClick={handleDeleteAccount}
                        className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-semibold"
                      >
                        Véglegesen törlöm
                      </button>
                    </div>
                  </>
                )}

                {deleteStep === 2 && (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto mb-3"></div>
                    <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Fiók törlése folyamatban...</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
