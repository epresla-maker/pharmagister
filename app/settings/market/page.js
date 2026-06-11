"use client";

import { useRouter } from 'next/navigation';
import { ArrowLeft, Languages } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { getClientMarket } from '@/lib/marketI18n';

export default function MarketSettingsPage() {
  const router = useRouter();
  const { darkMode } = useTheme();
  const market = getClientMarket();

  return (
    <div className={`min-h-screen pb-24 ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b sticky top-0 z-10 pt-safe-small`}>
        <div className="flex items-center px-4 py-3">
          <button
            onClick={() => router.back()}
            className={`p-2 -ml-2 ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'} rounded-full transition-colors`}
          >
            <ArrowLeft className={`w-5 h-5 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`} />
          </button>
          <h1 className={`text-lg font-semibold ml-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            {market === 'de' ? 'Markt- und Sprachauswahl' : 'Piac es nyelv valasztas'}
          </h1>
        </div>
      </div>

      <div className="px-4 mt-4">
        <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border rounded-xl p-4 shadow-sm`}>
          <div className="flex items-center gap-2 mb-3">
            <Languages className="w-5 h-5 text-emerald-500" />
            <h2 className={`text-base font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              {market === 'de' ? 'Sprache bei Registrierung festgelegt' : 'Nyelv regisztrációkor rögzítve'}
            </h2>
          </div>

          <p className={`text-sm mb-4 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            {market === 'de'
              ? 'Die Lokalisierung wird bei der Registrierung gespeichert und kann in den Einstellungen nicht geaendert werden.'
              : 'A lokalizáció regisztrációkor kerül mentésre, és a beállításokban nem módosítható.'}
          </p>

          <div className={`rounded-lg border px-4 py-3 ${darkMode ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-gray-50'}`}>
            <div className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              {market === 'de' ? 'Aktive Sprache: Deutsch' : 'Aktív nyelv: Magyar'}
            </div>
            <div className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              {market === 'de' ? 'Falls eine andere Sprache noetig ist, neues Konto mit der gewuenschten Sprache erstellen.' : 'Ha másik nyelvre van szükség, új fiókot kell regisztrálni a kívánt nyelvvel.'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
