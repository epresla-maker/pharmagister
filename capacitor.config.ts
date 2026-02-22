import { CapacitorConfig } from '@capacitor/cli';
import { KeyboardResize, KeyboardStyle } from '@capacitor/keyboard';

const config: CapacitorConfig = {
  appId: 'com.pharmagister.app',
  appName: 'Pharmagister',
  webDir: 'out',
  server: {
    url: 'https://pharmagister.hu',
    cleartext: true,
    errorPath: 'offline.html'
  },
  ios: {
    contentInset: 'always',
    scheme: 'App'
  },
  android: {
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
    },
    // Enable edge-to-edge layout for proper safe area insets
    allowMixedContent: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#6B46C1",
      showSpinner: false,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"]
    },
    StatusBar: {
      // Enable edge-to-edge layout with proper overlays
      style: 'DEFAULT',
      backgroundColor: '#6B46C1',
      overlaysWebView: false
    },
    Keyboard: {
      // Proper keyboard handling for Android
      resize: KeyboardResize.Body,
      style: KeyboardStyle.Dark
    }
  }
};

export default config;
