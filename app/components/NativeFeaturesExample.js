// app/components/NativeFeaturesExample.js
// Példa komponens Capacitor pluginok használatára
'use client';

import { useState, useEffect } from 'react';
import {
  isNativePlatform,
  isIOS,
  isAndroid,
  getPlatform,
  getAppInfo,
  getDeviceInfo,
  hapticImpact,
  showToast,
  shareContent,
} from '@/lib/capacitorUtils';
import { getClientMarket } from '@/lib/marketI18n';

export default function NativeFeaturesExample() {
  const market = getClientMarket();
  const [platform, setPlatform] = useState('web');
  const [appInfo, setAppInfo] = useState(null);
  const [deviceInfo, setDeviceInfo] = useState(null);
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    const init = async () => {
      // Platform detection
      const currentPlatform = getPlatform();
      setPlatform(currentPlatform);
      setIsNative(isNativePlatform());

      // App info (csak natív platformon)
      if (isNativePlatform()) {
        try {
          const info = await getAppInfo();
          setAppInfo(info);

          const device = await getDeviceInfo();
          setDeviceInfo(device);
        } catch (error) {
          console.error('Error fetching native info:', error);
        }
      }
    };

    init();
  }, []);

  const handleHaptic = async (style) => {
    await hapticImpact(style);
    await showToast(market === 'de' ? `${style} haptisches Feedback` : `${style} haptic feedback`);
  };

  const handleShare = async () => {
    await hapticImpact('light');
    
    const shared = await shareContent({
      title: 'Pharmagister',
      text: market === 'de' ? 'Plattform fuer Apothekenvertretung' : 'Gyógyszertári helyettesítés platform',
      url: 'https://pharmagister.vercel.app',
      dialogTitle: market === 'de' ? 'Teilen' : 'Megosztás'
    });

    if (shared) {
      await showToast(market === 'de' ? 'Erfolgreich geteilt!' : 'Sikeresen megosztva!');
    } else {
      // Web fallback
      if ('share' in navigator) {
        try {
          await navigator.share({
            title: 'Pharmagister',
            text: market === 'de' ? 'Plattform fuer Apothekenvertretung' : 'Gyógyszertári helyettesítés platform',
            url: window.location.href
          });
        } catch (err) {
          console.log('Share cancelled or failed:', err);
        }
      }
    }
  };

  const handleToast = async () => {
    await hapticImpact('medium');
    await showToast(market === 'de' ? 'Das ist eine native Toast-Nachricht!' : 'Ez egy natív toast üzenet!', 'short', 'bottom');
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">
        {market === 'de' ? '🔌 Native Funktionen Demo' : '🔌 Natív Funkciók Demo'}
      </h1>

      {/* Platform Info */}
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <h2 className="text-lg font-semibold mb-2">📱 {market === 'de' ? 'Plattform-Info' : 'Platform Info'}</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="font-medium">{market === 'de' ? 'Plattform:' : 'Platform:'}</span>
            <span className="capitalize">{platform}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-medium">{market === 'de' ? 'Native App:' : 'Natív App:'}</span>
            <span>{isNative ? (market === 'de' ? '✅ Ja' : '✅ Igen') : (market === 'de' ? '❌ Nein (Web)' : '❌ Nem (Web)')}</span>
          </div>
          {isIOS() && (
            <div className="flex justify-between">
              <span className="font-medium">iOS:</span>
              <span>✅</span>
            </div>
          )}
          {isAndroid() && (
            <div className="flex justify-between">
              <span className="font-medium">Android:</span>
              <span>✅</span>
            </div>
          )}
        </div>
      </div>

      {/* App Info */}
      {appInfo && (
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <h2 className="text-lg font-semibold mb-2">📦 {market === 'de' ? 'App-Info' : 'App Info'}</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="font-medium">{market === 'de' ? 'Name:' : 'Név:'}</span>
              <span>{appInfo.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">{market === 'de' ? 'Version:' : 'Verzió:'}</span>
              <span>{appInfo.version}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Build:</span>
              <span>{appInfo.build}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">ID:</span>
              <span className="text-xs">{appInfo.id}</span>
            </div>
          </div>
        </div>
      )}

      {/* Device Info */}
      {deviceInfo && (
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <h2 className="text-lg font-semibold mb-2">📱 {market === 'de' ? 'Geraete-Info' : 'Device Info'}</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="font-medium">{market === 'de' ? 'Modell:' : 'Model:'}</span>
              <span>{deviceInfo.model}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Platform:</span>
              <span>{deviceInfo.platform}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">{market === 'de' ? 'OS-Version:' : 'OS Verzió:'}</span>
              <span>{deviceInfo.osVersion}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Manufacturer:</span>
              <span>{deviceInfo.manufacturer}</span>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Features */}
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <h2 className="text-lg font-semibold mb-4">🎮 {market === 'de' ? 'Interaktive Funktionen' : 'Interaktív Funkciók'}</h2>
        
        {/* Haptic Feedback */}
        {isNative && (
          <div className="mb-4">
            <h3 className="text-sm font-medium mb-2">{market === 'de' ? 'Haptisches Feedback:' : 'Haptic Feedback:'}</h3>
            <div className="flex gap-2">
              <button
                onClick={() => handleHaptic('light')}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Light
              </button>
              <button
                onClick={() => handleHaptic('medium')}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Medium
              </button>
              <button
                onClick={() => handleHaptic('heavy')}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Heavy
              </button>
            </div>
          </div>
        )}

        {/* Toast */}
        <div className="mb-4">
          <h3 className="text-sm font-medium mb-2">{market === 'de' ? 'Toast-Benachrichtigung:' : 'Toast Notification:'}</h3>
          <button
            onClick={handleToast}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            {isNative ? (market === 'de' ? 'Native Toast' : 'Natív Toast') : 'Web Toast'}
          </button>
        </div>

        {/* Share */}
        <div>
          <h3 className="text-sm font-medium mb-2">{market === 'de' ? 'Teilen:' : 'Share:'}</h3>
          <button
            onClick={handleShare}
            className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
          >
            {market === 'de' ? 'Teilen' : 'Megosztás'}
          </button>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border-l-4 border-blue-500 p-4">
        <p className="text-sm text-blue-700">
          <strong>{market === 'de' ? '💡 Tipp:' : '💡 Tipp:'}</strong> {market === 'de'
            ? 'Diese Komponente erkennt automatisch, ob sie in einer nativen App oder im Webbrowser laeuft, und bietet plattformspezifische Funktionen. Teste in der nativen App das haptische Feedback und den nativen Share-Dialog!'
            : 'Ez a komponens automatikusan felismeri, hogy natív appban vagy webes böngészőben fut, és platformonként eltérő funkciókat nyújt. Natív appon teszteld a haptic feedback-et és a natív share dialog-ot!'}
        </p>
      </div>
    </div>
  );
}
