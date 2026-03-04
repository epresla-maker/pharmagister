# Projekt Kontextus - Pharmagister
**Utolsó frissítés:** 2026. március 2.

---

## App státusz
- **iOS App Store:** ✅ ELÉRHETŐ – átment az Apple review-n, live az App Store-ban
- **Android:** ✅ FELTÖLTVE – zárt tesztelés folyamatban (12 tesztelő, 14 nap) – benyújtva: 2026. március 2.
- **App ID:** com.pharmagister.app
- **Architektúra:** Capacitor WebView → https://pharmagister.hu (távoli szerver)
- **Natív funkciók:** Push Notifications, SplashScreen, Keyboard plugin

## Android részletek
- **Verzió:** 1.2 (versionCode: 4)
- **SDK:** minSdk 24 / targetSdk 36 / compileSdk 36
- **Legfrissebb build:** `app-release.aab` – 3.9 MB, buildelve: 2026. március 1.
- **APK (közvetlen letöltés):** `app-release.apk` – 4.2 MB, buildelve: február 12.
- **Firebase Storage APK URL:** https://storage.googleapis.com/pharmacare-dfa3c.firebasestorage.app/apps/pharmagister-android.apk
- **Keystore:** ✅ konfigurálva (`android/app/pharmagister-release.keystore` + `android/keystore.properties`)
- **Google Play zárt teszt vége:** kb. 2026. március 16. (14 nap)

## Fontos tudnivalók
- Webes változtatások (menü, UI, új oldalak) → **NEM kell új iOS build**, elég deployolni a webre
- Új iOS build csak natív plugin hozzáadásakor vagy Capacitor config módosításkor szükséges
- Apple review TODO: mind a 20 pont teljesítve (lásd APPLE_REVIEW_TODO.md)
- Teszt fiók Apple reviewer-nek: teszt.review@pharmagister.hu / AppleReview2026!
- Apple szempontjából a távoli WebView megoldás **nem problémás**, mert az app natív funkciókat is használ (push notif stb.)
- Apple Guideline 4.2 (Minimum Functionality) kockázat alacsony, mivel natív pluginok igazolják az app létjogosultságát
- Tartalom frissítés (új menü, oldal) a weben → az app automatikusan mutatja, nem kell új review

## VS Code beállítások
- **Cmd+Shift+E** → Chat megnyitás: beolvassa az eddigiek.md-t, és csak annyit ír: "Készen állok"
- **Cmd+Shift+M** → Chat megnyitás: "mentsd el az eddigiek.md-be az aktuális állapotot"
- Keybindings fájl: ~/Library/Application Support/Code/User/keybindings.json
