"use client";

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Languages } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';

function buildSwitchUrl(market, currentPath) {
  const encodedPath = encodeURIComponent(currentPath || '/');
  return `/api/market/switch?market=${market}&next=${encodedPath}`;
}

function buildTargetUrl(baseUrl, currentPath) {
  try {
    const url = new URL(baseUrl);
    url.pathname = currentPath || '/';
    return url.toString();
  } catch {
    return baseUrl;
  }
}

export default function MarketSettingsPage() {
  const router = useRouter();
  const { darkMode } = useTheme();

  const currentPath = typeof window !== 'undefined'
    ? window.location.pathname + window.location.search + window.location.hash
    : '/';

  const huBase = process.env.NEXT_PUBLIC_MARKET_HU_URL || 'https://pharmagister.hu';
  const deBase = process.env.NEXT_PUBLIC_MARKET_DE_URL || 'https://pharmagister.de';

  const options = useMemo(() => ([
    {
      key: 'hu',
      title: 'Magyar piac (HU)',
      subtitle: huBase,
      target: buildSwitchUrl('hu', currentPath),
      previewTarget: buildTargetUrl(huBase, currentPath),
      flag: 'HU'
    },
    {
      key: 'de',
      title: 'Német piac (DE)',
      subtitle: deBase,
      target: buildSwitchUrl('de', currentPath),
      previewTarget: buildTargetUrl(deBase, currentPath),
      flag: 'DE'
    }
  ]), [huBase, deBase, currentPath]);

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
            A valasztas utan az app a megfelelo domainre nyit, igy a HU es DE forgalom elkulonitheto.
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
                    <div className={`text-xs mt-1 ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>Cel: {opt.previewTarget}</div>
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
