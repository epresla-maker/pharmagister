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

export default function NativeFeaturesExample() {
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
    await showToast(`${style} haptic feedback`);
  };

  const handleShare = async () => {
    await hapticImpact('light');
    
    const shared = await shareContent({
      title: 'Pharmagister',
      text: 'Gyógyszertári helyettesítés platform',
      url: 'https://pharmagister.vercel.app',
      dialogTitle: 'Megosztás'
    });

    if (shared) {
      await showToast('Sikeresen megosztva!');
    } else {
      // Web fallback
      if ('share' in navigator) {
        try {
          await navigator.share({
            title: 'Pharmagister',
            text: 'Gyógyszertári helyettesítés platform',
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
    await showToast('Ez egy natív toast üzenet!', 'short', 'bottom');
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">
        🔌 Natív Funkciók Demo
      </h1>

      {/* Platform Info */}
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <h2 className="text-lg font-semibold mb-2">📱 Platform Info</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="font-medium">Platform:</span>
            <span className="capitalize">{platform}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-medium">Natív App:</span>
            <span>{isNative ? '✅ Igen' : '❌ Nem (Web)'}</span>
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
          <h2 className="text-lg font-semibold mb-2">📦 App Info</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="font-medium">Név:</span>
              <span>{appInfo.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Verzió:</span>
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
          <h2 className="text-lg font-semibold mb-2">📱 Device Info</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="font-medium">Model:</span>
              <span>{deviceInfo.model}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Platform:</span>
              <span>{deviceInfo.platform}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">OS Verzió:</span>
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
        <h2 className="text-lg font-semibold mb-4">🎮 Interaktív Funkciók</h2>
        
        {/* Haptic Feedback */}
        {isNative && (
          <div className="mb-4">
            <h3 className="text-sm font-medium mb-2">Haptic Feedback:</h3>
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
          <h3 className="text-sm font-medium mb-2">Toast Notification:</h3>
          <button
            onClick={handleToast}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            {isNative ? 'Natív Toast' : 'Web Toast'}
          </button>
        </div>

        {/* Share */}
        <div>
          <h3 className="text-sm font-medium mb-2">Share:</h3>
          <button
            onClick={handleShare}
            className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
          >
            Megosztás
          </button>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border-l-4 border-blue-500 p-4">
        <p className="text-sm text-blue-700">
          <strong>💡 Tipp:</strong> Ez a komponens automatikusan felismeri, hogy 
          natív appban vagy webes böngészőben fut, és platformonként eltérő 
          funkciókat nyújt. Natív appon teszteld a haptic feedback-et és a 
          natív share dialog-ot!
        </p>
      </div>
    </div>
  );
}
