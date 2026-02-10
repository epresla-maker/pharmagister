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
    if (!user || !platformChecked || isNativePlatform) return;
    
    // Check current permission status
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
        headers: { 'Content-Type': 'application/json' },
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
          headers: { 'Content-Type': 'application/json' },
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
    const response = await fetch('/api/send-push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
