// lib/firebase.js

import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { 
  initializeFirestore, 
  memoryLocalCache,
  persistentLocalCache, 
  persistentMultipleTabManager,
  getFirestore 
} from "firebase/firestore";
import { getStorage } from "firebase/storage";

const isBrowser = typeof window !== 'undefined';

// 1. lépés: Olvassuk be a "titkos fiókból" (process.env)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// 2. lépés: Csatlakozzunk a Firebase "központhoz" (az App)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// 3. lépés: Készítsük elő a "szerszámokat"
const auth = isBrowser ? getAuth(app) : null;
const isCapacitorNative =
  isBrowser &&
  typeof window !== "undefined" &&
  Boolean(window.Capacitor?.isNativePlatform?.() || window.Capacitor);

const userAgent = isBrowser ? window.navigator.userAgent || "" : "";
const isIOSLikeWeb =
  isBrowser &&
  (/iPad|iPhone|iPod/.test(userAgent) ||
    (userAgent.includes("Mac") && "ontouchend" in document));
const isWebKitBased = /AppleWebKit/i.test(userAgent) && !/CriOS|FxiOS|EdgiOS/i.test(userAgent);
const shouldForceLongPolling = isCapacitorNative || isIOSLikeWeb || isWebKitBased;

// Firestore beállítás natív offline cache-sel a gyors betöltéshez
let db = null;
if (isBrowser) {
  try {
    if (shouldForceLongPolling) {
      // iOS/Safari/WebView környezetben a WebChannel gyakran instabil vagy CORS hibát dob.
      db = initializeFirestore(app, {
        localCache: memoryLocalCache(),
        experimentalForceLongPolling: true,
        useFetchStreams: false,
      });
    } else {
      // Kliens oldali Firestore natív cache bekapcsolása
      db = initializeFirestore(app, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
        experimentalAutoDetectLongPolling: true,
      });
    }
  } catch (e) {
    // Ha már inicializálva van, használjuk a meglévőt
    db = getFirestore(app);
  }
}

const storage = isBrowser ? getStorage(app) : null;

// 4. lépés: Exportálás
export { app, auth, db, storage };
