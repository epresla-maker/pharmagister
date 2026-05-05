"use client";
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';

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

export default function PushNotificationSetup() {
  const { user } = useAuth();
  const [permission, setPermission] = useState('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isNativePlatform, setIsNativePlatform] = useState(false);
  const [platformChecked, setPlatformChecked] = useState(false);

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const getFcmTokenWithRetry = async (FirebaseMessaging, attempts = 5, delayMs = 700) => {
    for (let i = 0; i < attempts; i += 1) {
      try {
        const tokenResult = await FirebaseMessaging.getToken();
        const token = tokenResult?.token;
        if (token) return token;
      } catch (e) {
        // Retry below
      }
      await sleep(delayMs);
    }
    return null;
  };

  const getAuthHeaders = async () => {
    const idToken = user ? await user.getIdToken() : null;
    return idToken
      ? { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` }
      : { 'Content-Type': 'application/json' };
  };

  const syncNativeFcmToken = async () => {
    if (!user) return;

    try {
      const { Capacitor } = await import('@capacitor/core');
      const { PushNotifications } = await import('@capacitor/push-notifications');
      const platform = Capacitor.getPlatform();

      if (platform !== 'ios' && platform !== 'android') return;

      const permStatus = await PushNotifications.checkPermissions();
      if (permStatus.receive !== 'granted') {
        console.log('[PushSetup] Native push permission is not granted, skipping token sync');
        return;
      }

      // iOS-en FCM token általában csak APNS regisztráció után jön létre.
      try {
        await PushNotifications.register();
      } catch (e) {
        console.log('[PushSetup] Native register call failed before token sync:', e?.message || e);
      }

      const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');
      const fcmToken = await getFcmTokenWithRetry(FirebaseMessaging);

      if (!fcmToken) {
        console.log('[PushSetup] Native FCM token is empty, skipping sync');
        return;
      }

      const response = await fetch('/api/push-subscription', {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          userId: user.uid,
          subscription: {
            endpoint: `native-${platform}-${fcmToken}`,
            platform,
            token: fcmToken,
            tokenType: 'fcm',
            source: 'auto-sync'
          }
        })
      });

      if (response.ok) {
        setIsSubscribed(true);
        console.log('[PushSetup] Native FCM token synced automatically');
      } else {
        const err = await response.json();
        console.log('[PushSetup] Native FCM token sync failed:', err?.error || response.status);
      }
    } catch (e) {
      // Plugin may not be present on web or old builds; keep silent fallback
      console.log('[PushSetup] Native FCM auto-sync not available:', e?.message || e);
    }
  };

  // Platform detektálás
  useEffect(() => {
    const checkPlatform = async () => {
      try {
        const CapacitorCore = await import('@capacitor/core');
        const isNative = CapacitorCore.Capacitor.isNativePlatform();
        setIsNativePlatform(isNative);
        console.log('[PushSetup] Platform:', isNative ? 'Native' : 'Web');
      } catch (e) {
        // Capacitor nem elérhető, web platform
        setIsNativePlatform(false);
        console.log('[PushSetup] Platform: Web (Capacitor not available)');
      }
      setPlatformChecked(true);
    };
    
    checkPlatform();
  }, []);

  useEffect(() => {
    if (!user || !platformChecked) return;
    
    if (isNativePlatform) {
      // Set up native push listeners for foreground notification handling
      const setupNativeListeners = async () => {
        try {
          const { PushNotifications } = await import('@capacitor/push-notifications');
          
          // Listen for notifications received while app is in foreground
          await PushNotifications.addListener('pushNotificationReceived', (notification) => {
            console.log('[PushSetup] Native push received in foreground:', notification);
          });
          
          // Listen for notification tap actions
          await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
            console.log('[PushSetup] Native push action:', action);
            PushNotifications.removeAllDeliveredNotifications().catch(() => {});
            import('@capawesome/capacitor-badge').then(({ Badge }) => Badge.clear().catch(() => {}));
            const url = action.notification?.data?.url;
            if (url) {
              window.location.href = url;
            }
          });

          // Badge törlése app előtérbe kerülésekor
          const { App } = await import('@capacitor/app');
          const { Badge } = await import('@capawesome/capacitor-badge');
          App.addListener('appStateChange', ({ isActive }) => {
            if (isActive) {
              PushNotifications.removeAllDeliveredNotifications().catch(() => {});
              Badge.clear().catch(() => {});
            }
          });
        } catch (e) {
          console.log('[PushSetup] Could not set up native push listeners:', e);
        }
      };

      setupNativeListeners();
      syncNativeFcmToken();
      return;
    }
    
    // Web platform: check permission & subscription
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }

    // Check if already subscribed
    checkSubscription();
  }, [user, platformChecked, isNativePlatform]);

  const checkSubscription = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log('Push notifications not supported');
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch (error) {
      console.error('Error checking subscription:', error);
    }
  };

  const subscribeUser = async () => {
    if (!user) return;

    try {
      // Request notification permission
      const permission = await Notification.requestPermission();
      setPermission(permission);

      if (permission !== 'granted') {
        console.log('Notification permission denied');
        return false;
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });

      // Save subscription to server
      const response = await fetch('/api/push-subscription', {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          userId: user.uid,
          subscription: subscription.toJSON()
        })
      });

      if (response.ok) {
        setIsSubscribed(true);
        console.log('Push subscription saved successfully');
        return true;
      } else {
        console.error('Failed to save subscription');
        return false;
      }
    } catch (error) {
      console.error('Error subscribing to push:', error);
      return false;
    }
  };

  const unsubscribeUser = async () => {
    if (!user) return;

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();

        // Remove from server
        await fetch('/api/push-subscription', {
          method: 'DELETE',
          headers: await getAuthHeaders(),
          body: JSON.stringify({
            userId: user.uid,
            endpoint: subscription.endpoint
          })
        });

        setIsSubscribed(false);
        console.log('Push subscription removed');
      }
    } catch (error) {
      console.error('Error unsubscribing:', error);
    }
  };

  // Export functions for use in other components (csak web platformon)
  useEffect(() => {
    if (isNativePlatform) return;
    
    window.pushNotificationUtils = {
      subscribe: subscribeUser,
      unsubscribe: unsubscribeUser,
      isSubscribed,
      permission
    };
  }, [isSubscribed, permission, isNativePlatform]);

  return null;
}

// Helper function to send push notification (can be imported elsewhere)
export async function sendPushNotification(userId, title, body, url = '/notifications', tag = null) {
  try {
    const { auth } = await import('@/lib/firebase');
    const idToken = auth.currentUser ? await auth.currentUser.getIdToken() : null;
    const headers = { 'Content-Type': 'application/json' };
    if (idToken) headers['Authorization'] = `Bearer ${idToken}`;
    const response = await fetch('/api/send-push', {
      method: 'POST',
      headers,
      body: JSON.stringify({ userId, title, body, url, tag })
    });
    
    const result = await response.json();
    console.log('Push sent:', result);
    return result;
  } catch (error) {
    console.error('Error sending push:', error);
    return { success: false, error: error.message };
  }
}
