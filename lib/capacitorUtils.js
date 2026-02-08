// lib/capacitorUtils.js
// Capacitor utility függvények mobilalkalmazáshoz

import { Capacitor } from '@capacitor/core';

/**
 * Ellenőrzi, hogy natív platformon fut-e az app
 * @returns {boolean}
 */
export const isNativePlatform = () => {
  return Capacitor.isNativePlatform();
};

/**
 * Visszaadja a platform típusát
 * @returns {'ios' | 'android' | 'web'}
 */
export const getPlatform = () => {
  return Capacitor.getPlatform();
};

/**
 * Ellenőrzi, hogy iOS-en fut-e
 * @returns {boolean}
 */
export const isIOS = () => {
  return Capacitor.getPlatform() === 'ios';
};

/**
 * Ellenőrzi, hogy Androidon fut-e
 * @returns {boolean}
 */
export const isAndroid = () => {
  return Capacitor.getPlatform() === 'android';
};

/**
 * Ellenőrzi, hogy böngészőben fut-e
 * @returns {boolean}
 */
export const isWeb = () => {
  return Capacitor.getPlatform() === 'web';
};

/**
 * Async plugin betöltő - ellenőrzi, hogy elérhető-e a plugin
 * @param {string} pluginName - Plugin neve
 * @returns {Promise<boolean>}
 */
export const isPluginAvailable = async (pluginName) => {
  try {
    const { [pluginName]: plugin } = await import('@capacitor/core');
    return !!plugin;
  } catch {
    return false;
  }
};

/**
 * Safe plugin call - csak natív platformon hívja meg a plugint
 * @param {Function} pluginCall - Plugin hívás
 * @param {*} fallback - Fallback érték web-en
 * @returns {Promise<*>}
 */
export const safePluginCall = async (pluginCall, fallback = null) => {
  if (!isNativePlatform()) {
    return fallback;
  }
  
  try {
    return await pluginCall();
  } catch (error) {
    console.error('Plugin call error:', error);
    return fallback;
  }
};

/**
 * App Info lekérése (ha telepítve van a plugin)
 * Telepítés: npm install @capacitor/app
 */
export const getAppInfo = async () => {
  return safePluginCall(async () => {
    const { App } = await import('@capacitor/app');
    return await App.getInfo();
  }, { name: 'Pharmagister', version: '0.1.0', build: 'web' });
};

/**
 * Device Info lekérése (ha telepítve van a plugin)
 * Telepítés: npm install @capacitor/device
 */
export const getDeviceInfo = async () => {
  return safePluginCall(async () => {
    const { Device } = await import('@capacitor/device');
    return await Device.getInfo();
  }, { platform: 'web', operatingSystem: 'unknown' });
};

/**
 * Network status ellenőrzése (ha telepítve van a plugin)
 * Telepítés: npm install @capacitor/network
 */
export const getNetworkStatus = async () => {
  return safePluginCall(async () => {
    const { Network } = await import('@capacitor/network');
    return await Network.getStatus();
  }, { connected: true, connectionType: 'wifi' });
};

/**
 * Haptic feedback (rezgés) natív platformon
 * Telepítés: npm install @capacitor/haptics
 */
export const hapticImpact = async (style = 'medium') => {
  return safePluginCall(async () => {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    const impactStyle = {
      light: ImpactStyle.Light,
      medium: ImpactStyle.Medium,
      heavy: ImpactStyle.Heavy,
    }[style] || ImpactStyle.Medium;
    
    await Haptics.impact({ style: impactStyle });
  });
};

/**
 * Toast üzenet natív platformon
 * Telepítés: npm install @capacitor/toast
 */
export const showToast = async (text, duration = 'short', position = 'bottom') => {
  return safePluginCall(async () => {
    const { Toast } = await import('@capacitor/toast');
    await Toast.show({ text, duration, position });
  });
};

/**
 * Status bar beállítása (csak natív)
 * Telepítés: npm install @capacitor/status-bar
 */
export const setStatusBarColor = async (color = '#6B46C1') => {
  return safePluginCall(async () => {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    
    if (isAndroid()) {
      await StatusBar.setBackgroundColor({ color });
    }
    
    // Dark content fekete status bar icons, light content fehér
    await StatusBar.setStyle({ style: Style.Dark });
  });
};

/**
 * Share API natív platformon
 * Telepítés: npm install @capacitor/share
 */
export const shareContent = async ({ title, text, url, dialogTitle }) => {
  return safePluginCall(async () => {
    const { Share } = await import('@capacitor/share');
    await Share.share({ title, text, url, dialogTitle });
    return true;
  }, false);
};

/**
 * Deep link kezelése
 * Telepítés: npm install @capacitor/app
 */
export const addDeepLinkListener = async (callback) => {
  return safePluginCall(async () => {
    const { App } = await import('@capacitor/app');
    App.addListener('appUrlOpen', callback);
  });
};

/**
 * App state change listener (background/foreground)
 */
export const addAppStateListener = async (callback) => {
  return safePluginCall(async () => {
    const { App } = await import('@capacitor/app');
    App.addListener('appStateChange', callback);
  });
};

/**
 * Back button kezelése (Android)
 */
export const addBackButtonListener = async (callback) => {
  if (!isAndroid()) return;
  
  return safePluginCall(async () => {
    const { App } = await import('@capacitor/app');
    App.addListener('backButton', callback);
  });
};

/**
 * Platform-specifikus style osztály hozzáadása
 */
export const addPlatformClass = () => {
  if (typeof document !== 'undefined') {
    const platform = getPlatform();
    document.documentElement.classList.add(`platform-${platform}`);
    
    if (isNativePlatform()) {
      document.documentElement.classList.add('platform-native');
    }
  }
};

// Auto-init: Platform class hozzáadása
if (typeof window !== 'undefined') {
  addPlatformClass();
}

export default {
  isNativePlatform,
  getPlatform,
  isIOS,
  isAndroid,
  isWeb,
  isPluginAvailable,
  safePluginCall,
  getAppInfo,
  getDeviceInfo,
  getNetworkStatus,
  hapticImpact,
  showToast,
  setStatusBarColor,
  shareContent,
  addDeepLinkListener,
  addAppStateListener,
  addBackButtonListener,
  addPlatformClass,
};
