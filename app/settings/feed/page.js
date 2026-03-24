"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ArrowLeft, EyeOff, MessageSquare, CheckCircle, Loader2 } from 'lucide-react';
import RouteGuard from '@/app/components/RouteGuard';

export default function FeedSettingsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { darkMode } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [settings, setSettings] = useState({
    hideAnonymousPosts: false,
    compactView: false,
    hideReactions: false,
  });

  // Load settings
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, 'userSettings', user.uid));
        if (snap.exists()) {
          const data = snap.data();
          setSettings(prev => ({
            ...prev,
            hideAnonymousPosts: data.hideAnonymousPosts || false,
            compactView: data.compactView || false,
            hideReactions: data.hideReactions || false,
          }));
        }
      } catch (e) {
        console.error('Error loading feed settings:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  const handleToggle = async (key) => {
    const newSettings = { ...settings, [key]: !settings[key] };
    setSettings(newSettings);
    setSaving(true);
    setSaved(false);
    try {
      await setDoc(doc(db, 'userSettings', user.uid), {
        hideAnonymousPosts: newSettings.hideAnonymousPosts,
        compactView: newSettings.compactView,
        hideReactions: newSettings.hideReactions,
      }, { merge: true });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error('Error saving feed settings:', e);
      // Revert on error
      setSettings(settings);
    } finally {
      setSaving(false);
    }
  };

  const feedOptions = [
    {
      key: 'hideAnonymousPosts',
      icon: EyeOff,
      label: 'Anonim posztok elrejtése',
      description: 'Az anonim posztok nem jelennek meg a hírfolyamban',
      color: 'text-purple-600',
      bgColor: darkMode ? 'bg-purple-900/30' : 'bg-purple-100',
    },
    {
      key: 'compactView',
      icon: MessageSquare,
      label: 'Kompakt nézet',
      description: 'Kisebb posztok, több tartalom fér a képernyőre',
      color: 'text-blue-600',
      bgColor: darkMode ? 'bg-blue-900/30' : 'bg-blue-100',
    },
    {
      key: 'hideReactions',
      icon: EyeOff,
      label: 'Reakciók elrejtése',
      description: 'Ne jelenjenek meg a reakció számlálók a posztokon',
      color: 'text-orange-600',
      bgColor: darkMode ? 'bg-orange-900/30' : 'bg-orange-100',
    },
  ];

  return (
    <RouteGuard>
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
            <h1 className={`text-lg font-semibold ml-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              Hírfolyam beállítások
            </h1>
            {saving && <Loader2 className="w-4 h-4 ml-auto animate-spin text-purple-500" />}
            {saved && <CheckCircle className="w-4 h-4 ml-auto text-green-500" />}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
          </div>
        ) : (
          <div className="mt-4 px-4 space-y-4">
            {/* Feed options */}
            <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-sm overflow-hidden`}>
              <div className={`px-4 py-2 ${darkMode ? 'bg-gray-700/50 border-gray-700' : 'bg-gray-50 border-gray-100'} border-b`}>
                <h3 className={`text-xs font-semibold ${darkMode ? 'text-gray-400' : 'text-gray-500'} uppercase tracking-wider`}>
                  Megjelenítés
                </h3>
              </div>
              <div className={`divide-y ${darkMode ? 'divide-gray-700' : 'divide-gray-100'}`}>
                {feedOptions.map((option) => (
                  <div
                    key={option.key}
                    className={`flex items-center gap-3 px-4 py-3.5`}
                  >
                    <div className={`p-2 rounded-lg ${option.bgColor}`}>
                      <option.icon className={`w-5 h-5 ${option.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                        {option.label}
                      </p>
                      <p className={`text-xs mt-0.5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        {option.description}
                      </p>
                    </div>
                    <button
                      onClick={() => handleToggle(option.key)}
                      className={`relative w-12 h-7 rounded-full transition-colors flex-shrink-0 ${
                        settings[option.key] ? 'bg-purple-600' : darkMode ? 'bg-gray-600' : 'bg-gray-300'
                      }`}
                    >
                      <div className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
                        settings[option.key] ? 'translate-x-5' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Info */}
            <div className={`px-4 py-3 rounded-xl ${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-sm`}>
              <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                A beállítások automatikusan mentődnek és minden eszközödön érvényesek lesznek.
              </p>
            </div>
          </div>
        )}
      </div>
    </RouteGuard>
  );
}
