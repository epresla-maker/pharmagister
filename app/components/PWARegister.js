"use client";
import { useEffect, useState } from 'react';

export default function PWARegister() {
  const [isNativePlatform, setIsNativePlatform] = useState(false);

  useEffect(() => {
    // Platform detektálás
    const checkPlatform = async () => {
      try {
        const CapacitorCore = await import('@capacitor/core');
        const isNative = CapacitorCore.Capacitor.isNativePlatform();
        setIsNativePlatform(isNative);
        
        // Csak web platformon regisztráljuk a service workert
        if (!isNative && 'serviceWorker' in navigator) {
          console.log('[PWA] Registering service worker...');
          navigator.serviceWorker
            .register('/sw.js')
            .then((registration) => {
              console.log('[PWA] Service Worker registered:', registration);
            })
            .catch((error) => {
              console.error('[PWA] Service Worker registration failed:', error);
            });
        } else if (isNative) {
          console.log('[PWA] Native platform detected - skipping service worker registration');
        }
      } catch (e) {
        // Capacitor nem elérhető, web platform - regisztráljuk a service workert
        if ('serviceWorker' in navigator) {
          console.log('[PWA] Web platform - registering service worker...');
          navigator.serviceWorker
            .register('/sw.js')
            .then((registration) => {
              console.log('[PWA] Service Worker registered:', registration);
            })
            .catch((error) => {
              console.error('[PWA] Service Worker registration failed:', error);
            });
        }
      }
    };
    
    checkPlatform();
  }, []);

  return null;
}
