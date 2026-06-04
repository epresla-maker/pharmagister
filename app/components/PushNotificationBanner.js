"use client";
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Bell, X } from 'lucide-react';
import { getClientMarket } from '@/lib/marketI18n';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Detect if running as installed PWA
function isPWA() {
  return window.matchMedia('(display-mode: standalone)').matches || 
         window.navigator.standalone === true;
}

export default function PushNotificationBanner() {
  const { user } = useAuth();
  const market = getClientMarket();
  const [showBanner, setShowBanner] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    console.log('🔔 PushNotificationBanner mounted');
    console.log('🔔 User:', user?.uid);
    console.log('🔔 Running as PWA:', isPWA());
    
    if (!user) {
      console.log('🔔 No user, waiting...');
      return;
    }
    
    // Check if notifications are supported
    if (!('Notification' in window)) {
      console.log('🔔 Notifications not supported');
      return;
    }
    
    // If running as PWA, always check subscription (ignore dismissed state)
    // This ensures PWA gets its own subscription even if browser already had one
    if (isPWA()) {
      console.log('🔔 PWA mode - checking subscription...');
      checkAndResubscribeIfNeeded();
      return;
    }
    
    // Browser mode - respect dismissed state
    const dismissed = localStorage.getItem('push-banner-dismissed');
    console.log('🔔 Banner dismissed?', dismissed);
    if (dismissed) return;
    
    console.log('🔔 Notification permission:', Notification.permission);
    
    if (Notification.permission === 'default') {
      checkSubscription();
    } else if (Notification.permission === 'granted') {
      checkSubscription();
    }
  }, [user]);

  const getAuthHeaders = async () => {
    const idToken = user ? await user.getIdToken() : null;
    return idToken
      ? { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` }
      : { 'Content-Type': 'application/json' };
  };

  // For PWA: Check if subscription exists AND is saved on server
  const checkAndResubscribeIfNeeded = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      console.log('🔔 PWA subscription check:', subscription?.endpoint?.substring(0, 50));
      
      if (!subscription) {
        // No subscription at all - show banner
        console.log('🔔 PWA: No subscription, showing banner');
        setShowBanner(true);
        return;
      }
      
      // Check if this subscription is saved on server
      const response = await fetch('/api/push-subscription/check', {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          userId: user.uid,
          endpoint: subscription.endpoint
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (!data.exists) {
          // Subscription exists locally but not on server - save it
          console.log('🔔 PWA: Subscription not on server, saving...');
          await saveSubscription(subscription);
        } else {
          console.log('🔔 PWA: Subscription already saved on server');
        }
      }
    } catch (error) {
      console.error('🔔 PWA subscription check error:', error);
      // On error, show banner to allow manual retry
      setShowBanner(true);
    }
  };

  const saveSubscription = async (subscription) => {
    const response = await fetch('/api/push-subscription', {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({
        userId: user.uid,
        subscription: subscription.toJSON()
      })
    });
    
    if (response.ok) {
      console.log('✅ PWA subscription saved');
    }
  };

  const checkSubscription = async () => {
    console.log('🔔 Checking subscription...');
    
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log('🔔 Service Worker or PushManager not supported');
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      console.log('🔔 Service Worker ready:', registration);
      
      const subscription = await registration.pushManager.getSubscription();
      console.log('🔔 Current subscription:', subscription);
      
      // Show banner if not subscribed OR if permission is default
      if (!subscription || Notification.permission === 'default') {
        console.log('🔔 Showing banner!');
        setShowBanner(true);
      } else {
        console.log('🔔 Already subscribed, not showing banner');
      }
    } catch (error) {
      console.error('🔔 Error checking subscription:', error);
    }
  };

  const handleEnable = async () => {
    setLoading(true);
    try {
      // Request permission
      const permission = await Notification.requestPermission();
      
      if (permission !== 'granted') {
        alert(market === 'de' ? 'Benachrichtigungsberechtigung ist erforderlich.' : 'Az értesítések engedélyezése szükséges.');
        setLoading(false);
        return;
      }
      
      // Get service worker
      const registration = await navigator.serviceWorker.ready;
      
      // Subscribe
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
      
      // Save to server
      const response = await fetch('/api/push-subscription', {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          userId: user.uid,
          subscription: subscription.toJSON()
        })
      });
      
      if (response.ok) {
        console.log('✅ Push notifications enabled');
        setShowBanner(false);
        localStorage.setItem('push-banner-dismissed', 'true');
      } else {
        throw new Error('Failed to save subscription');
      }
    } catch (error) {
      console.error('Push subscription error:', error);
      alert((market === 'de' ? 'Fehler: ' : 'Hiba történt: ') + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem('push-banner-dismissed', 'true');
  };

  if (!showBanner) return null;

  return (
    <div className="fixed top-16 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl shadow-2xl p-4 z-50 animate-slide-down">
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 p-1 hover:bg-white/20 rounded-full transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
      
      <div className="flex items-start gap-3">
        <div className="bg-white/20 p-2 rounded-lg">
          <Bell className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <h3 className="font-bold mb-1">{market === 'de' ? 'Benachrichtigungen aktivieren' : 'Értesítések bekapcsolása'}</h3>
          <p className="text-sm text-white/90 mb-3">
            {market === 'de' ? 'Verpasse keine neuen Anfragen und Nachrichten!' : 'Ne maradj le az új igényekről és üzenetekről!'}
          </p>
          <button
            onClick={handleEnable}
            disabled={loading}
            className="w-full bg-white text-purple-600 font-semibold py-2 px-4 rounded-lg hover:bg-white/90 transition-colors disabled:opacity-50"
          >
            {loading ? (market === 'de' ? 'Wird aktiviert...' : 'Engedélyezés...') : (market === 'de' ? 'Aktivieren' : 'Engedélyezem')}
          </button>
        </div>
      </div>
    </div>
  );
}
