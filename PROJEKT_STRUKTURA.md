# 🏗️ Pharmagister Projekt Szerkezete és Felépítése

A **Pharmagister** egy **Next.js 16** alapú gyógyszertári helyettesítési platform, amely PWA (Progressive Web App) támogatással rendelkezik.

---

## 📁 Főbb Mappák

| Mappa | Leírás |
|-------|--------|
| **app/** | Next.js App Router - oldalak és komponensek |
| **context/** | React Context-ek (AuthContext, ThemeContext, ToastContext) |
| **hooks/** | Egyéni React hookok (useChatListener, useDashboardBadges, useServiceFeed) |
| **lib/** | Utility függvények és Firebase konfiguráció |
| **public/** | Statikus fájlok, manifest.json, service worker |

---

## 🌐 Oldalak (app/ mappában)

| Útvonal | Funkció |
|---------|---------|
| `/` | Főoldal |
| `/login` | Bejelentkezés |
| `/register` | Regisztráció |
| `/pharmagister` | Pharmagister fő dashboard |
| `/pharmagister/setup` | Profil beállítás |
| `/pharmagister/demand` | Igények kezelése |
| `/chat` | Chat funkció |
| `/chat/[chatId]` | Egyedi chat beszélgetés |
| `/chat/archive` | Archivált beszélgetések |
| `/chat/new` | Új beszélgetés |
| `/chat/settings` | Chat beállítások |
| `/notifications` | Értesítések |
| `/profil/[id]` | Felhasználói profil megtekintése |
| `/profile/edit` | Profil szerkesztés |
| `/settings` | Beállítások |
| `/admin` | Admin felület |
| `/admin/approvals` | Jóváhagyások kezelése |
| `/admin/posts` | Posztok kezelése |
| `/help` | Súgó |
| `/privacy` | Adatvédelem |
| `/fix-role` | Szerepkör javítás |
| `/verify-email` | Email ellenőrzés |

---

## 🧩 Fő Komponensek (app/components/)

| Komponens | Funkció |
|-----------|---------|
| `PharmaDashboard.js` | Fő dashboard |
| `PharmaNavbar.js` | Navigációs sáv |
| `PharmaCalendar.js` | Naptár megjelenítés |
| `PharmaProfileEditor.js` | Profil szerkesztő |
| `ModernServiceFeed.js` | Szolgáltatás feed |
| `BottomNavigation.js` | Alsó navigáció |
| `ChatBottomNavigation.js` | Chat alsó navigáció |
| `GlobalBottomNav.js` | Globális alsó navigáció |
| `BadgeManager.js` | Badge-ek kezelése |
| `PushNotificationSetup.js` | Push értesítések beállítása |
| `PushNotificationBanner.js` | Push értesítési banner |
| `PWAInstallBanner.js` | PWA telepítési banner |
| `PWARegister.js` | PWA regisztráció |
| `RouteGuard.js` | Útvonal védelem (auth) |
| `StartupRedirect.js` | Indítási átirányítás |
| `Toast.js` | Értesítési toast üzenetek |

---

## 🔌 API Végpontok (app/api/)

| Végpont | Funkció |
|---------|---------|
| `/api/admin` | Admin műveletek |
| `/api/notify-new-demand` | Új igény értesítés |
| `/api/push-subscription` | Push feliratkozás kezelése |
| `/api/send-push` | Push értesítés küldése |
| `/api/send-verification-email` | Ellenőrző email küldése |
| `/api/send-verification-email-v2` | Ellenőrző email v2 |
| `/api/send-custom-verification` | Egyéni ellenőrzés küldése |
| `/api/verify-email-token` | Email token ellenőrzése |

---

## 🪝 React Hookok (hooks/)

| Hook | Funkció |
|------|---------|
| `useChatListener.js` | Chat üzenetek figyelése valós időben |
| `useDashboardBadges.js` | Dashboard badge-ek kezelése |
| `useServiceFeed.js` | Szolgáltatás feed adatok |

---

## 🎨 Context-ek (context/)

| Context | Funkció |
|---------|---------|
| `AuthContext.js` | Felhasználó autentikáció állapot |
| `ThemeContext.js` | Téma (sötét/világos mód) kezelés |
| `ToastContext.js` | Toast üzenetek kezelése |

---

## 📚 Library (lib/)

| Fájl | Funkció |
|------|---------|
| `firebase.js` | Firebase kliens konfiguráció |
| `firebaseAdmin.js` | Firebase Admin SDK |
| `notifications.js` | Értesítések kezelése |

---

## 🔧 Technológiai Stack

| Technológia | Verzió | Funkció |
|-------------|--------|---------|
| Next.js | 16.1.4 | React keretrendszer |
| React | 19.2.3 | UI library |
| Firebase | 12.8.0 | Backend szolgáltatások |
| Firebase Admin | 13.6.0 | Szerver oldali Firebase |
| Tailwind CSS | 3.4.19 | Styling |
| Framer Motion | 12.27.5 | Animációk |
| next-pwa | 5.6.0 | PWA támogatás |
| web-push | 3.6.7 | Push értesítések |
| Resend | 6.8.0 | Email küldés |
| date-fns | 4.1.0 | Dátum kezelés |
| Lucide React | 0.554.0 | Ikonok |
| Heroicons | 2.2.0 | Ikonok |

---

## 🔥 Firebase Collections

| Collection | Tartalom |
|------------|----------|
| `users` | Felhasználók adatai |
| `pharmagisterApprovals` | NNK jóváhagyások |
| `pharmaDemands` | Helyettesítési igények |
| `pharmaApplications` | Jelentkezések |

---

## 📱 PWA Funkciók

- ✅ Telepíthető mobilra appként
- ✅ Push értesítések
- ✅ Service Worker (`sw.js`)
- ✅ Manifest (`manifest.json`)
- ✅ Offline támogatás

---

## 🚀 Futtatás

```bash
# Fejlesztői mód
npm run dev

# Build
npm run build

# Éles futtatás
npm start
```

---

## 📂 Konfigurációs Fájlok

| Fájl | Funkció |
|------|---------|
| `next.config.js` | Next.js konfiguráció |
| `tailwind.config.js` | Tailwind CSS konfiguráció |
| `postcss.config.js` | PostCSS konfiguráció |
| `jsconfig.json` | JavaScript konfiguráció |
| `firebase.json` | Firebase konfiguráció |
| `firestore.rules` | Firestore biztonsági szabályok |
| `firestore.indexes.json` | Firestore indexek |

---

*Utolsó frissítés: 2026. február 1.*
