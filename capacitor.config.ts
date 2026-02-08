import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pharmagister.app',
  appName: 'Pharmagister',
  webDir: 'out',
  bundledWebRuntime: false,
  server: {
    // Production URL - amikor az app telepítve van
    // Ha lokálisan tesztelsz, használd: 'http://localhost:3000'
    url: 'https://pharmagister.hu',
    cleartext: true
  },
  ios: {
    contentInset: 'always',
    scheme: 'Pharmagister'
  },
  android: {
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
    }
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#6B46C1",
      showSpinner: false,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"]
    }
  }
};

export default config;
