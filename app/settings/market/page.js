"use client";

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Languages } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';

function buildSwitchUrl(market, currentPath) {
  const encodedPath = encodeURIComponent(currentPath || '/');
  return `/api/market/switch?market=${market}&next=${encodedPath}`;
}

export default function MarketSettingsPage() {
  const router = useRouter();
  const { darkMode } = useTheme();

  const currentPath = typeof window !== 'undefined'
    ? window.location.pathname + window.location.search + window.location.hash
    : '/';

  const options = useMemo(() => ([
    {
      key: 'hu',
      title: 'Magyar nyelv (HU)',
      subtitle: 'Magyar tartalom ugyanazon a domainen',
      target: buildSwitchUrl('hu', currentPath),
      flag: 'HU'
    },
    {
      key: 'de',
      title: 'Német nyelv (DE)',
      subtitle: 'A weboldal ugyanazon a domainen marad',
      target: buildSwitchUrl('de', currentPath),
      flag: 'DE'
    }
  ]), [currentPath]);

  const goToMarket = (target) => {
    window.location.href = target;
  };

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
            Piac es nyelv valasztas
          </h1>
        </div>
      </div>

      <div className="px-4 mt-4">
        <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border rounded-xl p-4 shadow-sm`}>
          <div className="flex items-center gap-2 mb-3">
            <Languages className="w-5 h-5 text-emerald-500" />
            <h2 className={`text-base font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              Kivalasztott piac kulon domainre visz
            </h2>
          </div>

          <p className={`text-sm mb-4 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            A választás ugyanazon a domainen marad, csak a megjelenő nyelv és market cookie változik.
          </p>

          <div className="space-y-3">
            {options.map((opt) => (
              <button
                key={opt.key}
                onClick={() => goToMarket(opt.target)}
                className={`w-full text-left rounded-lg border px-4 py-3 transition-colors ${darkMode ? 'border-gray-700 bg-gray-900 hover:bg-gray-700' : 'border-gray-200 bg-gray-50 hover:bg-gray-100'}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>{opt.title}</div>
                    <div className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{opt.subtitle}</div>
                  </div>
                  <div className="text-xs px-2 py-1 rounded bg-emerald-600 text-white">{opt.flag}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
